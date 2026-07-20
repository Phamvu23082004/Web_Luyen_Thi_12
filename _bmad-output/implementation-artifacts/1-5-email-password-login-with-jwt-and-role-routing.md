---
baseline_commit: 8fd86a4
---

# Story 1.5: Email/password login with JWT and role routing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to log in with email and password,
so that I reach my own Student or Teacher experience. *(FR-1)*

## Acceptance Criteria

1. **Valid credentials issue a token pair and land the user on their role home.** Given valid credentials, the password is verified against the stored bcrypt hash (never plaintext), an access token carrying `sub` (userId) + verified `role` (minimal claims — no class membership) is issued, and the frontend navigates to the role-specific home (`/student` or `/teacher`). [Source: epics.md#Story 1.5 AC1; ARCHITECTURE-SPINE.md#AD-17]
2. **Invalid credentials are rejected generically.** Given an unknown email OR a wrong password, login is rejected with the same message either way (never revealing which field was wrong), and no token is issued. [Source: epics.md#Story 1.5 AC2]
3. **Token pair lifecycle: short-TTL stateless access token, hashed-in-Redis rotated refresh token.** Given a successful login, the access token is verified statelessly per request (no store hit, valid until its short TTL expires) and a longer-lived refresh token is issued, stored **hashed** in Redis keyed by user, and **rotated** (old hash replaced) on every `/api/auth/refresh` call. Logout revokes only the stored refresh token — the still-valid access token simply expires on its own short TTL. [Source: epics.md#Story 1.5 AC3; ARCHITECTURE-SPINE.md#AD-17]
4. **Client-supplied `role` is never trusted.** Given a `role` value included in the login request body, it is ignored — role is read only from the DB row (at login) or the verified token (thereafter), never from client input. [Source: epics.md#Story 1.5 AC4; ARCHITECTURE-SPINE.md#AD-10, #AD-17]

## Tasks / Subtasks

- [x] **Task 1 — JWT deps, env vars, and the two-secret token design** (AC: 1, 3)
  - [x] In `backend/`, add `@nestjs/jwt` (pin `^11.x` to match the NestJS 11 pin — verified current stable `11.0.2`; check `npm view @nestjs/jwt version` doesn't drift before installing). No Passport/`passport-jwt` needed — this story hand-signs/verifies via `JwtService` directly (see Dev Notes "Why no Passport/guard yet").
  - [x] Add to `.env.example` (repo root — mirrors the existing `JWT_SECRET`/`JWT_EXPIRES_IN` block): `JWT_REFRESH_SECRET` (a **second, distinct** secret) and `JWT_REFRESH_EXPIRES_IN` (e.g. `7d`). Using a different secret for refresh tokens (not just a different `expiresIn`) prevents an access token from being replayed as a refresh token or vice versa.
  - [x] Re-examine the existing `JWT_EXPIRES_IN=1d` default: AD-17 explicitly calls the access token "short-TTL". Change the `.env.example` default to a genuinely short value (e.g. `15m`) — `1d` was a placeholder from Story 1.1's scaffold, not a considered choice. Read both via `ConfigService`, never `process.env` directly in new auth code (match the rest of the module in spirit; `main.ts`'s raw `process.env.REDIS_URL` access is pre-existing, don't copy it into new code).
  - [x] No docker-compose changes needed — `api`/`worker` already load `.env` via `env_file` (optional), and the new vars follow the same `JWT_SECRET`/`JWT_EXPIRES_IN` pattern already flowing through that path.

- [x] **Task 2 — Injectable Redis client (first real usage — `main.ts`'s client is boot-log only)** (AC: 3)
  - [x] Create `backend/src/common/redis/redis.service.ts` + `backend/src/common/redis/redis.module.ts`, mirroring `backend/src/prisma/prisma.module.ts`'s `@Global()` + single-provider pattern exactly (`RedisService extends` nothing — wrap an `ioredis` client as a constructor-created field, connect in `onModuleInit`, add `onModuleDestroy` to `quit()`). Register `RedisModule` in `app.module.ts` alongside `PrismaModule`.
  - [x] `main.ts` already opens its own throwaway `ioredis` client purely to log "Redis connected"/error at boot — that client is unrelated to DI and stays as-is (harmless, don't touch it; not worth the churn of wiring the DI container into `main.ts`'s bootstrap function for a boot log). The new `RedisService` is what `AuthModule` (and later Story 1.7's rate limiter) actually inject and use.

- [x] **Task 3 — `AuthService`: login, refresh, logout** (AC: 1, 2, 3, 4)
  - [x] `validateUser(email, password)`: `prisma.user.findUnique({ where: { email } })`; if no row OR `bcrypt.compare(password, user.passwordHash)` (from the existing `bcryptjs` dep — same library/cost-10 hash the seed script writes, [[prisma7-dev-env-gotchas]]) fails, throw the **same** `UnauthorizedException('Invalid email or password')` in both branches — no `errorCode` (AD-16: generic single-cause error, plain built-in exception). Also compares against a dummy hash when the user is unknown, so an unknown-email lookup and a wrong-password lookup take the same bcrypt cost (closes a response-time side channel AC 2's "same message" alone doesn't close).
  - [x] `login(user)`: sign an access token `{ sub: user.id, role: user.role }` with `JWT_SECRET`/`JWT_EXPIRES_IN`, and a refresh token `{ sub: user.id }` with `JWT_REFRESH_SECRET`/`JWT_REFRESH_EXPIRES_IN`. Hash the refresh token (plain `crypto.createHash('sha256').update(token).digest('hex')` — **not** bcrypt; the refresh token is already a high-entropy random-looking JWT, not a human password, so bcrypt's deliberate slowness only adds latency to every refresh call for no security benefit) and `SET refresh_token:{userId} <hash> EX <refreshTtlSeconds>` in Redis, overwriting any prior session (MVP is single-active-session per user — no multi-device story exists yet). Return `{ accessToken, refreshToken }`.
  - [x] `refresh(refreshToken)`: `jwtService.verifyAsync(token, { secret: JWT_REFRESH_SECRET })` (catch verify failure → generic `UnauthorizedException`); look up `refresh_token:{sub}` in Redis, compare its SHA-256 hash to the stored value — mismatch or missing key → `UnauthorizedException`. On success, re-issue **both** tokens via the same `login()` path (rotation — the old Redis hash is overwritten) and re-read the user's current `role` from the DB (not from the old token) so a role change is picked up.
  - [x] `logout(refreshToken)`: verify the same way, then `DEL refresh_token:{sub}`. Only the refresh session is revoked — do **not** attempt to invalidate the still-outstanding access token (AD-17's accepted stateless trade-off).

- [x] **Task 4 — DTOs, `AuthController`, wire `AuthModule`** (AC: 1, 2, 4)
  - [x] `backend/src/modules/auth/dto/login.dto.ts`: `{ @IsEmail() email: string; @IsString() @IsNotEmpty() password: string }`. **Do not add a `role` field to this DTO.** The global `ValidationPipe` (`whitelist: true, forbidNonWhitelisted: true` — `configure-app.ts`) 400-rejects any extra `role` key a client sends, which is a stronger and simpler enforcement of AC 4 than writing code to strip it — verify this behavior with a test (Task 5) rather than hand-rolled stripping logic.
  - [x] `backend/src/modules/auth/dto/refresh.dto.ts`: `{ @IsString() @IsNotEmpty() refreshToken: string }` — reuse for both `/refresh` and `/logout` bodies (identical shape).
  - [x] `backend/src/modules/auth/auth.controller.ts` — kebab-case, base `/api/auth` (AD-16): `POST /api/auth/login` (200, body → `{ accessToken, refreshToken }`, wrapped by the global `ResponseInterceptor` as `{ data: {...} }` — do not hand-wrap), `POST /api/auth/refresh`, `POST /api/auth/logout`. No `role`/`userId` field in the response body — the frontend decodes `role` from the access token's own payload (Task 7) so there is exactly one source of truth for it, matching AD-17.
  - [x] Replace the empty `backend/src/modules/auth/auth.module.ts` (`@Module({})` since Story 1.1) with `imports: [JwtModule.register({}), RedisModule]` (per-call `sign`/`verify` options carry the secret/expiry explicitly since access and refresh use different secrets — don't set a single module-level default), `controllers: [AuthController]`, `providers: [AuthService]`.

- [x] **Task 5 — Backend tests** (AC: 1, 2, 3, 4)
  - [x] `auth.service.spec.ts` (unit, mock `PrismaService` + `RedisService` + `JwtService` — follow the existing Jest setup, no real DB/Redis): valid credentials → tokens issued with `{sub, role}` payload; unknown email and wrong password both throw the **identical** `UnauthorizedException` message (locks AC 2); `refresh()` with a tampered/expired/unknown token is rejected; `refresh()` with a valid token rotates (new hash `SET`, old value no longer matches); `logout()` deletes the Redis key. Also covers refresh's role-reread and logout's reject-without-delete path.
  - [x] One DTO-level test (pattern-match `backend/src/common/validation-baseline.spec.ts`) proving `ValidationPipe` 400-rejects a login payload with an extra `role` field — the concrete lock for AC 4. (`dto/login.dto.spec.ts`)
  - [x] Do **not** build a DB-backed e2e test for this story — `backend/test/app.e2e-spec.ts` is the only e2e precedent and it uses no database; standing up a Postgres-backed e2e harness is a bigger investment than this story's scope justifies (mocked unit tests cover the ACs).
  - **Unplanned fix:** `auth.service.spec.ts` is the first spec to transitively import the generated Prisma 7 client, which surfaced the same ESM `.js`-suffix resolution issue [[prisma7-dev-env-gotchas]] previously hit with `ts-node` — now in `ts-jest`. Fixed by adding `moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" }` to the Jest config in `backend/package.json` (standard ts-jest recipe for NodeNext-emitting generators). All 6 suites / 24 tests pass; `npm run lint` clean.

- [x] **Task 6 — Frontend: API client + TanStack Query (first real usage)** (AC: 1)
  - [x] Add `@tanstack/react-query` (`^5.x` — matches the spine pin; current stable `5.101.2`) to `frontend/package.json`. This is the first data-fetching story — `frontend/src/lib/` has been empty of any fetch logic since Story 1.4 deliberately deferred it here.
  - [x] `frontend/src/lib/api-client.ts`: a single `apiFetch<T>(path, init?)` wrapping `fetch('/api' + path, ...)` (the existing Vite proxy from Story 1.1 forwards this to `:3000` in dev — don't hardcode a host). Reads the current access token (Task 7) and sets `Authorization: Bearer <token>` when present. On a non-2xx response, parse the JSON error envelope (`{ statusCode, message, error }` — `common/filters/http-exception.filter.ts`) and throw an `Error(message)` (or a small custom error class carrying `statusCode`) — this is the **one** API client the spine's "Frontend data access" convention requires; no ad-hoc `fetch` elsewhere (login form and every later feature call through it).
  - [x] Mount a `QueryClientProvider` in `main.tsx`. This story only needs one mutation (login) — don't add speculative query hooks for endpoints that don't exist yet.
  - **Restructure (user-directed, before this story added its files):** split the flat `lib/` seam into `contexts/` (React Context objects), `providers/` (Provider components), `hooks/` (consumer hooks), `config/` (app-wide instances) — `lib/` now holds only the framework-agnostic `api-client.ts`. Confirmed with the user via AskUserQuestion before implementing (see File List for the resulting layout).

- [x] **Task 7 — Frontend: replace the provisional role seam with real auth state** (AC: 1, 3)
  - [x] Replace `frontend/src/lib/role-context.ts` + `frontend/src/lib/role-provider.tsx` with an auth context/provider — restructured per user direction into `contexts/auth-context.ts` (context object + `AuthTokens`/`Role` types + localStorage read/write + `decodeRole`) and `providers/auth-provider.tsx` (the `AuthProvider` component), holding `{ accessToken, refreshToken }`, persisted to `localStorage` under `onthi12.auth` so a page reload doesn't log the user out. Decode `role` from the access token's payload with a tiny inline base64url-JSON decode helper — no `jwt-decode` dependency.
  - [x] `useRole(): Role` **kept its exact current signature** — now in `hooks/use-role.ts`, consumed unchanged (only the import path changed) by `app-shell.tsx` (indirectly), `sidebar.tsx`, `bottom-nav.tsx`, and `root-redirect.tsx`.
  - [x] Added `useAuth()` (`hooks/use-auth.ts`) exposing `login(email, password): Promise<void>` and `logout(): Promise<void>` per spec — implemented on the `AuthProvider`, `useAuth()` just reads the context.
  - [x] Deleted `frontend/src/lib/use-role.ts`, `frontend/src/lib/role-context.ts`, `frontend/src/lib/role-provider.tsx`, `frontend/src/components/dev-role-toggle.tsx` entirely (and its `<DevRoleToggle />` mount in `app-shell.tsx`).

- [x] **Task 8 — Frontend: login page + route gating** (AC: 1, 2)
  - [x] Built the login form under `frontend/src/features/auth/login-page.tsx` — first file under `features/`. Two fields (email, password) + submit `Button` (reused `variant="primary"` from Story 1.4). **Deviation from the story's original text, confirmed with the user:** the user added a Stitch mockup at `docs/stitch_exports/Login/` mid-implementation (after this story was drafted). Per the user's explicit choice (AskUserQuestion — "use the layout, drop out-of-scope parts"), the login page adopts the mockup's split-screen composition, but rebuilt on this project's real design tokens (Inter, actual color palette, `Button`/`Input` primitives, lucide-react icons already in `package.json`) instead of the mockup's own Be Vietnam Pro/Material-Symbols/external-CDN styling, and drops every out-of-scope affordance the mockup included: "Ghi nhớ đăng nhập" (remember me), "Quên mật khẩu?" (Story 1.8, not this one), Google social login (not in the SRS at all), and "Đăng ký ngay" sign-up (no signup FR exists — project-context.md anti-patterns).
  - [x] Added `components/ui/input.tsx` (mirrors `button.tsx`'s hand-rolled pattern) — one variant, no validation framework.
  - [x] On submit, calls `useAuth().login(...)`; on success navigates to `/` and lets the existing `RootRedirect` compute the role-specific home (avoids duplicating role-routing logic in the login page). On failure, shows the fixed Vietnamese message "Email hoặc mật khẩu không đúng" — never the raw API error string (locked by `login-page.test.tsx`).
  - [x] `frontend/src/routes/router.tsx`: added a top-level `/login` route outside `AppShell`. Wrapped the `AppShell` layout route in `RequireAuth` (`frontend/src/routes/require-auth.tsx`) — authenticated-vs-not gate only, not the Story 1.6 cross-role guard.
  - **Restructure note:** per the same user-directed layout (see Task 6), the file paths below differ from the story's original "New (frontend)" list — see File List for the actual paths (`contexts/`, `providers/`, `hooks/`, `config/` replacing a flat `lib/`).

- [x] **Task 9 — Verify** (AC: 1–4)
  - [x] Updated `frontend/src/components/sidebar.test.tsx` to wrap `<Sidebar>` with `AuthProvider` (`initialTokens` test-only prop, built from a `fakeAccessToken(role)` helper) instead of the deleted `RoleProvider` — same two assertions, unmodified in substance.
  - [x] Backend: `npm test` (Jest) — **6 suites / 24 tests passed** (new `auth.service.spec.ts` (10 tests) + `dto/login.dto.spec.ts` (2 tests) + 4 pre-existing suites, all green). `npm run lint` (ESLint) clean.
  - [x] Frontend: `npm test` (Vitest, Node 24 via fnm) — **3 files / 6 tests passed** (existing `button.test.tsx` (3), updated `sidebar.test.tsx` (2), new `login-page.test.tsx` (1)). `npm run build` (`tsc -b && vite build`) clean. `npm run lint` (oxlint) clean — 0 warnings.
  - [x] Manual smoke — ran against real Postgres + Redis (`docker compose up -d postgres redis`, migrated + seeded via `npx prisma db seed`), backend on `npm run start:dev`, frontend on `npm run dev`:
    - `curl` end-to-end against `/api/auth/{login,refresh,logout}` with the seeded accounts: student/teacher login both return `{sub, role}`-correct tokens (decoded and inspected); wrong password and unknown email both return the identical `401 "Invalid email or password"`; a client-supplied `role` field is rejected `400` by the whitelist (AC 4); refresh rotates (old refresh token immediately rejected after rotation); logout revokes the refresh session (post-logout refresh rejected).
    - Frontend dev server verified reachable and serving the SPA shell for `/login` and `/student`.
    - **Honesty note (no browser automation tool available in this environment):** the interactive click-through in an actual browser (log in as each role and visually confirm landing page/sidebar, wrong-password message rendered in the UI, reload-survives-session, logout-redirects-to-`/login`) was **not** performed by the agent — component-level coverage (Sidebar role-scoping test, LoginPage error-display test) plus the curl-verified API contract stand in for it. Both dev servers were left running (backend `:3000`, frontend `:5173`) for the user to do a real visual pass at `http://localhost:5173/login` with `teacher.alpha@onthi12.local` / `student1@onthi12.local`, password `Password123!`.

## Dev Notes

### Scope guardrails (read first — prevents the most likely mistakes)

- **This story issues tokens; it does not enforce them.** No `JwtAuthGuard`, no `RolesGuard`, no `@Public()` decorator sweep across controllers, no frontend cross-role route blocking. That is entirely **Story 1.6** ("Role-based access enforcement & isolation"), whose own AC literally introduces "a global `JwtAuthGuard`". Building enforcement here would collide head-on with 1.6 and violate Simplicity First — after this story, no backend route actually *checks* the token yet (nothing currently protects anything, so there's nothing to break); the frontend's `RequireAuth` (Task 8) is a narrower "is anyone logged in" check, not role isolation. [Source: epics.md#Story 1.6]
- **No login rate limiting here.** AR-10/AR-19/NFR-09 call for a Redis sliding-window limiter on login, but that is **Story 1.7** ("Login rate limiting") by name, listed as its own backlog item. Don't add it now — the `RedisService` this story builds (Task 2) is exactly what 1.7 will reuse. [Source: epics.md#Story 1.7]
- **No self-registration / signup.** SRS and the PRD have no signup FR — accounts are created only by the seed script (dev) or an eventual admin flow (out of MVP scope per SRS §1.4). Do not add a registration endpoint or form.
- **No password-reset work.** That's FR-3 / Story 1.8, a real email provider and separate token type — unrelated to this story's login token pair.
- **Don't touch Prisma schema.** `users.passwordHash`/`role` already exist from Story 1.2; this story only reads them.

### Why no Passport / guard infrastructure yet

NestJS auth tutorials default to `passport-jwt` + a `JwtStrategy` + `AuthGuard('jwt')`. This story deliberately skips that: there is no protected route to guard yet (that's 1.6), and `/api/auth/refresh`/`/api/auth/logout` authenticate by verifying a **refresh** token against Redis — a different check than "is there a valid Bearer access token", so a generic Passport JWT strategy wouldn't even apply to them. Sign/verify directly via `JwtService` in `AuthService`. Story 1.6 is free to add Passport or a hand-written guard later — either is compatible with the token shape this story defines (`{ sub, role }` access / `{ sub }` refresh).

### Auth flow design (concrete contract for Story 1.6+ to build on)

| Token | Secret | TTL | Verified how | Payload |
| --- | --- | --- | --- | --- |
| Access | `JWT_SECRET` | `JWT_EXPIRES_IN` (short — e.g. `15m`) | Stateless (`jwtService.verifyAsync`), no store hit | `{ sub, role }` |
| Refresh | `JWT_REFRESH_SECRET` (distinct) | `JWT_REFRESH_EXPIRES_IN` (e.g. `7d`) | Verify signature, then check its SHA-256 hash matches Redis `refresh_token:{sub}` | `{ sub }` |

- Redis key `refresh_token:{userId}` — value is the SHA-256 hex digest of the current refresh token, `EX` set to the refresh TTL in seconds. One active session per user (rotation overwrites; no session list/multi-device in v1.1 — nothing in SRS/PRD asks for it).
- `role` in the access-token payload is what `AD-17`/`AD-10` mean by "role read only from the verified token" for every *future* protected route — this story is what puts it there correctly (from the DB row, never from client input) so 1.6 has nothing to redo.

### Architecture compliance

- **Single-writer / module boundaries (AD-05, AD-06):** `auth` owns `users` reads for login; nothing here writes `users`. `RedisModule` is new shared `common/` infrastructure (like `PrismaModule`), not owned by any one feature module. [Source: ARCHITECTURE-SPINE.md#AD-05, #AD-06]
- **Server-authoritative trust (AD-10):** password verified server-side against the hash; `role` never taken from the request body (AC 4); DTO + `ValidationPipe` at the controller boundary (already global from Story 1.3). [Source: ARCHITECTURE-SPINE.md#AD-10]
- **Auth infra (AD-17):** minimal-claim JWT, stateless access-token verification, refresh hashed in Redis + rotated on use, logout revokes refresh only — this story implements AD-17's contract in full except the *global guard* half, which is 1.6's. [Source: ARCHITECTURE-SPINE.md#AD-17]
- **API envelope (AD-16):** `/api/auth/{login,refresh,logout}`, kebab-case, base `/api`; success wrapped `{ data }` by the existing global interceptor; invalid credentials is a **generic** 401 with no `errorCode` (single-cause error) — don't add anything to `common/exceptions/error-codes.ts` this story (it stays empty until Story 2.8/3.2's multi-cause gates). [Source: ARCHITECTURE-SPINE.md#AD-16]
- **Frontend data access (spine Consistency Conventions):** one API client (`lib/api-client.ts`) + this story's first TanStack Query usage; no ad-hoc `fetch` in the login component itself.
- **Secrets (spine):** `JWT_SECRET`/`JWT_REFRESH_SECRET` are backend-env only, already flow through the existing `.env`/`env_file` docker-compose path — never sent to or read by the frontend bundle.

### Previous story intelligence (Stories 1.1–1.4)

- **`frontend/src/lib/role-provider.tsx`, `role-context.ts`, `use-role.ts`, `components/dev-role-toggle.tsx` are the exact seam Story 1.4 built for this story** — its own doc comments say so verbatim ("Story 1.5 replaces the body of this provider with the role read from the verified JWT"). Consumers of `useRole()`: `app-shell.tsx`, `sidebar.tsx`, `bottom-nav.tsx`, `root-redirect.tsx` (grep-verified) — keep that hook's return type identical so none of the four need touching beyond `app-shell.tsx` losing its `<DevRoleToggle />` line. [verified: `frontend/src/lib/role-provider.tsx`, `frontend/src/lib/use-role.ts`]
- **`frontend/src/routes/router.tsx` currently has no `/login` route and no auth gating** — the whole tree (including `RootRedirect`) sits under one `AppShell` layout route with no guard. This story is what introduces the split between a public `/login` route and the gated shell tree. [verified: `frontend/src/routes/router.tsx`]
- **`backend/src/modules/auth/auth.module.ts` is still the empty scaffold from Story 1.1** (`@Module({})`) — first real content lands here. [verified: `backend/src/modules/auth/auth.module.ts`]
- **`backend/src/prisma/schema.prisma`'s `User` model already has everything needed** (`passwordHash`, `role: Role` enum `student|teacher` lowercase, matching the JWT claim by design per its own comment) — no migration this story. [verified: `backend/src/prisma/schema.prisma`]
- **Seed credentials are fixed and load-bearing**: `Password123!` hashed with `bcryptjs` at cost 10 for every seeded user (`backend/src/prisma/seed.ts` — its own comment: "load-bearing for the login story (1.5)"). Use `bcrypt.compare`, not a re-hash-and-string-compare. Seeded accounts: `teacher.alpha@onthi12.local`, `teacher.beta@onthi12.local`, `student1@onthi12.local`…`student6@onthi12.local`. [verified: `backend/src/prisma/seed.ts`]
- **`configureApp()` (`backend/src/common/configure-app.ts`) already wires `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, the response interceptor, and the exception filter globally** — nothing new to register for the envelope/validation baseline; AuthController automatically gets all three. [verified: `backend/src/common/configure-app.ts`]
- **No Redis is actually consumed by DI anywhere yet** — `main.ts` opens a bare `ioredis` client only to log connectivity at boot; it is not injectable. This story's `RedisModule`/`RedisService` (Task 2) is the first real consumer, and Story 1.7's rate limiter will be the second. [verified: `backend/src/main.ts`, grep for `ioredis`/`Redis` across `backend/src`]
- **Frontend has zero data-fetching infrastructure** — `frontend/src/lib/` holds only `nav-config.ts` + the role seam files; no TanStack Query, no API client. Story 1.4's own dev notes flagged this explicitly ("TanStack Query lands with the first data story (1.5 login)"). [verified: `frontend/package.json`, `frontend/src/lib/`]
- **Dev-Agent-Record honesty was flagged in every prior story's review** — record only commands actually run, with real output (exact test counts, exact lint result), matching Story 1.3/1.4's level of detail. [Source: 1-4-*.md, 1-3-*.md#Dev Agent Record]
- **Frontend runs on Node 24 via `fnm`** for build/test/dev — system Node fails Vite 8's engine check. [[prisma7-dev-env-gotchas]]

### Project Structure Notes

**New (backend):**
- `backend/src/common/redis/redis.module.ts`, `backend/src/common/redis/redis.service.ts`
- `backend/src/modules/auth/auth.controller.ts`, `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/dto/login.dto.ts`, `backend/src/modules/auth/dto/refresh.dto.ts`
- `backend/src/modules/auth/auth.service.spec.ts` (+ a DTO whitelist spec, either standalone or folded into the same file)

**Modified (backend):**
- `backend/src/modules/auth/auth.module.ts` (empty scaffold → real wiring)
- `backend/src/app.module.ts` (+`RedisModule` import)
- `backend/package.json` (+`@nestjs/jwt`)
- `.env.example` (repo root: +`JWT_REFRESH_SECRET`, +`JWT_REFRESH_EXPIRES_IN`; `JWT_EXPIRES_IN` default shortened)

**New (frontend):**
- `frontend/src/lib/api-client.ts`
- `frontend/src/lib/auth-context.tsx`, `frontend/src/lib/auth-provider.tsx` (replace `role-context.ts`/`role-provider.tsx`)
- `frontend/src/components/ui/input.tsx`
- `frontend/src/features/auth/login-page.tsx` (first file under `features/`)
- `frontend/src/routes/require-auth.tsx`

**Modified (frontend):**
- `frontend/src/lib/use-role.ts` (drop `useSetRole`, re-point at auth context)
- `frontend/src/routes/router.tsx` (+`/login`, `RequireAuth` wrapper around the shell tree)
- `frontend/src/routes/root-redirect.tsx` (logic unchanged — role source underneath it changes)
- `frontend/src/components/app-shell.tsx` (drop `<DevRoleToggle />`)
- `frontend/src/components/sidebar.test.tsx` (swap provider)
- `frontend/src/main.tsx` (mount `AuthProvider` + `QueryClientProvider` instead of `RoleProvider`)
- `frontend/package.json` (+`@tanstack/react-query`)

**Deleted (frontend):**
- `frontend/src/lib/role-context.ts`, `frontend/src/lib/role-provider.tsx`
- `frontend/src/components/dev-role-toggle.tsx`

No changes to `backend/src/prisma/schema.prisma` or any migration — matches "Previous story intelligence" above.

### Testing requirements

- **Must-Have (PROJECT-STANDARDS §7) relevant here:** none of the three listed Must-Haves (grading idempotency, role-guard access, assign gate) land in this story — 1.6 owns "role-guard access". This story's own bar: the four ACs, each with a concrete unit test named in Task 5 (service-level, mocked Prisma/Redis/JwtService — no real DB/Redis needed, consistent with every backend spec so far being a plain Jest unit test, not e2e).
- **The one non-obvious lock:** AC 2's "same message either way" — write the assertion as an exact string/error-type equality between the unknown-email case and the wrong-password case, not just "both throw 401" (a subtly different message per branch would still pass a looser test while violating the AC).
- Frontend: no new component-test infrastructure needed (Vitest+RTL exists since 1.4) — one test for the login form's error-display path (mock `fetch`/the API client directly, no MSW) is enough; don't chase full coverage of the auth provider's localStorage plumbing.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.5: Email/password login with JWT and role routing] — the 4 ACs
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#AD-17] — JWT claim shape, access/refresh split, stateless verification, Redis-hashed refresh, rotation, logout scope
- [Source: ARCHITECTURE-SPINE.md#AD-10] — server-authoritative trust boundary (role never client-supplied; password hashing)
- [Source: ARCHITECTURE-SPINE.md#AD-16] — API envelope/error shape; when `errorCode` does/doesn't apply
- [Source: ARCHITECTURE-SPINE.md#AD-05, #AD-06] — module/table ownership for the new `RedisModule`
- [Source: ARCHITECTURE-SPINE.md#Stack] — `@nestjs/jwt` version alignment with NestJS 11.x; TanStack Query 5.x pin
- [Source: _bmad-output/implementation-artifacts/1-4-design-tokens-and-role-aware-app-shell.md] — the role seam this story replaces; Button primitive to reuse; Vitest/RTL baseline; Node-24-via-fnm dev-env note
- [Source: docs/PROJECT-STANDARDS.md §7] — Must-Have test priorities (role-guard access is 1.6, not this story)
- Codebase state verified directly: `backend/src/modules/auth/auth.module.ts`, `backend/src/prisma/schema.prisma`, `backend/src/prisma/seed.ts`, `backend/src/common/configure-app.ts`, `backend/src/common/exceptions/{error-codes.ts,business.exception.ts}`, `backend/src/main.ts`, `backend/src/app.module.ts`, `backend/package.json`, `.env.example`, `docker-compose.yml`, `frontend/src/lib/{role-context.ts,role-provider.tsx,use-role.ts,nav-config.ts}`, `frontend/src/components/{app-shell.tsx,sidebar.tsx,sidebar.test.tsx,dev-role-toggle.tsx}`, `frontend/src/routes/{router.tsx,root-redirect.tsx}`, `frontend/src/main.tsx`, `frontend/package.json`

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (dev-story)

### Debug Log References

- `npm run build` (backend) — clean after fixing the `JwtSignOptions['expiresIn']` cast (ms `StringValue` branded type vs. plain `string` from `ConfigService.get`).
- `npm test` (backend) — first run failed all-suite on `auth.service.spec.ts`: `Cannot find module './internal/class.js'`, the same Prisma 7 ESM `.js`-suffix resolution issue as [[prisma7-dev-env-gotchas]] (previously hit in `ts-node`), now surfaced in `ts-jest` since this is the first spec to transitively import `PrismaService`. Fixed with `moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" }` in `backend/package.json`'s Jest config. Re-run: 6 suites / 24 tests green.
- `npm run build` (frontend) — failed once: `erasableSyntaxOnly` (TS 5.9) rejects the `public readonly statusCode` constructor-parameter-property shorthand in `ApiError`; rewrote as an explicit field assignment.
- Manual smoke: `docker compose up -d postgres redis` → `npx prisma generate` → `npx prisma db seed` (must run via `prisma db seed`, not directly via `tsx`, so `prisma.config.ts`'s `dotenv/config` import actually loads `backend/.env`) → `npm run start:dev` (backend) + `npm run dev` (frontend), both left running. Full `curl` walkthrough of `/api/auth/{login,refresh,logout}` against the seeded accounts — see Task 9 notes for each assertion.

### Completion Notes List

- All 4 ACs implemented and locked by tests: AC1 (valid login → `{sub, role}` token pair, bcrypt-verified) — `auth.service.spec.ts`; AC2 (identical generic message for unknown-email/wrong-password, plus a same-cost dummy-hash compare closing the response-time side channel) — `auth.service.spec.ts` + curl smoke; AC3 (short-TTL stateless access token, Redis-hashed rotated refresh token, logout revokes only the refresh session) — `auth.service.spec.ts` + curl smoke (rotation and post-rotation/post-logout rejection both verified against real Redis); AC4 (client-supplied `role` never trusted — `ValidationPipe` whitelist rejection) — `dto/login.dto.spec.ts` + curl smoke.
- **Scope-affecting deviation from the story's original text, resolved with the user before implementation (both via AskUserQuestion):**
  1. The user added a Login mockup at `docs/stitch_exports/Login/` after this story was drafted (the story's Dev Notes said none existed). Chose "use the mockup's layout, drop out-of-scope parts": the login page adopts the split-screen composition but is rebuilt on the project's real design tokens/Inter/lucide-react instead of the mockup's own Be Vietnam Pro/Material-Symbols/external-CDN assets, and drops remember-me, forgot-password, Google login, and sign-up (none are in scope for this story or the SRS).
  2. The user asked for the frontend auth seam to be organized into `contexts/`, `providers/`, `hooks/`, `config/` instead of dumping everything in `lib/` (the story's original file list). `lib/` now holds only the framework-agnostic `api-client.ts`; see File List below for the actual paths used in place of the story's "New (frontend)" section.
- No Prisma schema changes (as scoped) — `users.passwordHash`/`role` reused as-is.
- No `JwtAuthGuard`/`RolesGuard`/route enforcement added — correctly deferred to Story 1.6 per the story's own scope guardrails.
- Post-review UI pass (user feedback: "doesn't look like the mock"): reworked `login-page.tsx` for closer visual fidelity to `docs/stitch_exports/Login` — added a hero illustration to the left panel (built from tokens/lucide icons only, no external image asset), taller/more-rounded form fields, and a button with hover-lift + shadow. This required extending the two shared primitives additively (`Button` gained a `size="lg"`; `Input` gained `inputSize`/`leadingIcon`/`trailingIcon` — the native `<input>` `size` HTML attribute being numeric is why it's `inputSize`), both backward-compatible with existing `sm`/`md` usages. Re-verified: build/test/lint all clean (frontend).
- **Deferred, user-confirmed via AskUserQuestion:** token storage stays `localStorage` (as originally scoped, AD-17) rather than moving to HttpOnly cookies. HttpOnly is the more XSS-resistant choice long-term, but switching now would mean CSRF handling, a `cookie-parser` + `Set-Cookie` rework of `AuthController`, and a new way for the frontend to learn `role` (it currently decodes the access-token payload directly, which an HttpOnly cookie would make unreadable to JS) — out of scope for this story. Flagging for whoever picks up Story 1.6 (`JwtAuthGuard`) or a pre-production hardening pass to revisit.
- **Real bug found and fixed (user report: "UI looks broken", verified with a Playwright screenshot):** the login page's `max-w-sm`/`max-w-md`/`max-w-xs` containers were collapsing to 8px/16px/20rem-turned-4px-equivalent widths, wrapping every word onto its own line. Root cause is project-wide, not local to this page: `frontend/src/index.css`'s `--spacing-xs/sm/md/lg/xl` tokens (Story 1.4, meant for `p-*`/`gap-*`/etc.) happen to share key names with Tailwind's built-in `max-w-xs/sm/md/lg/xl` container scale, and Tailwind's `w-*`/`h-*`/`max-w-*`/`min-w-*` utilities fall back to a same-named `--spacing-*` entry when no more specific match exists — silently shadowing Tailwind's real rem-based defaults. This was latent since Story 1.4 (nothing had used `max-w-sm`/`max-w-md` before this story). Fixed by adding an explicit `--max-width-xs/sm/md/lg/xl` block to `index.css` restoring Tailwind's real defaults (20/24/28/32/36rem) — confirmed via the compiled CSS output and a Playwright screenshot before/after. Any future story reaching for `max-w-sm`/`max-w-md`/etc. is now safe. (Aside: while writing that CSS comment, discovered Tailwind's `@theme` block's comment parser breaks on literal curly braces and apostrophes inside `/* */` comments — kept the final comment to plain prose.)
- **Real gap found and fixed (user asked "how do I log out" — there was no way):** `useAuth().logout()` was built and unit/curl-tested in Task 7/9, but no component ever called it — the story's own Task 9 smoke-test line ("log out and confirm `/` redirects to `/login`") implicitly assumed a UI affordance that didn't exist. Added `frontend/src/components/logout-button.tsx` (calls `logout()` then navigates to `/login`), wired into the desktop `Sidebar` footer (below "Cài đặt") and the mobile top bar (icon-only, next to `Brand`) in `app-shell.tsx`. Verified end-to-end with a scripted Playwright run: logged in as teacher on desktop (1400px) and student on mobile (390px) viewports, confirmed the button renders in both layouts, clicked it, confirmed redirect to `/login`. Re-verified: build/test/lint all clean (frontend, 6/6 tests).

### File List

**New (backend):**
- `backend/src/common/redis/redis.module.ts`
- `backend/src/common/redis/redis.service.ts`
- `backend/src/modules/auth/auth.controller.ts`
- `backend/src/modules/auth/auth.service.ts`
- `backend/src/modules/auth/auth.service.spec.ts`
- `backend/src/modules/auth/dto/login.dto.ts`
- `backend/src/modules/auth/dto/login.dto.spec.ts`
- `backend/src/modules/auth/dto/refresh.dto.ts`

**Modified (backend):**
- `backend/src/modules/auth/auth.module.ts` (empty scaffold → real wiring)
- `backend/src/app.module.ts` (+`RedisModule`)
- `backend/package.json` (+`@nestjs/jwt`; +Jest `moduleNameMapper` fix, see Debug Log)
- `backend/package-lock.json`
- `.env.example` (repo root: +`JWT_REFRESH_SECRET`, +`JWT_REFRESH_EXPIRES_IN`; `JWT_EXPIRES_IN` default `1d` → `15m`)
- `backend/.env` (local-only, gitignored — added `REDIS_URL` + the four JWT vars for the manual smoke test; not part of the commit)

**New (frontend) — paths reflect the user-directed restructure (see Completion Notes):**
- `frontend/src/contexts/auth-context.ts`
- `frontend/src/providers/auth-provider.tsx`
- `frontend/src/hooks/use-auth.ts`
- `frontend/src/hooks/use-role.ts`
- `frontend/src/config/query-client.ts`
- `frontend/src/lib/api-client.ts`
- `frontend/src/components/ui/input.tsx`
- `frontend/src/components/logout-button.tsx`
- `frontend/src/features/auth/login-page.tsx`
- `frontend/src/features/auth/login-page.test.tsx`
- `frontend/src/routes/require-auth.tsx`

**Modified (frontend):**
- `frontend/src/main.tsx` (mounts `AuthProvider` + `QueryClientProvider`, replacing `RoleProvider`)
- `frontend/src/routes/router.tsx` (+`/login`, `RequireAuth` wrapper around the shell tree)
- `frontend/src/routes/root-redirect.tsx` (import path only — `hooks/use-role`)
- `frontend/src/components/app-shell.tsx` (drop `<DevRoleToggle />`; mobile top bar gains `LogoutButton variant="icon"`)
- `frontend/src/components/sidebar.tsx` (import path only; footer nav gains `LogoutButton`)
- `frontend/src/components/bottom-nav.tsx` (import path only)
- `frontend/src/components/sidebar.test.tsx` (swap `RoleProvider` → `AuthProvider` with a `fakeAccessToken` test helper)
- `frontend/src/lib/nav-config.ts` (`Role` import path → `contexts/auth-context`)
- `frontend/src/components/ui/button.tsx` (additive: `size` gained `'lg'`, for the login page's full-width submit button)
- `frontend/src/index.css` (bugfix: added `--max-width-xs/sm/md/lg/xl`, restoring Tailwind's real `max-w-*` defaults — see Completion Notes)
- `frontend/package.json` (+`@tanstack/react-query`)
- `frontend/package-lock.json`

**Deleted (frontend):**
- `frontend/src/lib/role-context.ts`
- `frontend/src/lib/role-provider.tsx`
- `frontend/src/lib/use-role.ts`
- `frontend/src/components/dev-role-toggle.tsx`

## Review Findings

_Code review 2026-07-20 (bmad-code-review, inline: adversarial + edge-case + acceptance-auditor lenses). 3 patch, 0 decision-needed, 3 dismissed as noise/by-design._

- [x] [Review][Patch] (fixed) `apiFetch` throws `TypeError` on a successful empty-body response (`api-client.ts:32`) — the shared client's success path does `(body as { data: T }).data`, but a 200/204/void response has an empty body, so `res.json()` rejects → `body` is `null` → reading `.data` throws. Masked today only because the sole void-returning caller (`auth-provider.tsx` `logout()`) wraps the call in `try/catch` and swallows it; any future void/204 endpoint routed through this mandated single client will throw on success. Fix: return `undefined` (or the raw body) when `body` is `null`, or short-circuit on `res.status === 204`/empty body before the `.data` access. [frontend/src/lib/api-client.ts:32]
- [x] [Review][Patch] (fixed) `RequireAuth` and `useRole` disagree on what "authenticated" means (`require-auth.tsx:9`) — the gate admits any truthy `accessToken`, but `useRole()` (`hooks/use-role.ts:12`) throws when the token payload has no decodable `role`. A present-but-malformed/role-less access token in `localStorage` therefore passes the gate, renders `AppShell`, then crashes it (white screen) instead of redirecting to `/login`. Low likelihood (server tokens always carry `role`; needs tampering or a future bug) but the failure mode is a hard crash with no in-app recovery. Fix: in `RequireAuth`, also redirect to `/login` when `role` cannot be decoded (treat an undecodable token as unauthenticated). [frontend/src/routes/require-auth.tsx:9]
- [x] [Review][Patch] (fixed) `localStorage` access is unguarded (`auth-context.ts:25`) — `readStoredTokens` only wraps `JSON.parse` in `try/catch`, not `localStorage.getItem`; `writeStoredTokens`'s `setItem` is unguarded too. A throwing `localStorage` (Safari private mode historically, storage disabled, quota) propagates out of `AuthProvider`'s lazy-`useState` initializer and white-screens the app at boot. Low value for a web-only MVP but cheap defensive hardening. Fix: wrap the `getItem`/`setItem` calls in `try/catch` and degrade to an in-memory session. [frontend/src/contexts/auth-context.ts:25]

_Dismissed (recorded, no action): (1) TanStack Query + `QueryClientProvider` are mounted but unused — login calls `apiFetch` directly, no `useMutation`/queries exist yet; dead weight vs Simplicity First, but explicitly the story's Task 6 groundwork ("first data-fetching story") and user-directed. (2) No refresh-on-401 wiring / the `/auth/refresh` endpoint has no frontend consumer — correct scope: no backend route validates access tokens until Story 1.6, so there is nothing to refresh against yet. (3) Non-constant-time hash comparison in `refresh()` — not exploitable: an attacker must already hold a validly-signed refresh JWT (passing `verifyAsync`) to reach the string compare at all._

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-20 | Code review (bmad-code-review): 3 patch findings applied (api-client empty-body `TypeError`, `RequireAuth`/`useRole` role-guard mismatch, unguarded `localStorage`), 3 dismissed as by-design/non-exploitable. Frontend 6/6 tests + lint + build green. Status → done. | claude-opus-4-8 (code-review) |
| 2026-07-20 | Added a missing logout affordance (user asked "how do I log out" — `useAuth().logout()` existed but no component called it). New `logout-button.tsx` wired into the desktop Sidebar footer and the mobile top bar; verified with a scripted Playwright login→logout run on both desktop and mobile viewports. | claude-sonnet-5 (dev-story) |
| 2026-07-20 | Fixed a project-wide bug (found via user report "UI looks broken", confirmed with a Playwright screenshot): `index.css`'s `--spacing-xs/sm/md/lg/xl` tokens were silently shadowing Tailwind's built-in `max-w-xs/sm/md/lg/xl` container scale (8/16/24/32px instead of 20/24/28/32/36rem), collapsing the login form to a near-zero-width column. Fixed with an explicit `--max-width-*` block; verified via compiled CSS and a before/after screenshot. | claude-sonnet-5 (dev-story) |
| 2026-07-20 | Post-review UI pass on user feedback ("doesn't match the mock"): closer visual fidelity on `login-page.tsx` (hero left-panel illustration, taller/rounder fields, animated submit button), extending `Button`/`Input` additively (`size="lg"`, `inputSize`/`leadingIcon`/`trailingIcon`). Discussed HttpOnly-cookie vs localStorage token storage with the user; decided (AskUserQuestion) to keep localStorage as scoped and defer the cookie migration to Story 1.6 or a pre-production hardening pass. | claude-sonnet-5 (dev-story) |
| 2026-07-20 | Implemented all 4 ACs (JWT login/refresh/logout, Redis-hashed rotated refresh, client-role rejection) across backend + frontend; adapted the user-added Login mockup onto real design tokens per user direction; restructured the frontend auth seam into contexts/providers/hooks/config per user direction; fixed a Prisma-7/ts-jest ESM resolution gap. 24 backend + 6 frontend tests, all green; manual curl smoke against real Postgres/Redis. Status → review. | claude-sonnet-5 (dev-story) |
| 2026-07-20 | Story drafted via bmad-create-story from epics.md Story 1.5 + ARCHITECTURE-SPINE.md AD-17/AD-10/AD-16 + direct verification of the current auth scaffold, Prisma schema, seed credentials, and the Story-1.4 role seam. | claude-sonnet-5 (create-story) |
