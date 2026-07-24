import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../types/authenticated-request';
import { SlidingWindowRateLimiterService } from '../rate-limit/sliding-window-rate-limiter.service';
import { getPositiveIntConfig } from '../config/positive-int-config';

const DEFAULT_WINDOW_SECONDS = 3600;
const DEFAULT_MAX = 20;

/**
 * Route-scoped throttle on the parse-enqueue endpoint (AD-19, NFR-09). One
 * dimension only — per teacher — keyed off the verified JWT id, never the
 * request body (AD-10).
 *
 * Ordering this guard depends on, both true in NestJS 11: (a) the global
 * guards (JwtAuthGuard, RolesGuard in app.module.ts) run BEFORE route-scoped
 * guards, so `request.user` is already populated here; (b) guards run BEFORE
 * interceptors, so a throttled request is rejected before FileInterceptor
 * buffers a 20 MB PDF. If either were false this guard would be useless.
 *
 * Inherited debt (Epic 1 retro D2): this guard has the identical fail-closed
 * shape as login-rate-limit.guard.ts — an unguarded `await limiter.hit()`
 * returns 500 for every upload if Redis blips. Not fixed here in isolation;
 * Story 2.3 owns the NFR-11 circuit-breaker mechanism and both guards must
 * become consumers of it.
 */
@Injectable()
export class AiParseRateLimitGuard implements CanActivate {
  constructor(
    private readonly limiter: SlidingWindowRateLimiterService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const windowSeconds = getPositiveIntConfig(
      this.config,
      'AI_PARSE_RATE_LIMIT_WINDOW_SECONDS',
      DEFAULT_WINDOW_SECONDS,
    );
    const max = getPositiveIntConfig(
      this.config,
      'AI_PARSE_RATE_LIMIT_MAX',
      DEFAULT_MAX,
    );

    const allowed = await this.limiter.hit(
      `rate_limit:ai_parse:teacher:${request.user.sub}`,
      max,
      windowSeconds,
    );
    if (!allowed) {
      // Single-cause limit → no errorCode (AD-16); the global filter shapes
      // the envelope. error-codes.ts stays empty — Story 2.8 is its first
      // legitimate consumer.
      throw new HttpException(
        'Too many parse requests, please try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return true;
  }
}
