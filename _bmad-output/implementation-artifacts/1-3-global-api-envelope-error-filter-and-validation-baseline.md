---
baseline_commit: 3a9a6e396eaa2397c9933d8ed30e23241fe2b2ee
---

# Story 1.3: Global API envelope, error filter & validation baseline

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a frontend developer,
I want every API response and error to have one consistent shape,
so that clients never branch on ad-hoc formats and 5xx internals never leak.

## Acceptance Criteria

1. **Success envelope via one global interceptor.** A global `NestInterceptor` (not per-controller code) wraps every successful controller response as `{ data }`. A controller/service may additionally return the **list-payload contract** `{ items: T[], meta: { page, limit, total } }`, which the interceptor unwraps into `{ data: items, meta }` for `?page=&limit=` endpoints. No controller in this story or later ones hand-wraps its own response. [Source: epics.md#Story 1.3; ARCHITECTURE-SPINE.md#AD-16]
2. **Error envelope via one global exception filter.** A single global `ExceptionFilter` (registered once, catching everything) builds every error response as `{ statusCode, message, error, errorCode? }`. `errorCode` is present **only** when the thrown exception is a `BusinessException` carrying a code from the centralized `common/exceptions/error-codes.ts` — never an inline string literal in a controller/service. Generic errors (validation 400s, plain `NotFoundException`, etc.) omit `errorCode` entirely, matching Nest's default `{statusCode, message, error}` shape. [Source: epics.md#Story 1.3; ARCHITECTURE-SPINE.md#AD-16, #AD-05 "state mutation" row]
3. **5xx never leaks internals.** Any exception that resolves to status ≥ 500 — whether an uncaught `Error`/Prisma error or an explicit `InternalServerErrorException` — returns only a generic `message` (no internal error message or stack) to the client, while the full exception context (method, URL, stack) is logged server-side via Nest's `Logger`. 4xx business/validation errors are **not** logged as incidents. [Source: epics.md#Story 1.3; ARCHITECTURE-SPINE.md#AD-16]
4. **Validation baseline via one global pipe.** A global `ValidationPipe` (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) runs on every controller before its handler executes. A request whose `@Body()`/`@Query()` DTO fails `class-validator` rules is rejected with 400 and never reaches the handler. [Source: epics.md#Story 1.3; ARCHITECTURE-SPINE.md#AD-10 "Validation" row]
5. **Wired identically everywhere, not just in `main.ts`.** The pipe, interceptor, and filter are registered through **one shared setup function** used by both the real HTTP bootstrap (`main.ts`) and the e2e test harness, so a future controller/test never silently runs without the envelope/validation baseline just because it forgot to re-register globals by hand. [Source: ARCHITECTURE-SPINE.md#NFR-08 maintainability; prevents drift between `backend/src/main.ts` and `backend/test/app.e2e-spec.ts`]

## Tasks / Subtasks

- [x] **Task 1 — Add validation dependencies** (AC: 4)
  - [x] Add `class-validator` and `class-transformer` to `backend/dependencies` (not devDependencies — `ValidationPipe` needs them at runtime). Check current stable versions with `npm view class-validator version` / `npm view class-transformer version` rather than guessing a pin; both are mature packages with no known Node 24/NestJS 11 compatibility issues.
  - [x] Run `npm install` inside `backend/` and confirm no `allowScripts` entry is needed (both are pure-JS, no native build step).

- [x] **Task 2 — Centralized error-code scaffold** (AC: 2)
  - [x] Create `backend/src/common/exceptions/error-codes.ts`. Export a `const ErrorCodes = { ... } as const` object and a derived `export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]`.
  - [x] **Leave it empty this story** (`export const ErrorCodes = {} as const;`) with a one-line comment pointing at AD-16 and noting that Epic 2 (Story 2.8: `EXAM_HAS_UNCONFIRMED_ANSWERS`, `EXAM_HAS_UNREVIEWED_FLAGS`) and Epic 3 (Story 3.2: `EXAM_NOT_OPEN`, `EXAM_PAST_DUE`) each add their own entries when those gates are actually implemented. **Do not pre-populate codes for gates that don't exist yet** — that's dead code nothing throws (violates Simplicity First / no speculative code).
  - [x] Create `backend/src/common/exceptions/business.exception.ts`: `export class BusinessException extends HttpException` with constructor `(public readonly errorCode: ErrorCode, status: HttpStatus, message: string)`, calling `super({ message, errorCode }, status)`. This is the **only** legal way a business error carries an `errorCode` — nothing else in the codebase should construct an error-envelope object by hand.

- [x] **Task 3 — Global exception filter** (AC: 2, 3)
  - [x] Create `backend/src/common/filters/http-exception.filter.ts`: `@Catch() export class HttpExceptionFilter implements ExceptionFilter`.
  - [x] Logic: resolve `status = exception instanceof HttpException ? exception.getStatus() : 500`.
    - If `status < 500` **and** `exception instanceof HttpException`: build `{ statusCode: status, message, error }` from `exception.getResponse()` (Nest's default shape — string message or array from `ValidationPipe`); if `exception instanceof BusinessException`, additionally include `errorCode: exception.errorCode`.
    - If `status >= 500` (covers both raw thrown `Error`/Prisma errors and an explicit `InternalServerErrorException`): respond with a fixed generic body `{ statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' }` — never the real `exception.message` or stack — and log the full exception (method, URL, stack) server-side via `new Logger('ExceptionsHandler').error(...)`.
  - [x] Do **not** log 4xx exceptions as errors/incidents (AC 3) — a `logger.warn` or no log at all is fine for those.

- [x] **Task 4 — Global response interceptor** (AC: 1)
  - [x] Create `backend/src/common/interceptors/response.interceptor.ts`: `export class ResponseInterceptor<T> implements NestInterceptor`.
  - [x] In the `pipe(map(...))` callback: if the handler's return value is a plain object shaped exactly `{ items: unknown[], meta: object }`, return `{ data: value.items, meta: value.meta }`; otherwise return `{ data: value }` (covers primitives, objects, arrays, `null`).
  - [x] Keep the shape-detection narrow (check both `items` is an array and `meta` is a non-null object) so a controller that legitimately returns a domain object that happens to have an `items` field isn't misdetected — add a short comment explaining this is the deliberate list-payload contract for later paginated endpoints (Stories 2.9, 4.3, 5.3, etc.), since no controller consumes it yet in this story.

- [x] **Task 5 — One shared app-configuration function** (AC: 5)
  - [x] Create `backend/src/common/configure-app.ts` exporting `configureApp(app: INestApplication): void` that calls, in order: `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`, `app.useGlobalInterceptors(new ResponseInterceptor())`, `app.useGlobalFilters(new HttpExceptionFilter())`. (`setGlobalPrefix('api')` stays in `main.ts` — it's an HTTP-server-only concern, not shared with the lightweight e2e harness which already prefixes routes itself.)
  - [x] Update `backend/src/main.ts` to call `configureApp(app)` right after `NestFactory.create(AppModule)` and before `setGlobalPrefix`/`listen`. Don't touch the existing Redis-connection or logging code.

- [x] **Task 6 — Remove the now-redundant manual wrap on `/api/health`** (AC: 1)
  - [x] Change `AppController.getHealth()` to return the raw `{ status: 'ok' }` (drop the manual `{ data: ... }` wrap) — the global interceptor now does this for every controller, and double-wrapping would produce `{ data: { data: { status: 'ok' } } }`.
  - [x] Update `AppService.getHealth()`'s return type usage in `AppController` accordingly (it already returns `{ status: string }`; just return it directly).
  - [x] Update `backend/src/app.controller.spec.ts`: this unit test instantiates `AppController` directly (no interceptor runs), so its assertion must change from `{ data: { status: 'ok' } }` to the raw `{ status: 'ok' }` — it is testing the controller method in isolation, not the full HTTP pipeline.

- [x] **Task 7 — Update the e2e test to exercise the real pipeline** (AC: 1, 5)
  - [x] In `backend/test/app.e2e-spec.ts`, after `moduleFixture.createNestApplication()` and before `app.init()`, call the same `configureApp(app)` from Task 5 (import it — do not hand-roll a second copy of the pipe/interceptor/filter registration).
  - [x] Keep the existing `expect({ data: { status: 'ok' } })` assertion on `GET /api/health` — it should now pass because the **interceptor** (not the controller) produces the wrap. This is the regression check that Task 6's change didn't break the public contract.
  - [x] Do not add `AppModule`/`PrismaModule` to this e2e test — it deliberately stays DB-free (bare `controllers`/`providers`), matching the existing Story 1.1 pattern; only pull in `configureApp`.

- [x] **Task 8 — Tests proving the filter and interceptor actually enforce the ACs** (AC: 1, 2, 3, 4)
  - [x] `backend/src/common/interceptors/response.interceptor.spec.ts`: unit-test `ResponseInterceptor` with a mocked `CallHandler` (`handle: () => of(value)`) for three cases — a plain object → `{ data: value }`; an array → `{ data: [...] }`; an `{ items, meta }` shape → `{ data: items, meta }`.
  - [x] `backend/src/common/filters/http-exception.filter.spec.ts`: unit-test `HttpExceptionFilter.catch()` with a hand-built mock `ArgumentsHost` (`switchToHttp().getResponse()` returning a jest-mocked `{ status, json }`, `getRequest()` returning `{ method, url }`) for three cases:
    1. A built-in `NotFoundException('x')` → `{ statusCode: 404, message: 'x', error: 'Not Found' }`, **no** `errorCode` key.
    2. A `BusinessException('SOME_CODE' as ErrorCode, HttpStatus.CONFLICT, 'y')` → response includes `errorCode: 'SOME_CODE'` alongside `statusCode: 409`. (Construct a throwaway code inline in the test — do not add it to the real `error-codes.ts`.)
    3. A raw `new Error('leaked secret')` → response is exactly `{ statusCode: 500, message: 'Internal server error', error: 'Internal Server Error' }` — assert the literal string `'leaked secret'` is **absent** from the response body (the AC-3 regression guard).
  - [x] A small inline test DTO with one `@IsString()` field, used only inside a spec, to prove `new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }).transform(...)` rejects an invalid payload (throws `BadRequestException`) and accepts a valid one — covers AC 4 without needing a real controller yet.

- [x] **Task 9 — Verify** (AC: 1–5)
  - [x] `npm run build` clean, `npm run lint` clean (strict TS + `no-floating-promises`), `npm test` (unit) and `npm run test:e2e` both green.
  - [x] Manually confirm via the updated e2e assertion (or `curl localhost:3000/api/health` against `docker compose up`) that the real HTTP path returns `{"data":{"status":"ok"}}` with no double-wrap.

## Dev Notes

### Scope guardrails (read first — prevents the most likely mistakes)

- **No business error codes yet.** `error-codes.ts` stays an empty scaffold. `EXAM_HAS_UNCONFIRMED_ANSWERS`/`EXAM_HAS_UNREVIEWED_FLAGS` (Story 2.8) and `EXAM_NOT_OPEN`/`EXAM_PAST_DUE` (Story 3.2) are named in the architecture spine but belong to those future stories — adding them now would be unused dead exports. [Source: ARCHITECTURE-SPINE.md#AD-16]
- **This story is infra-only.** No new DTOs, controllers, or module business logic beyond the one existing `AppController.getHealth()` (which only gets its manual wrap removed). Don't reach into `auth`/`exam`/etc. modules — they're still empty `@Module({})` shells per Story 1.1/1.2 and stay that way until their own stories (1.5+).
- **Don't register globals twice.** The temptation is to add `app.useGlobalPipes(...)` etc. directly in both `main.ts` and the e2e test as copy-pasted blocks — that's exactly the drift Task 5/AC 5 exists to prevent. There must be exactly one function (`configureApp`) that both call.
- **Don't let the interceptor's list-detection get too clever.** It only needs to recognize the specific `{ items, meta }` shape (Task 4) — no need for generic "is this a paginated response" heuristics beyond that, since no controller uses it yet.

### Architecture compliance

- **AD-16 (API envelope, error shape, pagination)** is this story's primary source: `{ data, meta? }` success wrap by a global interceptor; `{ statusCode, message, error, errorCode? }` error shape by a global filter; `errorCode` reserved for multi-cause business errors from the centralized file; unexpected 5xx never leaks internals; lists paginate via `?page=&limit=` returning `data: [...]` + `meta: { page, limit, total }`. [Source: ARCHITECTURE-SPINE.md#AD-16]
- **AD-10 (server-authoritative trust boundary)** — "every controller validates input via a DTO + `ValidationPipe`" is exactly AC 4; this story delivers the *global* pipe so every later controller gets it for free by just declaring a typed DTO parameter, without re-registering anything. [Source: ARCHITECTURE-SPINE.md#AD-10]
- **`docs/PROJECT-STANDARDS.md §6`** is the same contract restated with the concrete example (AD-09 assign gate uses two error codes on one 422) — useful for understanding *why* `errorCode` exists, even though no controller throws one yet.
- **Naming/consistency conventions** — this story's new files live under `backend/src/common/` (`interceptors/`, `filters/`, `exceptions/`), matching `ARCHITECTURE-SPINE.md#Structural Seed`'s "Cross-cutting → `backend/src/common/`" mapping and the kebab-case-file / PascalCase-class convention already used elsewhere in the repo. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions]

### Previous story intelligence (Story 1.1 scaffold, Story 1.2 data model)

- `backend/src/common/` does not exist yet — Story 1.2's Dev Notes explicitly called this out as "arrives with Story 1.3." This story creates it for the first time.
- Backend is under **`strict: true`** TypeScript and **`@typescript-eslint/no-floating-promises: error`**. The interceptor's `map()` operator and the filter's synchronous `catch()` don't involve unawaited promises, but double-check the filter doesn't accidentally return a Promise from `catch()` without handling it — Nest's `ExceptionFilter.catch()` is expected to be synchronous-or-void here (calling `response.status(...).json(...)` directly), so this shouldn't come up, but keep it in mind since 1.1/1.2 reviews both flagged floating-promise mistakes.
- Story 1.2 established `String @id @default(cuid())` and `bcryptjs` cost-10 as load-bearing conventions for later stories — **not relevant to this story** (no Prisma/DB changes here), noted only so this story's dev agent doesn't second-guess or touch `schema.prisma`.
- Story 1.1 left `AppController`/`AppService` as the only real code outside `common/`/`prisma/`; the six domain modules (`auth`, `exam`, `ai-parsing`, `submission`, `dashboard`, `class`) remain empty and cross-module-import-free — this story must not import any of them.
- Both 1.1 and 1.2 reviews flagged **Dev-Agent-Record honesty**: only record commands actually run against the real repo/build, not aspirational verification.

### Current codebase state (verified before writing this story)

- `backend/src/app.controller.ts` currently **manually** wraps: `getHealth() { return { data: this.appService.getHealth() }; }`. This must change per Task 6 or every response becomes double-wrapped once the global interceptor is live.
- `backend/test/app.e2e-spec.ts` already asserts `{ data: { status: 'ok' } }` against a bare `TestingModule` (`controllers: [AppController], providers: [AppService]`, no `AppModule`/DB). It currently passes only because of the controller's manual wrap; after Task 6+7 it must pass because `configureApp` registers the real interceptor in that same bare module.
- `backend/package.json` has **no** `class-validator`/`class-transformer` dependency yet — Task 1 is required before `ValidationPipe` can be used meaningfully (Nest's `ValidationPipe` no-ops without `class-validator` present, but importing it without the package installed will fail at runtime).
- No `backend/src/common/` directory exists. No `APP_FILTER`/`APP_INTERCEPTOR`/`APP_PIPE` DI-token pattern is used anywhere in the codebase yet — this story intentionally uses the imperative `app.useGlobal*()` style (via the shared `configureApp` function) rather than provider-token registration in `AppModule`, because the existing e2e test deliberately avoids importing `AppModule` (to stay DB-free) — provider-token registration would only take effect for tests that import the full `AppModule`.

### Project Structure Notes

- New files: `backend/src/common/exceptions/error-codes.ts`, `backend/src/common/exceptions/business.exception.ts`, `backend/src/common/filters/http-exception.filter.ts`, `backend/src/common/interceptors/response.interceptor.ts`, `backend/src/common/configure-app.ts`, plus `*.spec.ts` siblings for the filter and interceptor.
- Modified files: `backend/src/main.ts`, `backend/src/app.controller.ts`, `backend/src/app.controller.spec.ts`, `backend/test/app.e2e-spec.ts`, `backend/package.json` + lockfile.
- No frontend changes (frontend has no API client to update yet — that lands with the first real feature story). No new NestJS module or Prisma schema change.
- Matches `ARCHITECTURE-SPINE.md#Structural Seed`'s `backend/src/common/` mapping exactly — no variance.

### Testing requirements

- This story is the first to touch the response/error pipeline every later Must-Have test (grading idempotency, role-guard 403s, assignment-gate 422s) will implicitly depend on — get the envelope/error shape right here or every later story's tests inherit the bug.
- Minimum bar (PROJECT-STANDARDS §7, applied to this story): unit tests proving the interceptor's two shapes (plain vs. `{items,meta}`) and the filter's three cases (generic 4xx, business-errorCode, leaked-5xx-guard) — Task 8. The e2e test is the regression guard that the real HTTP pipeline (not just isolated units) produces the contract.
- Don't build a full validation-error-message-format test suite — that's over-scoping; one pass/fail case per Task 8's DTO pipe test is sufficient for this infra story.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.3: Global API envelope, error filter & validation baseline]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#AD-16] (API envelope, error shape, pagination — primary source)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#AD-10] (validation at every controller boundary)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#Consistency Conventions] (naming, `common/` file layout)
- [Source: docs/PROJECT-STANDARDS.md §6 API Conventions] (errorCode rule with the concrete AD-09 example)
- [Source: project-context.md#Code generation rules] (`BusinessException` + centralized `errorCode`, only for multi-cause business errors)
- [Source: _bmad-output/implementation-artifacts/1-2-core-data-model-and-account-class-seeding.md] (`common/` not yet created — confirms this story creates it first; strict TS/lint carryover)
- Codebase state verified directly: `backend/src/main.ts`, `backend/src/app.controller.ts`, `backend/src/app.module.ts`, `backend/test/app.e2e-spec.ts`, `backend/package.json` (no `class-validator`/`class-transformer`), `backend/eslint.config.mjs` (`no-floating-promises: error`).

## Dev Agent Record

### Agent Model Used

claude-sonnet-5 (dev-story)

### Debug Log References

- `npm install class-validator@^0.15.1 class-transformer@^0.5.1` — added to `dependencies`, no `allowScripts` entry needed (pure JS).
- `npm run build` — clean.
- `npm run lint` — 4 initial errors fixed (2x `no-unsafe-member-access` on `json.mock.calls[0][0]` in the filter spec, resolved by capturing the response body via a typed mock callback instead of indexing `.mock.calls`; 1x `no-unsafe-enum-comparison` comparing `status` against `HttpStatus.INTERNAL_SERVER_ERROR`, resolved by widening both sides to an explicit `number`; 1x `no-unsafe-assignment` on the untyped `ValidationPipe.transform()` return, resolved with an explicit cast to `SampleDto`) — clean after fixes.
- `npm test` — 4 suites, 10 tests passed (the "leaked secret" 500 test logs an `[ERROR] [ExceptionsHandler] GET /api/test -> 500` line to the console — expected, that's the filter's required server-side log for 5xx per AC 3).
- `npm run test:e2e` — 1 suite, 1 test passed, confirming `GET /api/health` returns `{"data":{"status":"ok"}}` through the real `configureApp` pipeline (interceptor-produced wrap, not the controller).

### Completion Notes List

- Implemented all 5 ACs via `backend/src/common/`: `ResponseInterceptor` (AC 1, list-payload contract narrowly detected via `items: Array` + `meta: object`), `HttpExceptionFilter` (AC 2/3 — `errorCode` only for `BusinessException`, generic 5xx body never leaks `exception.message`/stack, full context logged server-side, 4xx not logged), global `ValidationPipe` (AC 4), and one shared `configureApp()` used by both `main.ts` and `test/app.e2e-spec.ts` (AC 5).
- `error-codes.ts` left as an empty `ErrorCodes` scaffold per the story's explicit instruction — no speculative codes added.
- `AppController.getHealth()`'s manual `{ data: ... }` wrap removed; `app.controller.spec.ts` now asserts the raw `{ status: 'ok' }` since that unit test bypasses the interceptor by design.
- All 9 tasks' tests pass; no regressions in the pre-existing `app.controller.spec.ts`/`app.e2e-spec.ts`.

### File List

- `backend/src/common/exceptions/error-codes.ts` (new)
- `backend/src/common/exceptions/business.exception.ts` (new)
- `backend/src/common/filters/http-exception.filter.ts` (new)
- `backend/src/common/filters/http-exception.filter.spec.ts` (new)
- `backend/src/common/interceptors/response.interceptor.ts` (new)
- `backend/src/common/interceptors/response.interceptor.spec.ts` (new)
- `backend/src/common/configure-app.ts` (new)
- `backend/src/common/validation-baseline.spec.ts` (new)
- `backend/src/main.ts` (modified — calls `configureApp(app)`)
- `backend/src/app.controller.ts` (modified — returns raw `{ status: 'ok' }`)
- `backend/src/app.controller.spec.ts` (modified — assertion updated to raw shape)
- `backend/test/app.e2e-spec.ts` (modified — calls `configureApp(app)`)
- `backend/package.json` (modified — added `class-validator`, `class-transformer`)
- `backend/package-lock.json` (modified — lockfile update from `npm install`)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-18 | Story drafted via bmad-create-story from epics.md Story 1.3 + ARCHITECTURE-SPINE.md AD-16/AD-10, verified against current backend codebase state. | claude-sonnet-5 (create-story) |
| 2026-07-18 | Implemented all 9 tasks: global `ValidationPipe`, `HttpExceptionFilter`, `ResponseInterceptor`, `BusinessException`/`ErrorCodes` scaffold, shared `configureApp()` wired into `main.ts` and the e2e harness, removed `AppController`'s manual envelope wrap, added unit/e2e test coverage for all ACs. Build/lint/unit/e2e all green. | claude-sonnet-5 (dev-story) |

### Review Findings

_Code review 2026-07-18 (bmad-code-review; Blind Hunter + Edge Case Hunter + Acceptance Auditor). 4/5 ACs pass; AC 2 had a real envelope deviation. 5 findings dismissed as noise._

_Resolution 2026-07-18: 2 decisions ratified as patches by Admin; all 4 patches applied and verified (build / lint / unit 13✓ / e2e 1✓). 2 low-severity items deferred to Story 2.9 (see `deferred-work.md`). Status → done._

- [x] [Review][Patch] Preserve the real 5xx status code instead of flattening to 500 [backend/src/common/filters/http-exception.filter.ts:27] — _(resolved from Decision 2026-07-18 by Admin: preserve status)._ The `status >= 500` branch always responds `statusCode: 500`, collapsing 502/503/504 and defeating NFR-11's 503 graceful-degradation (Story 2.3). Fix: respond with the real `status` and echo it in the body `statusCode`, while still scrubbing the message to the generic `'Internal server error'` and never leaking `exception.message`/stack (AC 3). Update the 5xx filter test accordingly (e.g. add a 503 case).
- [x] [Review][Patch] ResponseInterceptor must bypass void and streamed responses [backend/src/common/interceptors/response.interceptor.ts:34] — _(resolved from Decision 2026-07-18 by Admin: patch now)._ `map()` wraps every emission as `{ data: value }`; a `void`/204 handler becomes `{ data: undefined }` and a future `StreamableFile`/`Buffer` download (EXAM-08 cropped images, `source_file_url`) gets wrapped and corrupted. Fix: return the value untouched when it is a `StreamableFile` (or `undefined`), so downloads/no-content responses pass through the envelope unchanged. Add unit cases for both.
- [x] [Review][Patch] Error envelope omits the mandatory `error` field for `BusinessException` [backend/src/common/filters/http-exception.filter.ts:44] — `BusinessException` calls `super({ message, errorCode })` with no `error` key, so its response is `{ statusCode, message, errorCode }`, violating the §6/AD-16 contract `{ statusCode, message, error, errorCode? }`. Same gap for a hand-thrown `new HttpException('str', 4xx)`. Built-in exceptions are unaffected (their `getResponse()` already carries `error`). Fix: backfill `error` from the status reason phrase when absent, and place `statusCode: status` after the spread so an exception-supplied `statusCode` can't override the real HTTP status.
- [x] [Review][Patch] AC-3 server-side logging is not asserted by any test [backend/src/common/filters/http-exception.filter.spec.ts:60] — the 5xx test proves the leak-guard but never asserts `Logger.error` was invoked with method/URL/stack. Add a `jest.spyOn(Logger.prototype, 'error')` assertion so the mandatory-logging half of AC 3 is regression-covered.
- [x] [Review][Defer] ValidationPipe `transform` won't coerce query params to numbers [backend/src/common/configure-app.ts:10] — deferred, lands with the first pagination DTO. Without `enableImplicitConversion` (or per-field `@Type(() => Number)`), `?page=&limit=` values stay strings; decide the convention when Story 2.9 adds the first paginated endpoint and record it in PROJECT-STANDARDS §6.
- [x] [Review][Defer] `isListPayload` structural detection may misfire on domain objects [backend/src/common/interceptors/response.interceptor.ts:17] — deferred, revisit at Story 2.9. Story 1.3 deliberately accepted narrow structural duck-typing; a future object with `items[]`+`meta{}` would be reshaped (its other fields dropped), and an array `meta` also passes the check. Consider a branded `PaginatedResult`/`instanceof` marker when the first real list endpoint exists.
