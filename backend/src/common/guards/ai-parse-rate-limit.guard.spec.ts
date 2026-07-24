import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../exceptions/business.exception';
import { SlidingWindowRateLimiterService } from '../rate-limit/sliding-window-rate-limiter.service';
import { AiParseRateLimitGuard } from './ai-parse-rate-limit.guard';

const CONFIG: Record<string, number> = {
  AI_PARSE_RATE_LIMIT_WINDOW_SECONDS: 3600,
  AI_PARSE_RATE_LIMIT_MAX: 20,
};

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildGuard(allowed: boolean) {
  const hit = jest.fn().mockResolvedValue(allowed);
  const limiter = { hit };
  const config = { get: jest.fn((key: string) => CONFIG[key]) };
  const guard = new AiParseRateLimitGuard(
    limiter as unknown as SlidingWindowRateLimiterService,
    config as unknown as ConfigService,
  );
  return { guard, hit, config };
}

describe('AiParseRateLimitGuard', () => {
  it('allows the request when the teacher window is under its limit', async () => {
    const { guard, hit } = buildGuard(true);
    const ctx = buildContext({
      user: { sub: 'teacher-1', role: 'teacher' },
      body: {},
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledWith(
      'rate_limit:ai_parse:teacher:teacher-1',
      20,
      3600,
    );
  });

  it('throws 429 when the teacher window is exceeded', async () => {
    const { guard } = buildGuard(false);
    const ctx = buildContext({
      user: { sub: 'teacher-1', role: 'teacher' },
      body: {},
    });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(HttpException);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('raises a 429 that carries no errorCode (single-cause generic error)', async () => {
    const { guard } = buildGuard(false);
    const ctx = buildContext({
      user: { sub: 'teacher-1', role: 'teacher' },
      body: {},
    });
    const error = await guard.canActivate(ctx).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    // BusinessException is the only class that attaches errorCode (AD-16) — a
    // plain HttpException never carries the property.
    expect(error).not.toBeInstanceOf(BusinessException);
  });

  // AD-10: the rate-limit key must come from the verified JWT claim, never
  // anything client-supplied in the body — a teacher could otherwise spoof
  // another teacher's bucket (or dodge their own) by forging a body field.
  it('keys the Redis window off the authenticated teacher id, not the body', async () => {
    const { guard, hit } = buildGuard(true);
    const ctx = buildContext({
      user: { sub: 'teacher-1', role: 'teacher' },
      body: { teacherId: 'someone-else', userId: 'attacker' },
    });
    await guard.canActivate(ctx);
    const [key] = hit.mock.calls[0] as [string, number, number];
    expect(key).toBe('rate_limit:ai_parse:teacher:teacher-1');
    expect(key).not.toContain('someone-else');
    expect(key).not.toContain('attacker');
  });

  it('falls back to safe defaults when the env vars are absent', async () => {
    const hit = jest.fn().mockResolvedValue(true);
    const config = { get: jest.fn(() => undefined) };
    const guard = new AiParseRateLimitGuard(
      { hit } as unknown as SlidingWindowRateLimiterService,
      config as unknown as ConfigService,
    );
    const ctx = buildContext({ user: { sub: 'teacher-1', role: 'teacher' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledWith(
      'rate_limit:ai_parse:teacher:teacher-1',
      20,
      3600,
    );
  });

  // `?? DEFAULT` only catches null/undefined — a present-but-blank env var
  // must not silently zero the limit.
  it('falls back to safe defaults when the env vars are blank strings', async () => {
    const hit = jest.fn().mockResolvedValue(true);
    const config = { get: jest.fn(() => '') };
    const guard = new AiParseRateLimitGuard(
      { hit } as unknown as SlidingWindowRateLimiterService,
      config as unknown as ConfigService,
    );
    const ctx = buildContext({ user: { sub: 'teacher-1', role: 'teacher' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledWith(
      'rate_limit:ai_parse:teacher:teacher-1',
      20,
      3600,
    );
  });
});
