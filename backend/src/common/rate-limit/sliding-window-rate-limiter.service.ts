import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { RedisService } from '../redis/redis.service';

/**
 * Sliding-window log over a Redis sorted set: score = attempt timestamp (ms),
 * one member per attempt, window = [now - windowMs, now].
 *
 * The whole evict -> count -> decide -> record sequence runs as ONE Lua script.
 * A pipeline/`multi()` is not enough: the ZCARD result would come back to JS and
 * the ZADD would be a second round-trip, so two connected clients could both
 * read `count = limit - 1` and both add, admitting `limit + 1` attempts.
 *
 * Check-then-add (reject WITHOUT recording) is deliberate — under add-then-check
 * an attacker who keeps hammering after being limited would keep pushing fresh
 * timestamps and extend their own lock indefinitely, which would also keep a
 * legitimate account locked for as long as its attacker persists.
 */
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local nowMs = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, nowMs - windowMs)
local count = redis.call('ZCARD', key)
if count >= limit then
  return 0
end
redis.call('ZADD', key, nowMs, member)
redis.call('PEXPIRE', key, windowMs)
return 1
`;

@Injectable()
export class SlidingWindowRateLimiterService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Records an attempt against `key` and reports whether it is allowed.
   * Returns true when the request may proceed, false when it must be rejected.
   */
  async hit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const nowMs = Date.now();
    // Member must be unique per call: with the bare timestamp as member, two
    // attempts in the same millisecond would collapse into one ZSET entry.
    const member = `${nowMs}:${randomUUID()}`;
    const allowed = await this.redis.client.eval(
      SLIDING_WINDOW_LUA,
      1,
      key,
      String(nowMs),
      String(windowSeconds * 1000),
      String(limit),
      member,
    );
    return allowed === 1;
  }
}
