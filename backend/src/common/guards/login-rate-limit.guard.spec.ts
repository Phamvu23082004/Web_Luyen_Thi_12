import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BusinessException } from '../exceptions/business.exception';
import { SlidingWindowRateLimiterService } from '../rate-limit/sliding-window-rate-limiter.service';
import { LoginRateLimitGuard } from './login-rate-limit.guard';

const CONFIG: Record<string, number> = {
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: 60,
  LOGIN_RATE_LIMIT_IP_MAX: 30,
  LOGIN_RATE_LIMIT_ACCOUNT_MAX: 5,
};

function buildContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

/** `hit` resolves false for any key containing one of `rejectKeyParts`. */
function buildGuard(rejectKeyParts: string[] = []) {
  const hit = jest.fn((key: string) =>
    Promise.resolve(!rejectKeyParts.some((part) => key.includes(part))),
  );
  const limiter = { hit };
  const config = { get: jest.fn((key: string) => CONFIG[key]) };
  const guard = new LoginRateLimitGuard(
    limiter as unknown as SlidingWindowRateLimiterService,
    config as unknown as ConfigService,
  );
  return { guard, hit, config };
}

describe('LoginRateLimitGuard', () => {
  it('allows the request when both windows are under their limit', async () => {
    const { guard, hit } = buildGuard();
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: 'a@b.c' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:ip:1.2.3.4', 30, 60);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:account:a@b.c', 5, 60);
  });

  it('throws 429 when the per-IP window is exceeded', async () => {
    const { guard } = buildGuard(['login:ip:']);
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: 'a@b.c' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    await expect(guard.canActivate(ctx)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  // Independence: an account can be throttled even from an IP that is well
  // under its own (lenient) limit — this is the real brute-force backstop.
  it('throws 429 when the per-account window is exceeded', async () => {
    const { guard } = buildGuard(['login:account:']);
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: 'a@b.c' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
  });

  it('raises a 429 that carries no errorCode (single-cause generic error)', async () => {
    const { guard } = buildGuard(['login:account:']);
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: 'a@b.c' } });
    const error = await guard.canActivate(ctx).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(429);
    // BusinessException is the only class that attaches errorCode (AD-16) — a
    // plain HttpException never carries the property, so asserting the class
    // (not just the property's absence) actually locks the single-cause path.
    expect(error).not.toBeInstanceOf(BusinessException);
  });

  // Short-circuiting on the first rejection is a real, silent bug: the
  // un-checked dimension would stop accruing, so an attacker hammering one
  // account from many IPs could keep the account counter permanently cold.
  it('records BOTH windows even when the first one already rejected', async () => {
    const { guard, hit } = buildGuard(['login:ip:']);
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: 'a@b.c' } });
    await expect(guard.canActivate(ctx)).rejects.toThrow(HttpException);
    expect(hit).toHaveBeenCalledTimes(2);
  });

  // The guard runs before the ValidationPipe, so the body is raw parsed JSON.
  it('applies only the IP window when the body has no email, without crashing', async () => {
    const { guard, hit } = buildGuard();
    const ctx = buildContext({ ip: '1.2.3.4', body: {} });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledTimes(1);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:ip:1.2.3.4', 30, 60);
  });

  it('tolerates a missing body entirely', async () => {
    const { guard, hit } = buildGuard();
    const ctx = buildContext({ ip: '1.2.3.4' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it('ignores a non-string email rather than keying on it', async () => {
    const { guard, hit } = buildGuard();
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: { $ne: null } } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledTimes(1);
  });

  // LoginDto does not normalize email, so the same account reached as
  // "A@B.c" and " a@b.c " must land on one counter.
  it('normalizes the account key (trim + lowercase)', async () => {
    const { guard, hit } = buildGuard();
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: '  A@B.C  ' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:account:a@b.c', 5, 60);
  });

  it('falls back to safe defaults when the env vars are absent', async () => {
    const hit = jest.fn(() => Promise.resolve(true));
    const config = { get: jest.fn(() => undefined) };
    const guard = new LoginRateLimitGuard(
      { hit } as unknown as SlidingWindowRateLimiterService,
      config as unknown as ConfigService,
    );
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: 'a@b.c' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:ip:1.2.3.4', 30, 60);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:account:a@b.c', 5, 60);
  });

  // `?? DEFAULT` only catches null/undefined — a present-but-blank env var
  // must not silently zero the limit or crash the Lua script's tonumber().
  it('falls back to safe defaults when the env vars are blank strings', async () => {
    const hit = jest.fn(() => Promise.resolve(true));
    const config = { get: jest.fn(() => '') };
    const guard = new LoginRateLimitGuard(
      { hit } as unknown as SlidingWindowRateLimiterService,
      config as unknown as ConfigService,
    );
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: 'a@b.c' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:ip:1.2.3.4', 30, 60);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:account:a@b.c', 5, 60);
  });

  // Same for a non-numeric/garbage value (operator typo).
  it('falls back to safe defaults when an env var is non-numeric', async () => {
    const hit = jest.fn(() => Promise.resolve(true));
    const config = { get: jest.fn(() => 'not-a-number') };
    const guard = new LoginRateLimitGuard(
      { hit } as unknown as SlidingWindowRateLimiterService,
      config as unknown as ConfigService,
    );
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: 'a@b.c' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:ip:1.2.3.4', 30, 60);
  });

  // The guard runs before @IsEmail, so an overlong body.email must not become
  // an unbounded Redis key.
  it('ignores an email longer than the RFC 5321 max, applying only the IP window', async () => {
    const { guard, hit } = buildGuard();
    const overlong = `${'a'.repeat(252)}@b.c`; // 256 chars, > 254
    const ctx = buildContext({ ip: '1.2.3.4', body: { email: overlong } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledTimes(1);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:ip:1.2.3.4', 30, 60);
  });

  // request.ip is typed string | undefined in Express; an undefined IP must
  // not collapse unrelated clients into one shared bucket.
  it('skips the IP window when request.ip is undefined, applying only the account window', async () => {
    const { guard, hit } = buildGuard();
    const ctx = buildContext({ ip: undefined, body: { email: 'a@b.c' } });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(hit).toHaveBeenCalledTimes(1);
    expect(hit).toHaveBeenCalledWith('rate_limit:login:account:a@b.c', 5, 60);
  });
});
