---
baseline_commit: 3bee05c
---

# Story 1.7: Login rate limiting

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want login attempts rate-limited by a Redis sliding window (per IP **and** per account),
so that brute-force attacks are throttled without ever affecting legitimate traffic — including a whole class logging in from one school network. *(FR-1, AR-10, AD-19)*

## Acceptance Criteria

1. **A Redis sliding-window limiter on the login endpoint returns 429 once the per-IP *or* per-account threshold is exceeded within the window.** Given the `POST /api/auth/login` endpoint guarded by a Redis sliding-window rate limiter keyed on **both** the client IP and the target account (login email), when attempts from one IP exceed `LOGIN_RATE_LIMIT_IP_MAX`, **or** attempts against one account exceed `LOGIN_RATE_LIMIT_ACCOUNT_MAX`, within `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, then further attempts in that window are rejected with HTTP **429** before credentials are checked; the two windows are independent (either one tripping is sufficient) and the per-account window is stricter than the per-IP window so a shared-NAT class is not locked out. [Source: epics.md#Story 1.7 AC1; ARCHITECTURE-SPINE.md#AD-19]
2. **The limiter is scoped to login only and never blocks any other path — above all the submission path.** Given the limiter, when any non-login route is called (health, refresh, logout, and every future Epic 2/3 endpoint — especially exam submission), then it is **never** touched by the login limiter: the limiter is a route-scoped guard on the login handler, **not** a global `APP_GUARD`, so no other request ever consumes a login counter or can be rejected by it. [Source: epics.md#Story 1.7 AC2; ARCHITECTURE-SPINE.md#AD-19 ("never blocks the submission path")]

## Tasks / Subtasks

- [x] **Task 1 — Rate-limit config + env documentation** (AC: 1)
  - [x] Add three variables to the repo-root `.env.example` (the single documented env file — `backend/.env.example` does not exist; compose + the Prisma CLI load repo-root `.env`, see [app.module.ts](../../backend/src/app.module.ts#L22)), each with a one-line comment:
    - `LOGIN_RATE_LIMIT_WINDOW_SECONDS=60` — sliding-window length.
    - `LOGIN_RATE_LIMIT_IP_MAX=30` — max login attempts per **IP** per window. **Lenient on purpose**: a whole class behind one school NAT egress-IP logs in at exam time (NFR-01/05) — a tight per-IP cap would lock out legitimate students. The per-account cap is the real brute-force backstop.
    - `LOGIN_RATE_LIMIT_ACCOUNT_MAX=5` — max login attempts per **account (email)** per window. **Strict** — this is what actually throttles a targeted brute-force.
  - [x] Read all three via `ConfigService.get<...>()` inside the limiter (never `process.env` directly in new code — match module style; `main.ts`'s raw `process.env` is pre-existing boot code, don't copy it). Provide the same numeric defaults in code (`?? 60 / 30 / 5`) so a missing env var degrades safely rather than disabling the limit or throwing.

- [x] **Task 2 — Redis sliding-window limiter service** (AC: 1)
  - [x] `backend/src/common/rate-limit/sliding-window-rate-limiter.service.ts`: an `@Injectable()` service with one method, e.g. `async hit(key: string, limit: number, windowSeconds: number): Promise<boolean>` returning `true` when the request is **allowed** and `false` when it must be **rejected**. Inject `RedisService` (already `@Global()`, [redis.module.ts](../../backend/src/common/redis/redis.service.ts)). Use `this.redis.client` (an `ioredis` instance).
  - [x] Implement a **sliding-window log** over a Redis **sorted set** per key, executed **atomically** via a single `client.eval(LUA, ...)` (an `ioredis` pipeline/`multi` is *not* atomic across the check-then-add and would let a burst slip the limit). The Lua script, given `KEYS[1]=key`, `ARGV[1]=nowMs`, `ARGV[2]=windowMs`, `ARGV[3]=limit`:
    1. `ZREMRANGEBYSCORE key 0 (nowMs - windowMs)` — drop entries older than the window.
    2. `local count = ZCARD key`.
    3. If `count >= limit` → return `0` (reject) **without adding** — so a flood of rejected attempts cannot keep extending the lock past the natural window (sliding-window-log semantics; do the check *before* the add).
    4. Else `ZADD key nowMs <unique-member>` (use `nowMs` as score; member must be unique per call — `nowMs .. ':' .. a random/counter suffix` — so two calls in the same millisecond both count), `PEXPIRE key windowMs`, return `1` (allow).
  - [x] Put the Lua source in a module-level `const` string in the service file; keep the service dependency-free beyond `RedisService`. **Do not add `@nestjs/throttler`, `rate-limiter-flexible`, or any new dependency** — the spine mandates a hand-rolled Redis sliding window (AD-19), consistent with Story 1.5/1.6's hand-rolled-not-library precedent. [Source: ARCHITECTURE-SPINE.md#AD-19]

- [x] **Task 3 — `LoginRateLimitGuard` (route-scoped, throws 429)** (AC: 1, 2)
  - [x] `backend/src/common/guards/login-rate-limit.guard.ts`: an `@Injectable()` `CanActivate` injecting the `SlidingWindowRateLimiterService` and `ConfigService`. Logic:
    1. Get the express `Request` from `ctx.switchToHttp().getRequest()`.
    2. **IP window:** `const ip = request.ip` (see Task 5 — `trust proxy` makes this the real client IP behind Nginx). Call `hit('rate_limit:login:ip:' + ip, IP_MAX, WINDOW)`.
    3. **Account window:** read `request.body?.email` — the guard runs **before** the `ValidationPipe`, so the body is the raw parsed JSON and `email` may be absent/malformed; if it is a non-empty string, normalize it (`String(email).trim().toLowerCase()`) and call `hit('rate_limit:login:account:' + normalized, ACCOUNT_MAX, WINDOW)`. If `email` is missing, apply **only** the IP window (never crash on bad input — the DTO validation will reject the malformed body later with a 400).
    4. If **either** `hit(...)` returned `false`, throw the 429 (see below). Otherwise `return true`.
  - [x] **429 exception:** NestJS has no built-in `TooManyRequestsException`, so throw `new HttpException('Too many login attempts, please try again later.', HttpStatus.TOO_MANY_REQUESTS)`. This is a **single-cause** limit → **no `errorCode`** (like the 401/403 of Story 1.6; do **not** add to `error-codes.ts`). The existing global exception filter shapes it into `{ statusCode: 429, message, error: 'Too Many Requests' }` automatically (it defaults `error` from `STATUS_CODES[status]`) — verified against [http-exception.filter.ts](../../backend/src/common/filters/http-exception.filter.ts#L50-L54). [Source: ARCHITECTURE-SPINE.md#AD-16]
  - [x] **Evaluate IP and account windows independently and record both hits even when one already tripped** — i.e. call both `hit(...)` before deciding, so an attacker hammering one account from many IPs still accrues on the account counter (and vice-versa). (Short-circuiting on the first failure would let the un-checked dimension escape counting.)

- [x] **Task 4 — Wire the guard onto the login route only + provide the limiter** (AC: 1, 2)
  - [x] In [auth.controller.ts](../../backend/src/modules/auth/auth.controller.ts): add `@UseGuards(LoginRateLimitGuard)` to the **`login` handler only** — **not** `refresh`, **not** `logout**, and **not** the class. (`login` keeps its existing `@Public()`; the two compose — `@Public()` opts out of the global `JwtAuthGuard`, `@UseGuards(LoginRateLimitGuard)` adds the route-scoped limiter.)
  - [x] In [auth.module.ts](../../backend/src/modules/auth/auth.module.ts): add `SlidingWindowRateLimiterService` and `LoginRateLimitGuard` to `providers`. `RedisModule` is already imported; keep it. Do **not** register the guard as an `APP_GUARD` anywhere — route-scoping is the mechanism that satisfies AC 2 (limiter never reaches the submission path). Add a one-line comment on the `@UseGuards` stating "login only — never global, must not touch the submission path (AD-19)".
  - [x] Alternative placement note: the limiter service is written under `common/` because AI-parse-enqueue (Story 2.1) will reuse the **same** `SlidingWindowRateLimiterService` with a per-teacher key — build it as a shared `common/` primitive now, but only wire the **login** guard in this story (no speculative parse wiring). [Source: ARCHITECTURE-SPINE.md#AD-19 (login + AI-parse-enqueue both use the sliding window)]

- [x] **Task 5 — Enable `trust proxy` so per-IP keying is correct behind Nginx** (AC: 1)
  - [x] In production the app sits behind Nginx (Epic 6); without `trust proxy`, `request.ip` is the **Nginx** IP for every request → the per-IP window would collapse all users into one bucket. Set `app.set('trust proxy', 1)` (trust exactly **one** hop = Nginx) in [main.ts](../../backend/src/main.ts) after `NestFactory.create` (or inside `configureApp` — but `configureApp` currently takes `INestApplication`; `set()` is an express method, reach it via `app.getHttpAdapter().getInstance().set('trust proxy', 1)` to stay typed). Trust **only** the first hop — trusting the whole `X-Forwarded-For` chain would let a client spoof its IP and dodge the per-IP window; the per-account window is the spoof-proof backstop regardless.
  - [x] Local dev has no proxy, so this is a no-op locally and does not change existing behavior; keep the change minimal and commented ("trust the single Nginx hop so request.ip is the real client — AD-19 per-IP limiting").

- [x] **Task 6 — Backend tests** (AC: 1, 2)
  - [x] `backend/src/common/rate-limit/sliding-window-rate-limiter.service.spec.ts` (unit): mock `RedisService` with a `client.eval` jest.fn(). Assert the service calls `eval` with the key/limit/window args and returns `true` when `eval` resolves `1` and `false` when it resolves `0`. (The Lua logic itself is proven end-to-end by the e2e's in-memory fake below — a unit test can't run real Lua without Redis.)
  - [x] `backend/src/common/guards/login-rate-limit.guard.spec.ts` (unit, mock the limiter service + `ConfigService` + a fake `ExecutionContext` returning a fake `Request` with `ip` and `body`): (a) both windows allow → `return true`; (b) IP window rejects (limiter returns `false` for the IP key) → throws `HttpException` with status **429**; (c) account window rejects → **429**; (d) **both** `hit(...)` are invoked even when the first returns `false` (assert call count = 2 — locks the "record both dimensions" rule); (e) missing `body.email` → only the IP `hit` is called (account key skipped), no crash. Assert the exception `getStatus() === 429` and it carries **no** `errorCode`.
  - [x] `backend/test/login-rate-limit.e2e-spec.ts` (integration, mirror the no-DB harness of [roles-guard.e2e-spec.ts](../../backend/test/roles-guard.e2e-spec.ts)): stand up a `TestingModule` with a **throwaway in-spec controller** exposing a `@UseGuards(LoginRateLimitGuard)` `POST /limited` (echoing the body) and an **un-guarded** `POST /unlimited`. Override `RedisService` with a tiny **in-memory sorted-set fake** implementing `client.eval` for the exact Lua contract (a `Map<string, Array<{score:number}>>` is enough — this keeps the established no-external-infra e2e precedent; do **not** require a running Redis). Set small limits via a test `ConfigService`. Assert end-to-end through the real global filter: `/limited` returns **200** up to the threshold then **429** (envelope = `{ statusCode: 429, message, error: 'Too Many Requests' }`, no `errorCode`); a **different** `email` in the body is **not** limited while the first is (per-account independence); `/unlimited` is **never** limited no matter how many times it's called (AC 2). Keep the controller inside the spec file — it is **not** product surface (the real login route is covered by the guard being wired in Task 4). [Source: 1-6-*.md#Task 5 e2e pattern]
  - [x] Run the full backend suite — the existing 8 unit suites / 35 tests + 2 e2e suites / 9 tests must stay green, plus the 3 new specs. `npm run lint` and `npm run build` clean.

- [x] **Task 7 — Verify** (AC: 1, 2)
  - [x] Backend: `npm test` (Jest, **Node 24 via fnm** — [[prisma7-dev-env-gotchas]]) all green; `npm run test:e2e` green; `npm run lint` clean; `npm run build` (nest build) clean.
  - [x] Manual smoke (real Postgres + Redis, seeded — `docker compose up -d postgres redis`, `npx prisma db seed`; backend `npm run start:dev`): (a) `curl -i -X POST /api/auth/login` with a wrong password for `student1@onthi12.local` (password `Password123!` is the valid one) **`ACCOUNT_MAX + 1`** times → the extra call returns **429** with the `{ statusCode: 429, error: 'Too Many Requests' }` envelope; a valid login for a **different** account from the same shell in the same window still returns **200** (per-account independence). (b) `curl` any non-login route (`/api/health`) repeatedly → **never** 429 (AC 2). Record exactly which checks were run live vs. covered only by tests — do **not** claim a live run that wasn't performed (Story 1.5/1.6 honesty note; no browser-automation tool assumed). Note that the per-IP window is hard to exercise from a single localhost shell (all curls share `127.0.0.1`) — if the per-IP `MAX` is hit first, lower `LOGIN_RATE_LIMIT_ACCOUNT_MAX` below `IP_MAX` in `.env` for the smoke, or rely on the e2e for the per-IP proof.

## Dev Notes

### Scope guardrails (read first — prevents the most likely mistakes)

- **This is login-only rate limiting.** AI-parse-enqueue rate limiting (the *other* AD-19 endpoint, per-teacher) belongs to **Story 2.1** — build the `SlidingWindowRateLimiterService` as a reusable `common/` primitive here, but wire **only** the login guard. Do not add a parse limiter, a global limiter, or limits on refresh/logout/submission. [Source: sprint-status.yaml (2-1 owns AI-parse-enqueue); ARCHITECTURE-SPINE.md#AD-19]
- **Route-scoped, never global.** The single most important correctness property (AC 2) is that the limiter is a `@UseGuards()` on the `login` handler, **not** an `APP_GUARD`. A global limiter would count — and could 429 — the submission path, the exact forbidden outcome AD-19 calls out ("never blocks the submission path"). The global `APP_GUARD` slots (`JwtAuthGuard`, `RolesGuard`) in [app.module.ts](../../backend/src/app.module.ts#L40-L41) are for *auth*; do not add a third.
- **429 is a single-cause generic error — no `errorCode`.** Use `HttpException(..., HttpStatus.TOO_MANY_REQUESTS)`; the global filter (Story 1.3) shapes it. `common/exceptions/error-codes.ts` stays empty until the first multi-cause business gate (Story 2.8 assign gate / 3.2 attempt-start). [Source: ARCHITECTURE-SPINE.md#AD-16; 1-6-*.md#Dev Notes]
- **No new dependencies, no Prisma schema change, no `AuthService`/token change.** This story adds a guard + a Redis-backed service + three config vars + one `trust proxy` line. It consumes the login route Story 1.5 built and the `RedisService` Story 1.5 already uses for refresh tokens — it does not touch how tokens are minted or how `validateUser`/`login` work. No migration.
- **The limiter must run *before* credentials are checked.** A guard runs before the controller handler (and before the `ValidationPipe`), so a throttled attacker never reaches `bcrypt.compare` / the DB — that's the point (cheap rejection, no DB load under a brute-force flood). This means the guard reads the **raw** `request.body`, not a validated `LoginDto` — handle a missing/garbage `email` defensively (Task 3 step 3).

### Why per-account must be stricter than per-IP (the load-bearing design decision)

OnThi12's real deployment is a handful of school classes (~40 students/class, 150–200 concurrent — SRS §2.3, NFR-01). Students in one classroom/lab share **one NAT egress IP**. At the real exam window (weekday evenings, NFR-05) a whole class logs in within seconds. A tight per-IP limit (e.g. 5/min) would **lock out legitimate students** — a self-inflicted denial of service, and a direct NFR-01/NFR-05 regression. So:

- **Per-IP window: lenient** (`IP_MAX=30`/min default) — catches only a crude single-host flood, sized above a plausible class-login burst.
- **Per-account window: strict** (`ACCOUNT_MAX=5`/min default) — this is the actual brute-force throttle; an attacker targeting one account is stopped regardless of how many IPs they rotate through.

Both windows are evaluated and both counters incremented every attempt; **either** tripping yields 429. This is why the two are independent Redis keys, not one combined key.

### Sliding-window algorithm (concrete, atomic)

```
common/
  rate-limit/
    sliding-window-rate-limiter.service.ts   # hit(key, limit, windowSeconds) -> allowed:boolean, via Lua
  guards/
    login-rate-limit.guard.ts                # route-scoped; keys ip + account; throws 429
```

- **Sorted-set log per key.** Score = timestamp(ms), one member per attempt. The window is `[now - windowMs, now]`. Steps, **in one `EVAL`** for atomicity: `ZREMRANGEBYSCORE` (evict expired) → `ZCARD` (count live) → if `>= limit` reject (**don't** add) → else `ZADD` + `PEXPIRE`. `PEXPIRE windowMs` lets idle keys self-clean so Redis doesn't grow unbounded.
- **Why check-then-add (reject without adding):** a brute-forcer who keeps hammering after being limited would, under add-then-check, keep pushing fresh timestamps and extend their own lock indefinitely past the window — which also risks locking a *legitimate* account whose attacker never stops. Check-then-add gives clean sliding-window-log semantics: exactly `limit` attempts per rolling window, and the window drains on its own once traffic stops. (Either policy is defensible for security; check-then-add is the more predictable and is what the tests assert.)
- **Why `EVAL`/Lua, not `multi()`/pipeline:** `ioredis` `multi().exec()` is transactional but you still read `ZCARD`'s result in JS and then decide to `ZADD` in a *second* round-trip — two connected clients can both read `count = limit-1` and both add, admitting `limit+1`. A single Lua script runs the whole read-decide-write atomically on the Redis server. `client.eval(LUA, 1, key, nowMs, windowMs, limit)`.
- **Unique member:** two attempts in the same millisecond must both count, so the ZSET member can't be the bare `nowMs` (a second `ZADD` of the same member just updates the score, losing a count). Use `nowMs .. ':' .. <suffix>` where the suffix is a redis-side counter or a value passed in from JS (`ARGV[4] = randomUUID()` / a monotonic counter). Score stays `nowMs` so eviction works.

### Getting the real client IP (`trust proxy`)

- Express's `request.ip` is only the true client when Express is told to trust the proxy. Behind Nginx (prod, Epic 6) the socket peer is Nginx; the client IP is in `X-Forwarded-For`. `app.set('trust proxy', 1)` makes Express read the **last** hop of `X-Forwarded-For` as `req.ip` — trusting exactly one proxy (Nginx). **Do not** use `true`/unbounded trust: that reads the client-controlled left-most `X-Forwarded-For`, which an attacker can spoof to a new value each request and evade the per-IP window. (The per-account window is spoof-proof regardless, which is why it's the strict one.)
- Local dev / the e2e harness have no proxy → `request.ip` is already the peer (`127.0.0.1` / `::1`), and `trust proxy` is a harmless no-op. So this change is prod-correctness only and won't alter existing test behavior.

### Architecture compliance

- **AD-19 (rate limiting, MVP not deferred):** implements the **login** half — "a Redis sliding-window rate limiter guards login (per IP + per account) … a rejected request returns 429; the limiter never blocks the submission path." Per-IP **and** per-account are both required by the spine wording, not either/or. The AI-parse-enqueue half is Story 2.1. [Source: ARCHITECTURE-SPINE.md#AD-19]
- **AD-16 (envelope/errors):** the 429 is a generic single-cause error — no `errorCode`; the existing global filter builds the envelope. [Source: ARCHITECTURE-SPINE.md#AD-16]
- **AD-05/06 (module boundaries):** the limiter service + guard are cross-cutting `common/` infrastructure (like the guards from Story 1.6, `RedisModule`, filters) — not owned by a feature module. The login guard is wired in `auth.module.ts`/`auth.controller.ts` because that's where the login route lives; the service stays reusable in `common/` for Story 2.1. [Source: ARCHITECTURE-SPINE.md#Design Paradigm layer table]
- **NFR-01/NFR-05 (submission integrity + availability during exam windows):** the two guardrails above — route-scoping (never touches submission) and lenient-per-IP/strict-per-account (never locks out a shared-NAT class) — are the concrete NFR protections; they are acceptance-relevant, not just nice-to-have. [Source: SRS §4 NFR-01/05; ARCHITECTURE-SPINE.md#AD-19 "never blocks the submission path"]

### Previous story intelligence (Stories 1.1–1.6)

- **`RedisService` is `@Global()` and exposes a raw `ioredis` client at `.client`** — inject `RedisService`, call `this.redis.client.eval(...)`. `set/get/del/EX` are already used for refresh tokens ([auth.service.ts](../../backend/src/modules/auth/auth.service.ts#L98-L145)); `eval`/`zadd`/`zcard`/`zremrangebyscore`/`pexpire` are all standard ioredis methods on the same client. [verified: [redis.service.ts](../../backend/src/common/redis/redis.service.ts)]
- **The login route is `POST /api/auth/login`, `@Public()`, `@HttpCode(200)`, body = `LoginDto { email, password }`** — email is `@IsEmail()` but **not** normalized/lowercased, so the rate-limit account key must lowercase+trim itself for case-insensitive keying. [verified: [auth.controller.ts](../../backend/src/modules/auth/auth.controller.ts#L16-L22), [login.dto.ts](../../backend/src/modules/auth/dto/login.dto.ts)]
- **`@Public()` and `@UseGuards()` compose cleanly** — `@Public()` is read by the global `JwtAuthGuard` (skip auth); `@UseGuards(LoginRateLimitGuard)` adds a route-scoped guard that runs after the global guards. Both on the same handler is fine and is exactly the intended wiring. [verified: Story 1.6 guard model, [app.module.ts](../../backend/src/app.module.ts)]
- **The global exception filter already handles any `HttpException` including 429** — `error` defaults from `STATUS_CODES[status]` (→ `'Too Many Requests'`), `statusCode` is authoritative, and only `BusinessException` adds `errorCode`. A plain `HttpException(msg, 429)` yields `{ statusCode: 429, message: msg, error: 'Too Many Requests' }`. No filter change needed. [verified: [http-exception.filter.ts](../../backend/src/common/filters/http-exception.filter.ts#L41-L59)]
- **E2E precedent is no-DB, in-spec throwaway controller, real global wiring** — [roles-guard.e2e-spec.ts](../../backend/test/roles-guard.e2e-spec.ts) is the template: a `TestingModule` with an in-spec controller, `configureApp`, supertest; no Postgres/Redis. Follow it exactly, overriding `RedisService` with an in-memory `eval` fake (login needs no DB because the guard rejects before `AuthService`). [verified: [app.e2e-spec.ts](../../backend/test/app.e2e-spec.ts), 1-6-*.md]
- **Redis is mocked in unit specs with plain `jest.fn()`s on `client.*`** — [auth.service.spec.ts](../../backend/src/modules/auth/auth.service.spec.ts#L34) mocks `{ client: { get, set, del } }`; add `eval` the same way for the limiter unit spec. [verified: auth.service.spec.ts]
- **`ConfigService.get` is mocked as `{ get: jest.fn((k) => TABLE[k]) }`** in specs — reuse for the limiter's three new keys. [verified: auth.service.spec.ts:44]
- **Dev-Agent-Record honesty is reviewed every story** — record only commands actually run with real output (exact suite/test counts, exact lint result); flag anything not performed (e.g. a live per-IP smoke that localhost can't easily exercise). [Source: 1-5-*.md, 1-6-*.md#Dev Agent Record]
- **Node 24 via `fnm` for all builds/tests** (system Node fails engine checks). [[prisma7-dev-env-gotchas]]

### Project Structure Notes

**New (backend):**
- `backend/src/common/rate-limit/sliding-window-rate-limiter.service.ts`
- `backend/src/common/rate-limit/sliding-window-rate-limiter.service.spec.ts`
- `backend/src/common/guards/login-rate-limit.guard.ts`
- `backend/src/common/guards/login-rate-limit.guard.spec.ts`
- `backend/test/login-rate-limit.e2e-spec.ts`

**Modified (backend):**
- `backend/src/modules/auth/auth.controller.ts` (+`@UseGuards(LoginRateLimitGuard)` on `login` only)
- `backend/src/modules/auth/auth.module.ts` (+`SlidingWindowRateLimiterService`, `LoginRateLimitGuard` in `providers`)
- `backend/src/main.ts` (+`trust proxy` = 1)

**Modified (repo root):**
- `.env.example` (+`LOGIN_RATE_LIMIT_WINDOW_SECONDS`, `LOGIN_RATE_LIMIT_IP_MAX`, `LOGIN_RATE_LIMIT_ACCOUNT_MAX`)

No Prisma migration, no `AuthService`/token change, **no new dependencies**.

### Testing requirements

- **Rate limiting is not one of PROJECT-STANDARDS §7's three merge-blocking Must-Have areas** (those are grading/submission, role access, assign gate) — but AC 2's "never blocks the submission path" is a *protection of* the highest-risk area (NFR-01/04), so the e2e's `/unlimited`-never-limited assertion is the load-bearing test here and must not be skipped.
- **The non-obvious locks:** (1) **Independence** — a per-account 429 must fire even from a fresh IP, and vice-versa; test each dimension in isolation (guard unit (b)/(c) + e2e different-email case). (2) **Both counters increment every attempt** — assert the guard calls `hit` twice even when the first returns `false` (unit (d)); a short-circuit is a real, silent bug that lets the un-checked dimension escape. (3) **Route-scoping** — only an e2e with a genuinely un-guarded route proves the limiter can't leak onto other paths; a unit test of the guard can't. (4) **429 shape** — assert `statusCode: 429`, `error: 'Too Many Requests'`, and **absence** of `errorCode`.
- **No new test infrastructure** — Jest + supertest already present; the in-memory Redis `eval` fake lives inside the e2e spec (no `ioredis-mock` dependency).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.7: Login rate limiting] — the 2 ACs
- [Source: ARCHITECTURE-SPINE.md#AD-19] — Redis sliding-window limiter on login (per IP + per account) and AI-parse-enqueue (per teacher); 429 on reject; **never blocks the submission path**; MVP not deferred
- [Source: ARCHITECTURE-SPINE.md#AD-16] — generic 429 carries no `errorCode`; global exception filter shapes the envelope
- [Source: ARCHITECTURE-SPINE.md#Design Paradigm layer table] — guards/limiters live in `common/` cross-cutting infrastructure
- [Source: SRS §9.6, §4 NFR-01/NFR-05/NFR-09] — rate limiting done in MVP for login + AI parsing; submission throughput and exam-window availability constraints that force lenient-per-IP
- [Source: _bmad-output/implementation-artifacts/1-6-role-based-access-enforcement-and-isolation.md] — guard model, `@Public()` composition, no-DB e2e + throwaway-controller pattern, single-cause-no-`errorCode` convention, honesty note
- [Source: _bmad-output/implementation-artifacts/1-5-email-password-login-with-jwt-and-role-routing.md] — the login route + `RedisService` usage this story extends
- Codebase state verified directly: `backend/src/modules/auth/{auth.controller.ts,auth.service.ts,auth.module.ts,dto/login.dto.ts}`, `backend/src/common/redis/{redis.service.ts,redis.module.ts}`, `backend/src/common/filters/http-exception.filter.ts`, `backend/src/common/configure-app.ts`, `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/test/{app.e2e-spec.ts,roles-guard.e2e-spec.ts}`, `backend/src/modules/auth/auth.service.spec.ts`, root `.env.example`, `backend/package.json`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, bmad-dev-story workflow)

### Debug Log References

All commands run with Node 24.18.0 via `fnm`, from `backend/`.

| Command | Result |
|---|---|
| `npm test` (baseline, before any change) | 8 suites / 35 tests passed |
| `npm test` (final) | **10 suites / 49 tests passed** (+2 suites, +14 tests) |
| `npm run test:e2e` (final) | **3 suites / 15 tests passed** (baseline 2 suites / 9 tests; +1 suite, +6 tests) |
| `npm run lint` | clean, 0 problems |
| `npm run build` (`nest build`) | clean, no output |

Two failures were hit and fixed during development, both in my own test/wiring code, not in the shipped logic:

1. **e2e probe controller returned 201, not 200** — the throwaway `POST /limited` had no `@HttpCode`, so Nest's POST default (201) fought the `.expect(200)` assertions. Fixed by adding `@HttpCode(HttpStatus.OK)` to the probe handlers, which also makes the probe mirror the real `POST /api/auth/login` (which is `@HttpCode(200)`).
2. **`trust proxy` lint/type failure in `main.ts`** — the story suggested `app.getHttpAdapter().getInstance().set(...)`, but `getInstance()` is typed `any` here, so `@typescript-eslint/no-unsafe-call` + `no-unsafe-member-access` failed the lint gate, and `getInstance<Application>()` does not accept a type argument on the `HttpServer` interface (build error TS2558). Resolved by typing the app itself: `NestFactory.create<NestExpressApplication>(AppModule)` then the natively-typed `app.set('trust proxy', 1)`. Same runtime effect, fully typed, no cast.

### Completion Notes List

**What was built** — a route-scoped login throttle backed by a hand-rolled Redis sliding window. No new dependencies, no Prisma migration, no change to `AuthService` or token minting.

- **`SlidingWindowRateLimiterService`** (`common/rate-limit/`) — one method, `hit(key, limit, windowSeconds) -> allowed`. The whole evict → count → decide → record sequence runs as a single `EVAL` of a module-level Lua constant, so it is atomic on the Redis server. A `multi()`/pipeline was deliberately rejected: the `ZCARD` result would return to JS and the `ZADD` would be a second round-trip, letting two connected clients both read `count = limit - 1` and both admit, for `limit + 1` attempts. Built in `common/` (not `modules/auth/`) because Story 2.1 reuses it for the per-teacher AI-parse-enqueue window — but no speculative parse wiring was added here.
- **Check-then-add** (reject *without* recording) is the implemented policy, and it is observable: in the live smoke the per-IP counter trips at exactly 30 and then **stays pinned at 30** across four further rejected attempts. Under add-then-check an attacker who keeps hammering would keep pushing fresh timestamps and extend their own lock indefinitely — which would also hold a legitimate account locked for as long as its attacker persisted.
- **Unique ZSET member** — `${nowMs}:${randomUUID()}`, score stays `nowMs`. With the bare timestamp as member, two attempts inside one millisecond would collapse into a single entry and one hit would be silently lost.
- **`LoginRateLimitGuard`** (`common/guards/`) — two independent Redis keys (`rate_limit:login:ip:<ip>`, `rate_limit:login:account:<email>`), either tripping yields 429. Both `hit(...)` calls are issued via `Promise.all` **before** the decision: short-circuiting on the first rejection would stop the un-checked dimension accruing, so an attacker hammering one account from many IPs could keep the account counter permanently cold. That rule is locked by a unit test asserting `hit` is called twice even when the first returns `false`.
- **Raw-body defensiveness** — the guard runs before the `ValidationPipe`, so `request.body` is unvalidated JSON. A missing body, a missing `email`, a non-string `email` (e.g. `{ $ne: null }`), and a whitespace-only `email` all fall back to IP-only limiting instead of crashing or keying on garbage; the DTO still rejects the malformed body with a 400 afterwards. The account key is `trim().toLowerCase()`-normalized because `LoginDto` does not normalize email — otherwise `A@b.c` and `a@b.c` would each get a full window.
- **429 shape** — `HttpException(msg, HttpStatus.TOO_MANY_REQUESTS)`; single-cause, so **no `errorCode`** (AD-16) and `error-codes.ts` stays empty. The existing global filter builds `{ statusCode: 429, message, error: 'Too Many Requests' }` unaided; no filter change was needed. Verified live and in the e2e.
- **`trust proxy` = 1** in `main.ts` — exactly one hop (Nginx). Unbounded trust would read the client-controlled left-most `X-Forwarded-For`, letting an attacker mint a fresh IP per request and evade the per-IP window; the per-account window is the spoof-proof backstop regardless. No-op locally (no proxy), so no existing behavior changed.
- **Config** — three vars added to the repo-root `.env.example`, read via `ConfigService` with in-code defaults (60 / 30 / 5) so a missing var degrades to a working limit rather than disabling the throttle or throwing at request time. A dedicated unit test covers the all-defaults path.

**AC 2 (the load-bearing property).** The limiter is a `@UseGuards()` on the `login` handler only — **not** an `APP_GUARD`, and not on `refresh`/`logout`/the controller class. `app.module.ts` still has exactly its two auth `APP_GUARD` slots; no third was added. This is what keeps the limiter off the submission path. It is proven three ways: an e2e route that is genuinely un-guarded stays 200 through `IP_MAX * 3` calls and stays open even after the guarded route is throttled; and live, `/api/health` returned 200 on 40/40 calls while login was 429-ing.

**Verification — what was run live vs. covered only by tests.**

*Executed live* (Docker Desktop started, `docker compose up -d postgres redis`, `prisma migrate deploy` + `db seed`, backend `npm run start:dev` on real Postgres + Redis):

- 6 wrong-password `POST /api/auth/login` for `student1@onthi12.local` → attempts 1–5 = **401**, attempt 6 = **429** with exactly `{"statusCode":429,"message":"Too many login attempts, please try again later.","error":"Too Many Requests"}` and no `errorCode`.
- **Per-account independence**: with `student1` throttled, a valid `student2@onthi12.local` login from the same shell/IP in the same window returned **200** with a token pair.
- **Case-insensitive keying**: `STUDENT1@ONTHI12.LOCAL` with the *correct* password returned **429** — it landed on the same normalized counter, confirming the throttle can't be dodged by changing case.
- **AC 2**: 40 consecutive `GET /api/health` calls → **200 × 40**, zero 429, while login was throttled.
- **Per-IP window** (the story flagged this as hard to exercise from one localhost shell — it *was* exercised, by using distinct emails so the account window never tripped): the IP counter climbed 8 → 30 over 22 attempts, all 401, then attempts 23–26 returned **429** with the counter frozen at 30.
- **Redis state inspected directly**: keys `rate_limit:login:ip:::1`, `rate_limit:login:account:student1@onthi12.local`, `rate_limit:login:account:student2@onthi12.local`; `PTTL` set on both (PEXPIRE self-cleaning confirmed); ZSET members are `<ms>:<uuid>` with the millisecond as score.
- **Window drains and recovers**: waited for the IP key to expire, then `student1` — previously throttled — logged in normally with **200**.

*Covered by automated tests only, not exercised live:*

- **Non-default config values.** The live smoke ran on the in-code defaults (60 / 30 / 5) because `backend/.env` has no rate-limit vars; I deliberately did not edit that local file. That `ConfigService` values are actually honored is proven by the e2e, which injects `IP_MAX=6` / `ACCOUNT_MAX=2` via `ConfigModule` and observes the limits move accordingly.
- **The real Lua script's concurrency guarantee.** Live smoke was sequential curl; the atomicity argument for `EVAL`-over-`multi()` is a design property, not something a serial smoke can falsify. The unit spec asserts the whole window reaches Redis as a single `eval` call with the right args.
- **Behind-Nginx `trust proxy`.** There is no proxy locally, so `request.ip` was `::1` throughout. The one-hop setting is prod-correctness for Epic 6 and cannot be verified until Nginx exists.

No browser automation was used or implied; nothing above is claimed that was not actually run.

**Test inventory added (20 tests across 3 specs):**

- `sliding-window-rate-limiter.service.spec.ts` (4) — allow/reject mapping from the script's 1/0, single-`EVAL` atomicity with correct key/now/window/limit args, and a distinct member per call.
- `login-rate-limit.guard.spec.ts` (10) — both-windows-allow; IP rejection → 429; account rejection → 429; 429 carries no `errorCode`; **both** `hit`s invoked when the first already failed; missing `email`, missing body, and non-string `email` each fall back to IP-only; account-key normalization; all-defaults fallback.
- `login-rate-limit.e2e-spec.ts` (6) — through the real global filter, with an in-spec in-memory ZSET fake implementing the exact Lua contract (no running Redis, matching the established no-external-infra precedent): threshold then 429; the full 429 envelope with no `errorCode` and no `data`; a different account unaffected while the first is throttled; the per-IP window tripping; and the two AC-2 assertions — an un-guarded route never limited, and still open after the guarded one is throttled.

**Notes for review / follow-ups (nothing blocking):**

- `main.ts` still opens its own second `ioredis` connection purely to log connect/error, separate from `RedisService`'s client. Pre-existing from Story 1.5, untouched here — flagged, not changed.
- Redis being down would make `hit()` reject the promise and surface a 500 on login rather than failing open. Not in scope for this story (no AC covers limiter-dependency degradation), but it is the natural companion to the NFR-11 circuit-breaker work in Story 2.3.

### File List

**New (backend):**
- `backend/src/common/rate-limit/sliding-window-rate-limiter.service.ts`
- `backend/src/common/rate-limit/sliding-window-rate-limiter.service.spec.ts`
- `backend/src/common/guards/login-rate-limit.guard.ts`
- `backend/src/common/guards/login-rate-limit.guard.spec.ts`
- `backend/test/login-rate-limit.e2e-spec.ts`

**Modified (backend):**
- `backend/src/modules/auth/auth.controller.ts` — `@UseGuards(LoginRateLimitGuard)` on the `login` handler only
- `backend/src/modules/auth/auth.module.ts` — `SlidingWindowRateLimiterService` + `LoginRateLimitGuard` added to `providers`
- `backend/src/main.ts` — typed as `NestExpressApplication`; `app.set('trust proxy', 1)`

**Modified (repo root):**
- `.env.example` — `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, `LOGIN_RATE_LIMIT_IP_MAX`, `LOGIN_RATE_LIMIT_ACCOUNT_MAX`

**Modified (tracking):**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — `1-7-login-rate-limiting`: `ready-for-dev` → `in-progress` → `review`
- `_bmad-output/implementation-artifacts/1-7-login-rate-limiting.md` — this file

### Review Findings

- [x] [Review][Defer] Redis outage takes down all login (fail-closed, no circuit breaker) — `hit()` awaiting `Promise.all` in `canActivate` has no try/catch; a Redis blip/reject makes the guard throw unhandled, and the global filter returns 500 for every login attempt, not just throttled ones. Pre-Story-1.7 behavior did not depend on Redis to issue an access token. [common/guards/login-rate-limit.guard.ts:76] — deferred: Story 2.3 owns a general circuit-breaker/graceful-degradation mechanism for external-service failures (NFR-11); the login guard should reuse that instead of a one-off fix here.
- [x] [Review][Defer] A legitimate shared-NAT student can self-lock their own account purely from IP-level rejections — both `hit()` calls run unconditionally via `Promise.all` (per Task 3's explicit anti-evasion requirement), so once the lenient per-IP window (30) saturates during a class login rush, further IP-rejected attempts still consume the strict per-account window (5) of the retrying student. Enough retries during IP saturation can 429-lock a student who never entered a wrong password — the exact "don't lock out legitimate students" scenario the story's design section calls load-bearing (NFR-01/05). [common/guards/login-rate-limit.guard.ts:50-76] — deferred: impact is bounded to a single self-healing 60s window and only manifests when the per-IP window (30/min) is already saturated; accepted as the intended trade-off of Task 3's anti-evasion requirement (recording both dimensions regardless of which one already tripped).
- [x] [Review][Patch] Attacker-controlled `email` has no length cap before being used as a Redis key [common/guards/login-rate-limit.guard.ts:58-63] — fixed: capped at 254 chars (RFC 5321), overlong values fall back to IP-only.
- [x] [Review][Patch] `?? DEFAULT` does not catch empty-string/non-numeric env values — a blank or malformed `LOGIN_RATE_LIMIT_*` var can crash the limiter (Lua `tonumber(nil)`) or silently zero the limit, taking down all logins [common/guards/login-rate-limit.guard.ts:40-47] — fixed: `getPositiveIntConfig` helper explicitly parses and validates (`Number.isFinite`, `> 0`), falling back to the default on any invalid value.
- [x] [Review][Patch] `ConfigService.get<number>(...)` is a compile-time-only cast — real `.env` values are strings, and this runtime path has zero test coverage [common/guards/login-rate-limit.guard.ts:40-47] — fixed: same `getPositiveIntConfig` helper now parses explicitly with `Number(...)`; covered by new blank/non-numeric-env unit tests.
- [x] [Review][Patch] `request.ip` can be `undefined`, collapsing all such clients into a single shared rate-limit bucket [common/guards/login-rate-limit.guard.ts:52] — fixed: the IP dimension is skipped (not defaulted to a shared key) when `request.ip` is falsy.
- [x] [Review][Patch] `expect(error).not.toHaveProperty('errorCode')` on a plain `HttpException` is vacuously true and asserts nothing [common/guards/login-rate-limit.guard.spec.ts:64] — fixed: assertion now checks `not.toBeInstanceOf(BusinessException)`, the only class that ever attaches `errorCode` (AD-16).
- [x] [Review][Defer] `trust proxy=1` is spoofable via a direct `X-Forwarded-For` header today, since docker-compose publishes port 3000 directly and no Nginx service exists yet (Epic 6 not built) — deferred, pre-existing scope boundary (story explicitly frames this as prod-correctness for Epic 6); gate: do not deploy `trust proxy=1` behind an internet-reachable port 3000 before the Epic 6 Nginx layer lands. [main.ts:15]

## Change Log

| Date | Change |
|---|---|
| 2026-07-21 | Implemented Story 1.7 — Redis sliding-window login rate limiting (per IP + per account), route-scoped `LoginRateLimitGuard` returning 429, reusable `SlidingWindowRateLimiterService` in `common/`, `trust proxy` = 1, three config vars. 20 new tests (10 unit guard, 4 unit limiter, 6 e2e). Backend suite: 10 suites / 49 tests + 3 e2e suites / 15 tests green; lint and build clean. Status → review. |
| 2026-07-23 | Code review (bmad-code-review): 2 decision-needed (Redis-outage fail-closed; NAT-shared account self-lock) both resolved by Admin as **defer** with reasons recorded; 5 patch findings fixed — email length cap (254 chars, RFC 5321) before Redis keying, explicit positive-int env-var parsing/validation (`getPositiveIntConfig`, replaces the `?? DEFAULT`/`ConfigService.get<number>` compile-time-only cast), `request.ip` undefined now skips the IP dimension instead of collapsing into a shared bucket, and a vacuous test assertion replaced with a real `BusinessException`-instance check (AD-16). 1 item deferred (`trust proxy` spoofable until Epic 6 Nginx exists — pre-existing scope boundary). 3 findings dismissed as noise. Added 4 new unit tests for the patched branches — backend suite now 10 suites / 53 tests + 3 e2e suites / 15 tests green; lint and build clean. Status → done. |
