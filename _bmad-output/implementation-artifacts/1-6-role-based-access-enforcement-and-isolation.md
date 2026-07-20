---
baseline_commit: d851eb6
---

# Story 1.6: Role-based access enforcement & isolation

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As the system,
I want every protected route gated by authentication and role,
so that Students cannot reach Teacher functions and vice versa. *(FR-2)*

## Acceptance Criteria

1. **A global `JwtAuthGuard` protects every route; `@Public()` opts out; no/invalid token → 401.** Given a global `JwtAuthGuard`, when any route **except** `@Public()`-annotated ones (login, refresh, logout, reset, health) is called without a valid Bearer **access** token, then it returns **401** — a missing header, a malformed token, a token signed with the wrong secret, and an expired token all reject identically. A valid access token verifies statelessly (no store hit) and its `{ sub, role }` payload is attached to the request for downstream guards/handlers. [Source: epics.md#Story 1.6 AC1; ARCHITECTURE-SPINE.md#AD-17]
2. **`RolesGuard` + `@Roles()` returns 403 across both role directions; role is read only from the verified token.** Given a valid Student token calling a `@Roles('teacher')` endpoint, when the request is authorized, then `RolesGuard` returns **403** (a forbidden error envelope, **never** the endpoint's data); the same holds symmetrically for a Teacher token on a `@Roles('student')` endpoint. Role is taken **only** from the verified JWT payload, never from a request body/query/header field. A route with `@Roles()` but no matching role is denied; a merely-authenticated route (no `@Roles()`) is allowed for any valid token. [Source: epics.md#Story 1.6 AC2; ARCHITECTURE-SPINE.md#AD-17, #AD-10]
3. **The frontend blocks cross-role page rendering and shows only the current role's menu.** Given an authenticated user, when they navigate to a route belonging to the other role (e.g. a Student opening `/teacher/exams`), then a route guard prevents the other role's page from rendering and redirects them to their own role home; and the sidebar/bottom-nav render **only** that role's menu items. [Source: epics.md#Story 1.6 AC3; ARCHITECTURE-SPINE.md#AD-17]

## Tasks / Subtasks

- [x] **Task 1 — `@Public()` decorator + hand-rolled `JwtAuthGuard`** (AC: 1)
  - [x] `backend/src/common/decorators/public.decorator.ts`: export `IS_PUBLIC_KEY = 'isPublic'` constant + `Public = () => SetMetadata(IS_PUBLIC_KEY, true)`. Keep the metadata key in the decorator file (not a magic string) so the guard imports the same constant — no drift.
  - [x] `backend/src/common/guards/jwt-auth.guard.ts`: a `@Injectable()` `CanActivate` implementing the check **by hand via `JwtService`** — do **not** introduce `@nestjs/passport`/`passport-jwt` (Story 1.5 deliberately skipped Passport; this story continues the hand-rolled pattern — see Dev Notes "Why hand-rolled, no Passport"). Inject `Reflector`, `JwtService`, `ConfigService`. Logic: (1) `reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()])` → if true, `return true` (bypass). (2) Read the `Authorization` header, require the `Bearer <token>` scheme, else throw `UnauthorizedException`. (3) `await jwt.verifyAsync(token, { secret: config.get('JWT_SECRET') })` inside try/catch — **any** failure (bad signature, expired, malformed) throws the **same** generic `UnauthorizedException('Unauthorized')` (no `errorCode` — single-cause 401 per AD-16; never reveal *why* verification failed). (4) On success, assign the verified `{ sub, role }` payload to `request.user` and `return true`.
  - [x] Verify with `JWT_SECRET` only — this guard checks **access** tokens; it must never accept a refresh token (which is signed with `JWT_REFRESH_SECRET`, a different secret, so a refresh token naturally fails verification here — good, don't special-case it).

- [x] **Task 2 — `@Roles()` decorator + `RolesGuard`** (AC: 2)
  - [x] `backend/src/common/decorators/roles.decorator.ts`: export `ROLES_KEY = 'roles'` + `Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)`. Use the backend `Role` union — import the Prisma-generated `Role` enum type (`import type { Role } from '../../../generated/prisma/client'`, values `student|teacher` lowercase, matching the token claim) rather than a hand-written string union, so it can never diverge from the DB enum. (Check the exact generated import path against `auth.service.ts`'s existing `import { User } from '../../../generated/prisma/client'` — mirror it.)
  - [x] `backend/src/common/guards/roles.guard.ts`: `@Injectable()` `CanActivate` injecting `Reflector`. Logic: (1) `getAllAndOverride<Role[]>(ROLES_KEY, [getHandler(), getClass()])` → if `undefined`/empty, `return true` (route only needs auth, no specific role). (2) Read `request.user` (populated by `JwtAuthGuard`); if the user's `role` is not in the required list, throw `ForbiddenException('Forbidden')` (403, no `errorCode` — single-cause). Do **not** re-verify the token or read role from anywhere but `request.user.role`. If `request.user` is somehow absent (guard-order misconfig), throw `ForbiddenException` (fail closed, never fall through to the handler).

- [x] **Task 3 — Register both guards globally + mark existing public routes** (AC: 1, 2)
  - [x] In `backend/src/app.module.ts`: import `JwtModule.register({})` (guards need `JwtService`; the per-call secret is passed explicitly, mirroring `auth.module.ts`) and add two `APP_GUARD` providers **in this order**: `JwtAuthGuard` **first**, then `RolesGuard`. Order matters — NestJS runs global guards in provider-array order, so authentication (attach `request.user`) must precede authorization (read `request.user.role`). Add a one-line comment stating the order is load-bearing.
  - [x] Annotate the three existing public endpoints with `@Public()`: `AuthController` `login`, `refresh`, `logout` (all three authenticate via body/refresh-token, **not** a Bearer access token, so a global access-token guard would otherwise 401 them and lock every user out). Also annotate `AppController` `getHealth` (`@Public()`) — the `/api/health` liveness probe (and its passing `app.e2e-spec.ts`) must stay open. **Regression guard:** without these annotations, login itself would require a token that only login can issue — a deadlock. The e2e test in Task 5 must prove `/api/auth/login` and `/api/health` still return 200.
  - [x] Do **not** touch `main.ts`/`configure-app.ts` guard-wiring — global guards that need DI (Reflector/JwtService) must be registered via `APP_GUARD` in a module, **not** `app.useGlobalGuards(new ...)` in `configureApp` (the latter can't inject providers). Keep `configure-app.ts` as-is (pipe/interceptor/filter only).

- [x] **Task 4 — Typed authenticated request + `@CurrentUser()` param decorator** (AC: 1, 2)
  - [x] `backend/src/common/types/authenticated-request.ts` (or co-locate in the guard file): `export interface AuthUser { sub: string; role: Role }` and `export interface AuthenticatedRequest extends Request { user: AuthUser }`. This is the single typed contract for `request.user` — the guards write it, `@Roles`/`@CurrentUser` and every future protected handler read it. Keep the payload shape **verbatim** the access-token claim (`{ sub, role }`) — no remap to `{ userId }` (avoids a translation layer; future handlers read `req.user.sub` as the user id).
  - [x] `backend/src/common/decorators/current-user.decorator.ts`: `CurrentUser = createParamDecorator((_data, ctx) => ctx.switchToHttp().getRequest<AuthenticatedRequest>().user)`. This is small, needed by the very next epic (every teacher/student endpoint reads "who is calling"), and lets handlers avoid re-decoding the token — include it now as part of the auth contract, not speculatively later. No consumer in *this* story, so cover it with the e2e test's protected controller (Task 5) rather than leaving it unexercised.

- [x] **Task 5 — Backend tests** (AC: 1, 2)
  - [x] `backend/src/common/guards/jwt-auth.guard.spec.ts` (unit, mock `Reflector`/`JwtService`/`ConfigService` + a fake `ExecutionContext`): `@Public()` route bypasses (returns true, no token needed); missing `Authorization` header → `UnauthorizedException`; malformed / wrong-secret / expired token → **identical** `UnauthorizedException` (assert same message, locking AC 1's "reject identically"); a valid token → returns true **and** assigns `{ sub, role }` to `request.user`.
  - [x] `backend/src/common/guards/roles.guard.spec.ts` (unit, mock `Reflector` + fake context with a pre-set `request.user`): no `@Roles()` metadata → allowed; `role` in the required list → allowed; `role` **not** in the list → `ForbiddenException` (assert **both** directions — a `student` user vs `@Roles('teacher')`, and a `teacher` user vs `@Roles('student')` — this is the concrete lock for AC 2); absent `request.user` → `ForbiddenException` (fail-closed).
  - [x] `backend/test/roles-guard.e2e-spec.ts` (integration, mirror `app.e2e-spec.ts`'s no-DB harness): stand up a `TestingModule` with `JwtModule.register({})`, the two guards as `APP_GUARD` (same order as production), a real `ConfigService` (or override `JWT_SECRET` via a test config), and a **throwaway in-spec controller** exposing `@Public()` `GET /open`, an auth-only `GET /me` (returns `@CurrentUser()`), a `@Roles('teacher')` `GET /teacher-only`, and a `@Roles('student')` `GET /student-only`. Sign real tokens with the test `JWT_SECRET` and assert end-to-end: `/open` → 200 without a token; `/me` → 401 without a token, 200 + correct `{ sub, role }` with one; a **student** token on `/teacher-only` → **403**, a **teacher** token on `/teacher-only` → 200, and the mirror for `/student-only`. This proves the *global wiring + guard order* that a mocked-context unit test cannot (AC 1 "global", AC 2 "returns 403 not data"). Keep the controller inside the spec file — it is **not** product surface (no feature endpoint exists yet to guard; Epic 2's Story 2.1 is the first real `@Roles('teacher')` consumer).
  - [x] Run the full backend suite — the 6 existing suites / 24 tests (incl. `app.e2e-spec.ts`, now behind the global guard via `@Public()`) must stay green, plus the 3 new specs.

- [x] **Task 6 — Frontend: cross-role route guard (`RequireRole`)** (AC: 3)
  - [x] `frontend/src/routes/require-role.tsx`: `RequireRole({ role }: { role: Role })` — reads `useRole()`; if the current role **≠** the route's `role`, `return <Navigate to={`/${current}`} replace />` (redirect to the user's own home, not a dead 403 page — simplest recovery, consistent with `RootRedirect`'s `/${role}` convention); else `<Outlet />`. Mirror `require-auth.tsx`'s structure. This is a **UX** guard (defense-in-depth), not the security boundary — the backend `RolesGuard` (Tasks 1–2) is authoritative; the frontend can't be trusted and this only prevents rendering the wrong shell.
  - [x] Restructure `frontend/src/routes/router.tsx`: today all `destinations` (student + teacher) mount **flat** under `AppShell` with only `RequireAuth` — so a logged-in Student navigating to `/teacher/exams` renders the Teacher placeholder (the exact gap AC 3 closes). Split the flat array into two role groups and wrap each in `RequireRole`:
    - `student` group = `[...NAV_BY_ROLE.student.main, ...NAV_BY_ROLE.student.footer]` under `{ element: <RequireRole role="student" />, children: [...] }`
    - `teacher` group = `[...NAV_BY_ROLE.teacher.main, ...NAV_BY_ROLE.teacher.footer]` under `{ element: <RequireRole role="teacher" />, children: [...] }`
    - Keep `{ index: true, element: <RootRedirect /> }` and the `{ path: '*', ... }` 404 **outside** both role groups (they apply to any authenticated role). Keep the existing leading-slash strip (`d.to.replace(/^\//, '')`) since child paths are relative to the layout route.
  - [x] Sidebar/bottom-nav role-scoping (AC 3's menu half) is **already** implemented (`SidebarNav`/`BottomNav` consume `useRole()` + `NAV_BY_ROLE`, locked by `sidebar.test.tsx`) — **do not rebuild it**. This task only adds the *route* guard; confirm the existing menu test still passes.

- [x] **Task 7 — Frontend tests** (AC: 3)
  - [x] `frontend/src/routes/require-role.test.tsx` (Vitest + RTL, reuse the `fakeAccessToken(role)` helper pattern from `sidebar.test.tsx` and wrap in `AuthProvider` with `initialTokens`): render `RequireRole role="teacher"` inside a `MemoryRouter` with a **student** session and assert it redirects to `/student` (the guarded child content is not shown); mirror with a teacher session on a `role="student"` guard → redirects to `/teacher`; a matching role renders the child. Prefer asserting on the rendered outcome (redirected landing vs. child text) over router internals.
  - [x] The existing `sidebar.test.tsx` already covers AC 3's menu-scoping half — no change needed; just keep it green.

- [x] **Task 8 — Verify** (AC: 1–3)
  - [x] Backend: `npm test` (Jest) — all suites green (6 existing + 3 new); `npm run lint` clean; `npm run build` clean.
  - [x] Frontend: `npm test` (Vitest, **Node 24 via fnm** — system Node fails Vite 8's engine check, [[prisma7-dev-env-gotchas]]); `npm run build` (`tsc -b && vite build`) clean; `npm run lint` (oxlint) clean.
  - [x] Manual smoke (real Postgres + Redis, seeded — `docker compose up -d postgres redis`, `npx prisma db seed`; backend `npm run start:dev`, frontend `npm run dev`): (a) `curl /api/health` and `/api/auth/login` with no token → still **200** (public routes unaffected). (b) A protected route with no/expired/garbage `Authorization` → **401** (use the in-spec pattern or a temporary curl against any guarded route if one exists; otherwise rely on the e2e). (c) Log in as `student1@onthi12.local` and `teacher.alpha@onthi12.local` (password `Password123!`), then in the browser manually navigate the Student session to `/teacher/exams` → redirected to `/student` (and the reverse). Record exactly which checks were run vs. covered only by tests — do **not** claim a browser click-through that wasn't performed (see Story 1.5's honesty note; no browser-automation tool is assumed available).

## Dev Notes

### Scope guardrails (read first — prevents the most likely mistakes)

- **This story builds the guard *infrastructure*; there are no feature endpoints to guard yet.** The `exam`/`submission`/`dashboard`/`class` modules are still empty scaffolds — the first real `@Roles('teacher')` route is Epic 2's Story 2.1. So AC 2's "Teacher-only endpoint" is proven by the **in-spec throwaway controller** in the e2e test (Task 5), **not** by inventing a product endpoint. Do **not** add a demo/feature route to `src/` to have something to guard — that violates Simplicity First and would be dead product surface. [Source: sprint-status.yaml (2-1 is the first exam endpoint); ARCHITECTURE-SPINE.md#Capability Map]
- **Do not add a `GET /api/auth/me` (or any new product endpoint).** Tempting as a "concrete authenticated route", but the frontend already decodes `role` from the access-token payload client-side (`contexts/auth-context.ts#decodeRole`) and needs nothing from the server for routing. Adding `/me` now is speculative. The `@CurrentUser()` decorator (Task 4) is the forward-looking piece worth including — it's the read-side of the `request.user` contract the guards must write anyway, and Epic 2's very first handler needs it.
- **401 vs 403 are single-cause generic errors — no `errorCode`.** Use built-in `UnauthorizedException`/`ForbiddenException`; the global exception filter (`common/filters/http-exception.filter.ts`, Story 1.3) already shapes them into `{ statusCode, message, error }`. Do **not** add anything to `common/exceptions/error-codes.ts` — it stays empty until the first multi-cause business gate (Story 2.8 assign gate / 3.2 attempt-start). [Source: ARCHITECTURE-SPINE.md#AD-16]
- **Don't touch the Prisma schema, the auth token design, or `AuthService`.** This story consumes the `{ sub, role }` access token Story 1.5 already issues — it does not change how tokens are minted, refreshed, or stored. No migration.
- **No login rate limiting here** — that's Story 1.7 (next). No password-reset — Story 1.8. The `@Public()` decorator this story creates is what 1.8's reset endpoints will annotate.

### Token-storage decision (localStorage vs HttpOnly cookie) — resolve explicitly, recommend defer

Story 1.5 deferred the "move access/refresh tokens from `localStorage` to HttpOnly cookies" question **to this story or a pre-production hardening pass** (its Change Log + [[auth-token-storage-decision]]). Decision for 1.6: **keep `localStorage`, defer the cookie migration.** Rationale: this story's charter is *enforcement/isolation* (guards + role routing), whereas the cookie migration is an orthogonal, sizeable rework — it drags in CSRF protection, `cookie-parser` + `Set-Cookie` changes to `AuthController`, and a new server-side channel for the frontend to learn `role` (an HttpOnly cookie is unreadable to the JS that currently calls `decodeRole`). Bundling it would blow past the epic's scope and Simplicity First. The `JwtAuthGuard` reads the token from the `Authorization: Bearer` header regardless of where the frontend stores it, so this decision does **not** block 1.6 and the migration stays cleanly deferrable. *(This is flagged to the user as an open decision — see the question at the end of this run.)*

### Why hand-rolled, no Passport (continues Story 1.5's pattern)

Story 1.5 verified tokens directly via `JwtService` and explicitly avoided `passport-jwt`/`JwtStrategy`/`AuthGuard('jwt')`. This story keeps that: a `CanActivate` that reads the header and calls `jwt.verifyAsync` is ~20 lines, fully typed, and needs no `@nestjs/passport` + `passport` + `passport-jwt` (+ `@types/*`) dependency tree for what NestJS guards already express natively. The token shape is fixed (`{ sub, role }` access / `{ sub }` refresh, distinct secrets — Story 1.5 Dev Notes "Auth flow design"), so verification is a one-liner. **No new backend dependencies** — `@nestjs/jwt` (already installed), `@nestjs/config`, `@nestjs/core` (`Reflector`, `APP_GUARD`) cover everything.

### Guard architecture & wiring (concrete)

```
common/
  decorators/
    public.decorator.ts        # @Public() + IS_PUBLIC_KEY
    roles.decorator.ts         # @Roles(...Role[]) + ROLES_KEY
    current-user.decorator.ts  # @CurrentUser() → request.user
  guards/
    jwt-auth.guard.ts          # global #1: verify access token, attach request.user
    roles.guard.ts             # global #2: authorize request.user.role against @Roles
  types/
    authenticated-request.ts   # AuthUser { sub, role } + AuthenticatedRequest
```

- **Global registration** (in `app.module.ts`, not `configure-app.ts` — DI-injected guards can't be `new`'d into `useGlobalGuards`):
  ```ts
  imports: [ ..., JwtModule.register({}) ],
  providers: [
    // Order is load-bearing: authenticate (attach request.user) before authorize.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  ```
- **`Reflector.getAllAndOverride`** (handler **then** class) is the right lookup for both metadata keys — it lets a future controller set a class-level default that a method overrides. `@Public()` and `@Roles()` compose: a `@Roles('teacher')` method is implicitly non-public (no `@Public`), so `JwtAuthGuard` runs, then `RolesGuard` runs.
- **Secret source:** guards call `config.get('JWT_SECRET')` per-verify (same value `AuthService.login` signs with) — never `process.env` directly in new code (match module style; `main.ts`'s raw `process.env` is pre-existing boot code, don't copy it).
- **Fail-closed everywhere:** any verification/authorization ambiguity throws (401/403), never falls through to the handler.

### Architecture compliance

- **AD-17 (auth infra):** this story implements the *global-guard half* AD-17 describes and Story 1.5 explicitly left open — "a global `JwtAuthGuard` protects routes with `@Public()` opting out; a `RolesGuard` + `@Roles()` reads role from the verified token only … access token verified statelessly per request." Stateless verification = no Redis hit in `JwtAuthGuard` (only `/refresh` touches the store, unchanged). [Source: ARCHITECTURE-SPINE.md#AD-17]
- **AD-10 (server-authoritative trust):** role is read **only** from the verified token in both guards — never from a body/query/header. The DTO+`ValidationPipe` boundary (global since Story 1.3) already strips a client-sent `role` field; the guards close the authorization side. [Source: ARCHITECTURE-SPINE.md#AD-10]
- **AD-16 (envelope/errors):** 401/403 flow through the existing global exception filter as generic single-cause errors, no `errorCode`. [Source: ARCHITECTURE-SPINE.md#AD-16]
- **AD-05/06 (module boundaries):** the guards + decorators are cross-cutting `common/` infrastructure (like `PrismaModule`/`RedisModule`), not owned by any feature module — exactly where the spine's layer table puts "guards, pipes, filters." `JwtModule` is imported in `app.module.ts` for the global guards (it's also imported in `auth.module.ts` for `AuthService`; two `JwtModule.register({})` are independent and fine). [Source: ARCHITECTURE-SPINE.md#Design Paradigm layer table, #AD-05/06]
- **Frontend (spine Consistency Conventions "Auth: guards on every protected route"):** `RequireRole` is the client-side reflection of the server guard — defense-in-depth/UX only; the server remains authoritative.

### Previous story intelligence (Stories 1.1–1.5)

- **Access-token contract is fixed and correct** — `{ sub: userId, role }` signed with `JWT_SECRET`/`JWT_EXPIRES_IN`; refresh is `{ sub }` with `JWT_REFRESH_SECRET`. The `JwtAuthGuard` verifies **access** tokens with `JWT_SECRET` only. [verified: `backend/src/modules/auth/auth.service.ts:68-88`]
- **`Role` is a Prisma enum** (`student|teacher`, lowercase) already imported in `auth.service.ts` as `User['role']` — import the generated `Role` for `@Roles()`/`AuthUser`, don't hand-type a string union. [verified: `auth.service.ts:8`, `backend/src/prisma/schema.prisma`]
- **The only existing routes are `@Get('health')` (AppController) and the three `POST /api/auth/*`** — these four are the complete `@Public()` set for this story. Every other module controller is an empty scaffold. [verified: `app.controller.ts`, `auth.controller.ts`, grep of `modules/*/`]
- **Global cross-cutting wiring already lives in two places** — `configure-app.ts` (`new`'d pipe/interceptor/filter, no DI) and `app.module.ts` (`imports`). The guards need DI, so they go in `app.module.ts` via `APP_GUARD`, **not** `configure-app.ts`. Don't confuse the two. [verified: `common/configure-app.ts`, `app.module.ts`]
- **E2E harness precedent is no-DB** — `backend/test/app.e2e-spec.ts` builds a `TestingModule` with just the controller/providers + `configureApp` + supertest. The roles-guard e2e follows the same shape (no Postgres/Redis needed — tokens are signed in-test). This is the established pattern; don't stand up a DB-backed harness. [verified: `backend/test/app.e2e-spec.ts`]
- **`app.e2e-spec.ts` will now run *through* the global guard** — because the e2e that tests the guard registers `APP_GUARD` in its own module, but the **existing** `app.e2e-spec.ts` builds its module **without** the guards, so `/api/health` there is unaffected. In *production* (`app.module.ts`), health gains `@Public()` (Task 3) so it stays open. Keep both true: the health e2e module has no guard; production health is `@Public()`.
- **Frontend routing gap is precise** — `router.tsx` mounts a **flat** `destinations` array (student+teacher combined) under one `AppShell`, gated only by `RequireAuth` (logged-in-or-not). Role paths are already prefixed (`/student/*`, `/teacher/*`) but nothing stops a logged-in Student from rendering `/teacher/*`. `RequireRole` + splitting the array by role closes it. [verified: `frontend/src/routes/router.tsx`, `require-auth.tsx`]
- **`useRole()` throws for a logged-out/role-less session** — but `RequireAuth` already guarantees a decodable role before any shell route renders (Story 1.5 review fix), so `RequireRole` (which runs inside the `RequireAuth` subtree) can call `useRole()` safely. [verified: `hooks/use-role.ts`, `routes/require-auth.tsx:13`]
- **Sidebar/bottom-nav are already role-scoped** — `SidebarNav`/`BottomNav` use `useRole()`+`NAV_BY_ROLE`; `sidebar.test.tsx` locks that a Student never sees Teacher links and vice-versa. AC 3's *menu* half is done; only the *route* guard is new. [verified: `components/sidebar.tsx`, `lib/nav-config.ts`, `components/sidebar.test.tsx`]
- **Frontend test helper to reuse** — `fakeAccessToken(role)` (base64url-encodes `{ role }` into a fake JWT) + `AuthProvider initialTokens` is the established way to render a component in a given role without a real login. Copy it into `require-role.test.tsx`. [verified: `components/sidebar.test.tsx:9-24`]
- **Dev-Agent-Record honesty is reviewed every story** — record only commands actually run with real output (exact suite/test counts, exact lint result); flag anything (e.g. a browser click-through) that was *not* performed. [Source: 1-5-*.md#Task 9 honesty note, #Dev Agent Record]
- **Node 24 via `fnm` for all frontend build/test/dev.** [[prisma7-dev-env-gotchas]]

### Project Structure Notes

**New (backend):**
- `backend/src/common/decorators/public.decorator.ts`
- `backend/src/common/decorators/roles.decorator.ts`
- `backend/src/common/decorators/current-user.decorator.ts`
- `backend/src/common/guards/jwt-auth.guard.ts`
- `backend/src/common/guards/roles.guard.ts`
- `backend/src/common/types/authenticated-request.ts`
- `backend/src/common/guards/jwt-auth.guard.spec.ts`
- `backend/src/common/guards/roles.guard.spec.ts`
- `backend/test/roles-guard.e2e-spec.ts`

**Modified (backend):**
- `backend/src/app.module.ts` (+`JwtModule.register({})`, +two `APP_GUARD` providers in order)
- `backend/src/modules/auth/auth.controller.ts` (+`@Public()` on login/refresh/logout)
- `backend/src/app.controller.ts` (+`@Public()` on getHealth)

**New (frontend):**
- `frontend/src/routes/require-role.tsx`
- `frontend/src/routes/require-role.test.tsx`

**Modified (frontend):**
- `frontend/src/routes/router.tsx` (split flat `destinations` into two `RequireRole`-wrapped role groups)

No Prisma migration, no `AuthService`/token-design change, no new dependencies (backend or frontend).

### Testing requirements

- **Must-Have (PROJECT-STANDARDS §7 item 2 — "Role-based access: students cannot reach teacher pages/APIs and vice versa") lands *here*.** This is one of the three merge-blocking Must-Have areas, so the tests are not optional: the `roles.guard.spec.ts` both-directions 403 assertion + the `roles-guard.e2e-spec.ts` end-to-end student→teacher-only/teacher→student-only 403, plus the frontend `require-role.test.tsx` cross-role redirect, are the concrete locks. [Source: docs/PROJECT-STANDARDS.md §7]
- **The non-obvious locks:** (1) AC 1's "reject *identically*" — assert the **same** `UnauthorizedException` message for missing vs malformed vs expired vs wrong-secret, not just "all 401" (a per-reason message would leak *why* and still pass a looser test). (2) AC 2 must be tested **in both directions** — a one-directional test (only student→teacher) would pass while a bug lets teacher→student through. (3) The e2e (not just unit) is required because AC 1 says "**global**" — only a real HTTP round-trip through `APP_GUARD` proves the global registration + guard order actually took effect; a mocked-`ExecutionContext` unit test can't.
- **Frontend:** no new test infrastructure (Vitest+RTL since 1.4); the redirect-outcome assertion is enough — don't chase coverage of router internals.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.6: Role-based access enforcement & isolation] — the 3 ACs
- [Source: ARCHITECTURE-SPINE.md#AD-17] — global `JwtAuthGuard`, `@Public()` opt-out, `RolesGuard`+`@Roles()`, role from verified token only, stateless per-request access-token verification
- [Source: ARCHITECTURE-SPINE.md#AD-10] — server-authoritative trust boundary (role never client-supplied)
- [Source: ARCHITECTURE-SPINE.md#AD-16] — generic 401/403 carry no `errorCode`; global exception filter shapes the envelope
- [Source: ARCHITECTURE-SPINE.md#Design Paradigm layer table, #Consistency Conventions "Auth"] — guards live in `common/`; guards on every protected route
- [Source: _bmad-output/implementation-artifacts/1-5-email-password-login-with-jwt-and-role-routing.md] — the access/refresh token contract this story consumes; the "no guard yet, that's 1.6" scope hand-off; `fakeAccessToken` test helper; hand-rolled-not-Passport rationale; localStorage token-storage deferral
- [Source: docs/PROJECT-STANDARDS.md §7] — role-guard access is a merge-blocking Must-Have test area
- Codebase state verified directly: `backend/src/app.module.ts`, `backend/src/app.controller.ts`, `backend/src/common/configure-app.ts`, `backend/src/modules/auth/{auth.controller.ts,auth.service.ts,auth.module.ts}`, `backend/test/app.e2e-spec.ts`, `frontend/src/routes/{router.tsx,require-auth.tsx,root-redirect.tsx}`, `frontend/src/hooks/use-role.ts`, `frontend/src/contexts/auth-context.ts`, `frontend/src/lib/nav-config.ts`, `frontend/src/components/{sidebar.tsx,sidebar.test.tsx}`

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (dev-story)

### Debug Log References

- Backend unit (`npm test`, Node 24): **8 suites / 35 tests passed** (6 existing suites / 24 tests + 2 new guard specs: `jwt-auth.guard.spec.ts` 5 tests, `roles.guard.spec.ts` 6 tests).
- Backend e2e (`npm run test:e2e`): **2 suites / 9 tests passed** — unchanged `app.e2e-spec.ts` (health still 200) + new `roles-guard.e2e-spec.ts` (8 tests through the real `APP_GUARD` chain).
- Backend `npm run lint` clean (fixed 4 initial `no-unsafe-member-access` errors on `res.body` by typing it `Record<string, unknown>`); `npm run build` (nest build) clean.
- Frontend (`npm test`, Vitest, Node 24 via fnm): **4 files / 9 tests passed** — new `require-role.test.tsx` (3 tests) + unchanged `sidebar.test.tsx` menu-scoping still green.
- Frontend `npm run lint` (oxlint) clean; `npm run build` (`tsc -b && vite build`) clean.

### Completion Notes List

- **AC 1** — Global `JwtAuthGuard` (`APP_GUARD` #1) verifies Bearer access tokens statelessly with `JWT_SECRET` only; `@Public()` (class-level on `AuthController`, method-level on `getHealth`) opts out. Missing header, non-Bearer scheme, malformed / wrong-secret / expired token **all** throw the identical `UnauthorizedException('Unauthorized')` — locked by `jwt-auth.guard.spec.ts` asserting a single distinct message across 4 rejection paths.
- **AC 2** — `RolesGuard` (`APP_GUARD` #2) reads role **only** from `request.user` (never body/query/header); both directions 403 proven in unit (`roles.guard.spec.ts`) **and** e2e (student→`/teacher-only` 403, teacher→`/student-only` 403, each with the mirror allow-case + `body.data` undefined). Fail-closed when `request.user` absent.
- **AC 3** — `RequireRole` redirects a cross-role navigation to the user's own `/${role}` home; `router.tsx` split from a flat `destinations` array into two `RequireRole`-wrapped role groups (index + 404 kept outside both). `require-role.test.tsx` asserts the redirect outcome both directions + the matching-role render. Menu-scoping half already covered by `sidebar.test.tsx` (unchanged).
- **`@CurrentUser()`** included as the read-side of the `request.user` contract; unexercised by product code this story, so covered by the e2e's throwaway `/me` handler.
- **No new dependencies** (backend or frontend), **no Prisma migration**, **no `AuthService`/token-design change** — the story consumes Story 1.5's `{ sub, role }` access token unchanged.
- **Token-storage decision:** kept `localStorage`, deferred the HttpOnly-cookie migration (orthogonal, drags in CSRF + `Set-Cookie` + a server channel for `role`). The `Authorization: Bearer` guard is storage-agnostic, so this does not block 1.6. See the open question raised to the user. [[auth-token-storage-decision]]
- **Manual smoke honesty (Task 8c):** the live docker-stack + browser click-through was **not** performed (no browser-automation tool available). Its three checks are instead covered by automated tests through the real global-guard wiring: (a) public routes open — `roles-guard.e2e-spec.ts` `/open` 200 no-token + `app.e2e-spec.ts` `/api/health` 200; (b) protected route 401 on no/garbage token — `roles-guard.e2e-spec.ts` `/me` 401 (no token) + 401 (garbage token); (c) cross-role redirect — `require-role.test.tsx` both directions. No live `curl` / browser navigation was run.

### File List

**New (backend):**
- `backend/src/common/decorators/public.decorator.ts`
- `backend/src/common/decorators/roles.decorator.ts`
- `backend/src/common/decorators/current-user.decorator.ts`
- `backend/src/common/guards/jwt-auth.guard.ts`
- `backend/src/common/guards/roles.guard.ts`
- `backend/src/common/types/authenticated-request.ts`
- `backend/src/common/guards/jwt-auth.guard.spec.ts`
- `backend/src/common/guards/roles.guard.spec.ts`
- `backend/test/roles-guard.e2e-spec.ts`

**Modified (backend):**
- `backend/src/app.module.ts` (+`JwtModule.register({})`, +two `APP_GUARD` providers in order)
- `backend/src/modules/auth/auth.controller.ts` (+class-level `@Public()`)
- `backend/src/app.controller.ts` (+`@Public()` on `getHealth`)

**New (frontend):**
- `frontend/src/routes/require-role.tsx`
- `frontend/src/routes/require-role.test.tsx`

**Modified (frontend):**
- `frontend/src/routes/router.tsx` (split flat `destinations` into two `RequireRole`-wrapped role groups)

### Review Findings

_Code review 2026-07-20 (bmad-code-review, inline three-layer: adversarial / edge-case / acceptance-audit). Guard suites re-run green: 11 unit + 8 e2e. 1 finding surfaced, 3 dismissed as noise._

- [x] [Review][Patch] Class-level `@Public()` on `AuthController` inverts secure-by-default in the most sensitive module [backend/src/modules/auth/auth.controller.ts:10] — **FIXED**: moved `@Public()` from class to each of the 3 method handlers; typecheck clean, e2e 2 suites/9 tests green (login/refresh/logout still open). — `getAllAndOverride(IS_PUBLIC_KEY, [handler, class])` returns the class value for any method without its own metadata, so **any future authenticated route added to `AuthController`** (e.g. change-password, revoke-session, `/me`) would be **silently public** unless the author remembers to override. No live vuln today (login/refresh/logout are all intentionally public), so severity is low — but it is a cheap, behavior-identical hardening in the one controller where a mistake is a real auth bypass. Fix: move `@Public()` from the class onto each of the three method handlers (`login`, `refresh`, `logout`), restoring secure-by-default for the controller.

_Dismissed (recorded for transparency): (1) `verifyAsync<AuthUser>` doesn't validate payload shape — not reachable; the only signer (`AuthService`) always emits `{ sub, role }`, and `RolesGuard` fails closed on a missing role. (2) AC1's wrong-secret/expired "reject identically" is unit-tested via mocked rejections + a garbage-token e2e rather than a real wrong-secret/expired e2e token — code is correct (real crypto verify with `JWT_SECRET`), unit asserts the single identical message; coverage is adequate. (3) `Bearer` scheme match is case-sensitive vs RFC 7235's case-insensitive — the project's own `api-client.ts` always sends `Bearer`, so not reachable._

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-20 | Code review (bmad-code-review, inline): 1 low/patch finding (class-level `@Public()` secure-by-default inversion on `AuthController`), 3 dismissed. Guard suites re-verified green (11 unit + 8 e2e). | claude-opus-4-8 (code-review) |
| 2026-07-20 | Story drafted via bmad-create-story from epics.md Story 1.6 + ARCHITECTURE-SPINE.md AD-17/AD-10/AD-16 + direct verification of the Story-1.5 auth token contract, the existing public routes (health + auth), and the flat-router cross-role gap in frontend routing. | claude-opus-4-8 (create-story) |
| 2026-07-20 | Implemented all 8 tasks: global `JwtAuthGuard`+`RolesGuard` (`APP_GUARD`), `@Public()`/`@Roles()`/`@CurrentUser()` decorators, `AuthenticatedRequest` type, `@Public()` on auth+health routes; frontend `RequireRole` + role-split router. Tests: backend 8 unit suites/35 + 2 e2e suites/9 green, frontend 4 files/9 green; backend+frontend lint & build clean. Kept localStorage tokens (cookie migration deferred). Status → review. | claude-opus-4-8 (dev-story) |
