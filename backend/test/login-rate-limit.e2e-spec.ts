import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  INestApplication,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { LoginRateLimitGuard } from './../src/common/guards/login-rate-limit.guard';
import { SlidingWindowRateLimiterService } from './../src/common/rate-limit/sliding-window-rate-limiter.service';
import { RedisService } from './../src/common/redis/redis.service';
import { configureApp } from './../src/common/configure-app';

const WINDOW_SECONDS = 60;
const IP_MAX = 6;
const ACCOUNT_MAX = 2;

// Throwaway controller — exists only to prove route-scoping end-to-end: the real
// login route is covered by the guard being wired in auth.controller.ts. `/limited`
// stands in for login, `/unlimited` for every other path (health, refresh, and
// above all exam submission) that the limiter must never touch (AC 2).
@Controller()
class RateLimitProbeController {
  // @HttpCode(200) mirrors the real POST /api/auth/login handler.
  @UseGuards(LoginRateLimitGuard)
  @Post('limited')
  @HttpCode(HttpStatus.OK)
  limited(@Body() body: Record<string, unknown>): Record<string, unknown> {
    return body;
  }

  @Post('unlimited')
  @HttpCode(HttpStatus.OK)
  unlimited(): { ok: boolean } {
    return { ok: true };
  }
}

/**
 * In-memory stand-in for the Redis sorted set, implementing exactly the Lua
 * contract of SlidingWindowRateLimiterService — so the real script's semantics
 * (evict -> count -> reject-without-adding -> add) are exercised end-to-end
 * without requiring a running Redis (matches the no-external-infra e2e precedent).
 */
function buildRedisFake() {
  const sets = new Map<string, { score: number; member: string }[]>();
  const evalFn = jest.fn(
    (
      _script: string,
      _numKeys: number,
      key: string,
      nowMsArg: string,
      windowMsArg: string,
      limitArg: string,
      member: string,
    ): Promise<number> => {
      const nowMs = Number(nowMsArg);
      const windowMs = Number(windowMsArg);
      const limit = Number(limitArg);

      const kept = (sets.get(key) ?? []).filter(
        (entry) => entry.score > nowMs - windowMs,
      );
      sets.set(key, kept);
      if (kept.length >= limit) return Promise.resolve(0);
      kept.push({ score: nowMs, member });
      return Promise.resolve(1);
    },
  );
  return { client: { eval: evalFn } };
}

describe('LoginRateLimitGuard route-scoped wiring (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              LOGIN_RATE_LIMIT_WINDOW_SECONDS: WINDOW_SECONDS,
              LOGIN_RATE_LIMIT_IP_MAX: IP_MAX,
              LOGIN_RATE_LIMIT_ACCOUNT_MAX: ACCOUNT_MAX,
            }),
          ],
        }),
      ],
      controllers: [RateLimitProbeController],
      providers: [
        SlidingWindowRateLimiterService,
        LoginRateLimitGuard,
        { provide: RedisService, useValue: buildRedisFake() },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const attempt = (email: string) =>
    request(app.getHttpServer()).post('/api/limited').send({ email });

  it('allows attempts up to the per-account limit, then returns 429', async () => {
    for (let i = 0; i < ACCOUNT_MAX; i++) {
      await attempt('a@b.c').expect(200);
    }
    await attempt('a@b.c').expect(429);
  });

  it('shapes the 429 through the global filter with no errorCode', async () => {
    for (let i = 0; i < ACCOUNT_MAX; i++) {
      await attempt('a@b.c').expect(200);
    }
    const res = await attempt('a@b.c').expect(429);
    const body = res.body as Record<string, unknown>;
    expect(body.statusCode).toBe(429);
    expect(body.error).toBe('Too Many Requests');
    expect(body.message).toEqual(expect.any(String));
    expect(body).not.toHaveProperty('errorCode');
    expect(body).not.toHaveProperty('data');
  });

  // Independence: throttling one account must not throttle another, even from
  // the same IP — otherwise one attacker could lock out a whole class.
  it('does not limit a different account while the first is throttled', async () => {
    for (let i = 0; i < ACCOUNT_MAX; i++) {
      await attempt('a@b.c').expect(200);
    }
    await attempt('a@b.c').expect(429);
    await attempt('other@b.c').expect(200);
  });

  // The per-IP window is lenient but real: enough distinct accounts from one IP
  // eventually trips it (a crude single-host flood).
  it('trips the per-IP window once enough distinct accounts are tried', async () => {
    for (let i = 0; i < IP_MAX; i++) {
      await attempt(`user${i}@b.c`).expect(200);
    }
    await attempt('fresh@b.c').expect(429);
  });

  // AC 2 — the load-bearing assertion: the limiter is a route-scoped guard, not
  // an APP_GUARD, so no other path (least of all submission) can ever be 429'd.
  it('never limits an un-guarded route, however many times it is called', async () => {
    for (let i = 0; i < IP_MAX * 3; i++) {
      await request(app.getHttpServer()).post('/api/unlimited').expect(200);
    }
  });

  it('leaves the un-guarded route open even after the guarded one is throttled', async () => {
    for (let i = 0; i < IP_MAX + 1; i++) {
      await attempt(`user${i}@b.c`);
    }
    await attempt('anyone@b.c').expect(429);
    await request(app.getHttpServer()).post('/api/unlimited').expect(200);
  });
});
