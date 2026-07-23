import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { SlidingWindowRateLimiterService } from '../rate-limit/sliding-window-rate-limiter.service';

// Defaults mirror .env.example so a missing env var degrades to a working limit
// rather than disabling the throttle (or throwing at request time).
const DEFAULT_WINDOW_SECONDS = 60;
const DEFAULT_IP_MAX = 30;
const DEFAULT_ACCOUNT_MAX = 5;

// RFC 5321 §4.5.3.1.3 caps a full email address at 254 characters. The guard
// runs before the ValidationPipe/@IsEmail, so an overlong `body.email` must be
// rejected here rather than used as an unbounded Redis key.
const MAX_EMAIL_LENGTH = 254;

/**
 * Reads a positive-integer config value, falling back to `fallback` when the
 * var is absent, blank, or not a valid positive number. `ConfigService.get<number>`
 * is a compile-time-only cast — real env values are strings — so this parses
 * explicitly instead of trusting the generic.
 */
function getPositiveIntConfig(
  config: ConfigService,
  key: string,
  fallback: number,
): number {
  const raw = config.get<string | number>(key);
  const parsed = Number(raw);
  return raw !== undefined &&
    raw !== '' &&
    Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : fallback;
}

/**
 * Route-scoped login throttle (AD-19). Two independent Redis sliding windows —
 * per client IP and per target account — and either one tripping yields 429.
 *
 * Per-IP is lenient and per-account is strict on purpose: a whole class shares
 * one school NAT egress IP at exam time (NFR-01/05), so a tight per-IP cap would
 * lock out legitimate students; the per-account window is the actual brute-force
 * backstop and holds even when the attacker rotates IPs.
 *
 * Runs before the handler AND before the ValidationPipe, so a throttled attacker
 * never reaches bcrypt/the DB — and `request.body` here is raw parsed JSON, not
 * a validated LoginDto.
 */
@Injectable()
export class LoginRateLimitGuard implements CanActivate {
  constructor(
    private readonly limiter: SlidingWindowRateLimiterService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const windowSeconds = getPositiveIntConfig(
      this.config,
      'LOGIN_RATE_LIMIT_WINDOW_SECONDS',
      DEFAULT_WINDOW_SECONDS,
    );
    const ipMax = getPositiveIntConfig(
      this.config,
      'LOGIN_RATE_LIMIT_IP_MAX',
      DEFAULT_IP_MAX,
    );
    const accountMax = getPositiveIntConfig(
      this.config,
      'LOGIN_RATE_LIMIT_ACCOUNT_MAX',
      DEFAULT_ACCOUNT_MAX,
    );

    // `request.ip` is the real client only because main.ts sets `trust proxy` 1.
    // It can be undefined in unusual setups (no socket remoteAddress) — skip the
    // IP dimension rather than collapse those clients into one shared bucket.
    const checks: Promise<boolean>[] = [];
    if (request.ip) {
      checks.push(
        this.limiter.hit(
          `rate_limit:login:ip:${request.ip}`,
          ipMax,
          windowSeconds,
        ),
      );
    }

    const email: unknown = (request.body as { email?: unknown } | undefined)
      ?.email;
    if (
      typeof email === 'string' &&
      email.trim() !== '' &&
      email.length <= MAX_EMAIL_LENGTH
    ) {
      // LoginDto does not normalize email, so key case-insensitively here or
      // "A@b.c" and "a@b.c" would get one full window each.
      const account = email.trim().toLowerCase();
      checks.push(
        this.limiter.hit(
          `rate_limit:login:account:${account}`,
          accountMax,
          windowSeconds,
        ),
      );
    }

    // Evaluate both windows before deciding: short-circuiting on the first
    // rejection would stop the other dimension from accruing, so an attacker
    // hammering one account from many IPs could keep its counter cold.
    const results = await Promise.all(checks);
    if (results.some((allowed) => !allowed)) {
      // NestJS has no TooManyRequestsException. Single-cause limit → no
      // errorCode (AD-16); the global filter shapes the envelope.
      throw new HttpException(
        'Too many login attempts, please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
