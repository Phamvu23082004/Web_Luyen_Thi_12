import { RedisService } from '../redis/redis.service';
import { SlidingWindowRateLimiterService } from './sliding-window-rate-limiter.service';

function buildService() {
  const evalFn = jest.fn();
  const redis = { client: { eval: evalFn } };
  const service = new SlidingWindowRateLimiterService(
    redis as unknown as RedisService,
  );
  return { service, evalFn };
}

describe('SlidingWindowRateLimiterService', () => {
  it('allows the request when the script returns 1', async () => {
    const { service, evalFn } = buildService();
    evalFn.mockResolvedValue(1);
    await expect(
      service.hit('rate_limit:login:ip:1.2.3.4', 5, 60),
    ).resolves.toBe(true);
  });

  it('rejects the request when the script returns 0', async () => {
    const { service, evalFn } = buildService();
    evalFn.mockResolvedValue(0);
    await expect(
      service.hit('rate_limit:login:ip:1.2.3.4', 5, 60),
    ).resolves.toBe(false);
  });

  // The whole check-then-add sequence must reach Redis as ONE script: a
  // pipeline/multi would read ZCARD in JS and ZADD in a second round-trip,
  // letting two concurrent clients both admit the (limit)th request.
  it('runs the window atomically via a single EVAL with key, now, window and limit', async () => {
    const { service, evalFn } = buildService();
    evalFn.mockResolvedValue(1);
    const before = Date.now();
    await service.hit('rate_limit:login:account:a@b.c', 5, 60);
    const after = Date.now();

    expect(evalFn).toHaveBeenCalledTimes(1);
    const [script, numKeys, key, nowMs, windowMs, limit, member] = evalFn.mock
      .calls[0] as [string, number, string, string, string, string, string];
    expect(typeof script).toBe('string');
    expect(numKeys).toBe(1);
    expect(key).toBe('rate_limit:login:account:a@b.c');
    expect(Number(nowMs)).toBeGreaterThanOrEqual(before);
    expect(Number(nowMs)).toBeLessThanOrEqual(after);
    expect(windowMs).toBe('60000'); // seconds converted to ms for PEXPIRE/scores
    expect(limit).toBe('5');
    expect(member).toEqual(expect.any(String));
  });

  // Two attempts inside the same millisecond must both count — if the ZSET
  // member were the bare timestamp, the second ZADD would just update the score
  // and silently lose a hit.
  it('passes a distinct member on every call', async () => {
    const { service, evalFn } = buildService();
    evalFn.mockResolvedValue(1);
    await service.hit('k', 5, 60);
    await service.hit('k', 5, 60);
    const first = (evalFn.mock.calls[0] as string[])[6];
    const second = (evalFn.mock.calls[1] as string[])[6];
    expect(first).not.toBe(second);
  });
});
