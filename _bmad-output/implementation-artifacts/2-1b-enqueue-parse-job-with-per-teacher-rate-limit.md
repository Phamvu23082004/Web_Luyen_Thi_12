---
baseline_commit: 9b2a3a5
---

# Story 2.1b: Enqueue the parse job, with a per-teacher rate limit

Status: done

<!-- Split from the original Story 2.1 at create-story time (Epic 1 retro action item P5).
     2.1a delivered "PDF becomes a Draft exam with its file stored" (AC 1-3). 2.1b adds
     AC 4 (publish the parse job to RabbitMQ) and AC 5 (per-teacher parse-enqueue throttle).
     DEPENDS ON 2.1a being merged — it extends 2.1a's exam.service and exam.controller.
     Decided by Admin, 2026-07-24. -->

## Story

As a teacher,
I want my uploaded exam to be queued for AI parsing automatically and my uploads throttled,
so that the review screen fills itself without me doing anything, and a burst of uploads can't burn the Gemini daily quota. *(FR-4, EXAM-01; supports FR-5, NFR-09)*

## Acceptance Criteria

4. **Creation publishes a parse job.** Given a created Draft exam (from Story 2.1a), when creation completes, then a parse job `{ examId, sourceFileRef, parseGeneration }` is published to RabbitMQ. [Source: epics.md#Story 2.1 AC4; ARCHITECTURE-SPINE.md#AD-13 publish side]
5. **The parse-enqueue endpoint is rate-limited per teacher.** Given a Redis sliding-window rate limiter on the parse-enqueue endpoint (per teacher), when a teacher's upload/parse requests exceed the configured threshold, then further requests in the window return 429, protecting the Gemini daily quota, and the limiter never blocks the submission path. [Source: epics.md#Story 2.1 AC5; ARCHITECTURE-SPINE.md#AD-19; SRS §4 NFR-09]

> AC numbering keeps 4/5 from the original Story 2.1 so the epics.md mapping stays legible. AC 1-3 were delivered in Story 2.1a.

## Tasks / Subtasks

- [x] **Task 1 — Config + env** (AC: 5)
  - [x] Add to the repo-root `.env.example`, each with a one-line comment:
    - `AI_PARSE_RATE_LIMIT_WINDOW_SECONDS=3600`
    - `AI_PARSE_RATE_LIMIT_MAX=20` — per-teacher parse enqueues per window; bounds Gemini daily-quota burn (NFR-09).
  - [x] Mirror both into `docs/PROJECT-STANDARDS.md` §8's required-env table (Story 1.8's review found this table drifts; keep it current).
  - [x] Read both via `getPositiveIntConfig()` from [positive-int-config.ts](../../backend/src/common/config/positive-int-config.ts) — never `?? DEFAULT`, never `ConfigService.get<number>` (retro Pattern 2).
  - [x] If action item **P1**'s boot `validate` has landed, add both to its numeric-required section.

- [x] **Task 2 — Parse-job contract + RabbitMQ publisher** (AC: 4)
  - [x] `backend/src/common/messaging/parse-queue.ts` — one small shared file so the Story 2.2 consumer cannot disagree with this publisher:
    ```ts
    export const AI_PARSE_QUEUE = 'ai.parse';
    export interface ParseJobMessage {
      examId: string;
      sourceFileRef: string;   // the storage key, e.g. exams/<id>/source.pdf
      parseGeneration: number; // AD-21 fencing token
    }
    ```
  - [x] `backend/src/modules/exam/parse-job.publisher.ts`: `@Injectable()` implementing `OnModuleInit`/`OnModuleDestroy`. On init: `amqplib.connect(RABBITMQ_URL)`, `createConfirmChannel()`, `assertQueue(AI_PARSE_QUEUE, { durable: true })`. `publish(job)` → `sendToQueue(AI_PARSE_QUEUE, Buffer.from(JSON.stringify(job)), { persistent: true })` awaiting the broker confirm. On destroy: close the channel and connection (this is the story that finally gives one AMQP handle a graceful shutdown — the repo-wide gap stays deferred, see Dev Notes).
  - [x] **Verify the amqplib 2.x API against `node_modules/amqplib/index.d.ts` before writing this** — the installed version is **2.0.1**, not the 0.10.x every tutorial shows. `connect()` resolves a **`ChannelModel`** (not `Connection`), and 2.x adds an opt-in `connect(url, { recovery: true })` returning a `RecoveringChannelModel`. Prefer the recovery form so a broker blip does not leave a permanently dead publisher — but confirm the option's exact shape in the local typings rather than assuming it.
  - [x] A **confirm** channel (not a plain channel) is the point: a plain `sendToQueue` returns before the broker has the message, so a dropped publish would strand the exam at `pending` forever with no signal. Await the confirm.
  - [x] Attach `on('error')` / `on('close')` listeners — [worker.ts](../../backend/src/worker.ts) documents why (amqplib emits `error` on an EventEmitter with no listener and kills the process).
  - [x] Wire into `ExamModule.providers` + `exports`.

- [x] **Task 3 — `AiParseRateLimitGuard`** (AC: 5)
  - [x] `backend/src/common/guards/ai-parse-rate-limit.guard.ts`, modelled on [login-rate-limit.guard.ts](../../backend/src/common/guards/login-rate-limit.guard.ts) and reusing `SlidingWindowRateLimiterService` unchanged. One dimension only — **per teacher**: key `rate_limit:ai_parse:teacher:<userId>`, `userId` read from `request.user.sub` (never from the body — AD-10).
  - [x] Ordering facts this guard depends on, both true in NestJS 11 and both worth a code comment: (a) **global** guards (`JwtAuthGuard`, `RolesGuard` in [app.module.ts](../../backend/src/app.module.ts)) run **before** route-scoped guards, so `request.user` is already populated; (b) guards run **before** interceptors, so a throttled request is rejected **before** `FileInterceptor` buffers a 20 MB PDF. If either were false the guard would be useless — say so in the comment rather than leaving it implicit.
  - [x] Reject with `new HttpException('...', HttpStatus.TOO_MANY_REQUESTS)` — same single-cause-no-`errorCode` treatment as Story 1.7's 429 (AD-16). **`error-codes.ts` stays empty**; Story 2.8 is its first legitimate consumer.
  - [x] `ai-parse-rate-limit.guard.spec.ts`: allows under the limit; 429 at the limit; the Redis key contains the authenticated teacher's id and nothing from the request body.
  - [x] **Inherited debt (retro D2):** this guard has the **identical fail-closed shape** as `login-rate-limit.guard.ts:76` — an `await limiter.hit()` with no try/catch returns 500 for *every* upload if Redis blips. **Do not fix it here in isolation.** Story 2.3 owns the NFR-11 circuit-breaker / graceful-degradation mechanism, and both guards must become consumers of it. Leave a one-line comment pointing at Story 2.3 so 2.3 knows this is a second consumer.

- [x] **Task 4 — Wire enqueue into the create path** (AC: 4, 5)
  - [x] In [exam.controller.ts](../../backend/src/modules/exam/exam.controller.ts) (created in 2.1a), add `@UseGuards(AiParseRateLimitGuard)` to the `@Post()` create route. The guard runs before `FileInterceptor` (see Task 3), so a throttled teacher never buffers a PDF.
  - [x] In `exam.service.ts`'s `createDraftFromPdf`, **after** the `$transaction` commits, publish the job:
    ```
    ... (2.1a: writeTemp → $transaction(create+rename+update) → committed) ...
    try {
      await this.publisher.publish({
        examId: exam.id,
        sourceFileRef: exam.sourceFileUrl,
        parseGeneration: exam.parseGeneration,   // 1 on first create (AD-21)
      });
    } catch (err) {
      // Dual-write gap, stated honestly: Postgres commit + RabbitMQ publish are
      // NOT atomic. The exam and its file are intact and parse_status stays
      // 'pending'; Story 2.3's manual "retry parsing" is the recovery path.
      // This story does NOT build an outbox/2PC — do not add a comment claiming
      // the enqueue is guaranteed (Epic 1 retro Pattern 3).
      this.logger.error(...full context...);
    }
    ```
  - [x] **Publish AFTER commit, never before.** Publishing inside/before the transaction would let the Story 2.2 worker consume the job and read a row that does not exist yet (or gets rolled back).
  - [x] A publish failure **still returns 201** — the exam is created and recoverable. Say so in the code and the Completion Notes; do not imply a guarantee the code does not have.

- [x] **Task 5 — Tests** (AC: 4, 5)
  - [x] **Unit** extend `exam.service.spec.ts` (mocked publisher): the happy path publishes exactly once with `{ examId, sourceFileRef, parseGeneration: 1 }`; a publisher throw does **not** propagate and the exam is still returned; a transaction throw publishes **nothing** (publish is after commit).
  - [x] **Unit** `ai-parse-rate-limit.guard.spec.ts` per Task 3.
  - [x] **E2E** extend `backend/test/exam-upload.e2e-spec.ts` (fake publisher + fake limiter, both global guards registered): the limiter rejecting → 429 with no `errorCode`; the happy path calls the publisher exactly once; a publisher throw still yields 201.
  - [x] **No new integration spec required.** The transactional property (row + file commit together) is proven in 2.1a's integration spec; 2.1b adds a post-commit side-effect that a fake publisher covers fully. If you add one, it carries a control test (PROJECT-STANDARDS §7).
  - [x] **P3:** every new test observed to fail against a broken implementation before it counts. Record which assertions you broke in the Debug Log.

- [x] **Task 6 — Verify** (AC: 4, 5)
  - [x] Backend: `npm test`, `npm run test:e2e`, `npm run test:integration`, `npm run lint`, `npm run build` — all green/clean (Node 24 via `fnm`).
  - [x] Manual smoke against the running stack (`docker compose up`), recorded honestly: as `teacher.alpha@onthi12.local` / `Password123!`, upload a PDF via `curl` and confirm **a message appears in the `ai.parse` queue** in the RabbitMQ management UI at `:15672` (nothing consumes it until Story 2.2 — an unconsumed durable message is the expected result). Then hammer the endpoint past `AI_PARSE_RATE_LIMIT_MAX` within the window and confirm 429. State plainly what you did **not** run.
  - [x] **No visual-verification task** — backend-only story, no routable screen (PROJECT-STANDARDS §14.2).

## Dev Notes

### Scope guardrails (read first)

- **Depends on Story 2.1a.** This story assumes 2.1a's `exam.service.createDraftFromPdf`, `exam.controller`, `FileStorage`, the schema, and the `exam` module all exist and are merged. It only *adds* the publish step, the publisher, the guard, and their config/tests. If 2.1a is not merged, stop.
- **Backend only.** No frontend. The upload/review UI is Story 2.4 (`Teacher - Review AI Questions`).
- **No consumer, no `worker.ts` change.** This story *publishes* into a durable queue; Story 2.2 adds `assertQueue` + `consume` on the worker side and owns `@google/genai`. A durable message sitting in `ai.parse` with no consumer is the correct end state of 2.1b.
- **No `error-codes.ts` entries.** The 429 is single-cause (AD-16).
- **Do not fix the guard's fail-closed Redis behavior here** — that is Story 2.3's circuit breaker (retro D2). Comment-and-defer.

### The dual-write gap is real — document it, do not paper over it

Postgres commit and RabbitMQ publish are two systems; there is no cross-system transaction here and this story does not build an outbox. The accepted outcome of a publish failure is: **exam created, file stored, `parse_status = pending`, nothing enqueued** — recoverable via Story 2.3's manual "retry parsing", which republishes with a bumped `parse_generation` (AD-21). This is the single most important thing to get right about this story's *documentation*: the Epic 1 retrospective's most dangerous defect class (Pattern 3) was code taking the cheap path while its comments described the expensive one. Here the cheap path is correct and accepted — so the comment must say exactly that, and must not claim the enqueue is guaranteed, transactional, or retried automatically. It is none of those in 2.1b.

### Why publish sits after commit

The Story 2.2 worker consumes `{ examId }` and immediately `exam.markParsing(examId)` then reads the row. If 2.1b published before the transaction committed, the worker could win the race and operate on a row that does not exist yet, or one that a rollback then deletes. Publish-after-commit makes the message always refer to a durably-existing exam. The cost is the dual-write gap above; that trade is the right one (a stranded `pending` exam is recoverable; a worker acting on a phantom row is not).

### `parse_generation` and AD-21

The message carries `parseGeneration`, which is `1` for a freshly-created exam. This story does not *enforce* fencing — Story 2.2's `persistParsedQuestions` applies a result only if its generation matches the exam's current generation, and Story 2.3 *increments* the generation on manual retry. 2.1b's only job is to put the current value on the wire so the fence has something to compare against. Do not add retry/increment logic here.

### Previous story intelligence

- **`SlidingWindowRateLimiterService` is reused unchanged** — [sliding-window-rate-limiter.service.ts](../../backend/src/common/rate-limit/sliding-window-rate-limiter.service.ts). One key, per teacher. Do not re-implement the Lua/window logic; the login guard is the pattern.
- **`getPositiveIntConfig()`** for both numeric vars (retro Pattern 2).
- **amqplib 2.0.1** — read `node_modules/amqplib/index.d.ts`; `connect()` → `ChannelModel`; opt-in `{ recovery: true }` → `RecoveringChannelModel`. The 0.10.x API in most tutorials is wrong for this version.
- **Graceful shutdown is still absent repo-wide** (deferred at Story 1.1; `enableShutdownHooks`, `redis.quit()`, `$disconnect()`, worker AMQP `connection.close()`). This story's publisher should clean up its *own* channel/connection in `OnModuleDestroy` — one new resource tidying after itself — but it does **not** fix the repo-wide gap. That becomes materially riskier at Story 2.2 (worker consuming jobs, SIGTERM mid-job = acked-but-unpersisted parse) and should be raised there.
- **E2E harness precedent**: fake providers, both global guards registered (Story 1.8 review caught an e2e that dropped them).
- **Dev-Agent-Record honesty** reviewed every story; quote counts from real output, state what you did not run.

### Architecture compliance

- **AD-13** — completes the publish side: upload → Draft (`pending`) → store → **publish** → return. Still no Gemini on the HTTP path.
- **AD-19 / NFR-09** — Redis sliding window on parse-enqueue, per teacher, reusing the existing limiter; never touches the submission path.
- **AD-21** — the fencing token travels on the message; enforcement is 2.2, increment is 2.3.
- **AD-16** — 429 single-cause, no `errorCode`; envelope/filter unchanged.
- **AD-10** — teacher id from the verified JWT, never the body.
- **AD-18** — the worker that consumes this queue is a separate process (Story 2.2); 2.1b only produces.

### Project Structure Notes

**New (backend):**
- `backend/src/common/messaging/parse-queue.ts`
- `backend/src/common/guards/ai-parse-rate-limit.guard.ts` (+ `.spec.ts`)
- `backend/src/modules/exam/parse-job.publisher.ts`

**Modified (backend):**
- `backend/src/modules/exam/exam.service.ts` (+ publish-after-commit step)
- `backend/src/modules/exam/exam.service.spec.ts` (+ publish assertions)
- `backend/src/modules/exam/exam.controller.ts` (+ `@UseGuards(AiParseRateLimitGuard)`)
- `backend/src/modules/exam/exam.module.ts` (+ `ParseJobPublisher`)
- `backend/test/exam-upload.e2e-spec.ts` (+ 429 + publish assertions)

**Modified (repo root / docs):**
- `.env.example` (+`AI_PARSE_RATE_LIMIT_WINDOW_SECONDS`, +`AI_PARSE_RATE_LIMIT_MAX`)
- `docs/PROJECT-STANDARDS.md` §8 (+2 rows)

**Untouched on purpose:** `backend/src/worker.ts`, `backend/src/modules/ai-parsing/`, `backend/src/common/exceptions/error-codes.ts`, everything under `frontend/`.

### Testing requirements

| Property | Tier | Why |
|---|---|---|
| Per-teacher throttle → 429; key uses the JWT id, not the body | Unit + E2E | Guard logic + real routing/guard order |
| Publish exactly once, after commit, with the right message | Unit | Pure branch/order logic; fake publisher |
| Publish failure still returns 201 (dual-write gap accepted) | Unit + E2E | The documented, deliberate behavior — test it so nobody later "fixes" it into a 500 |

No new integration spec needed (2.1a proved the transactional property). P3 observed-to-fail rule applies.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Exam schema & create Draft exam by PDF upload] — ACs 4-5 (ACs 1-3 → Story 2.1a)
- [Source: ARCHITECTURE-SPINE.md#AD-13] · [#AD-16] · [#AD-18] · [#AD-19] · [#AD-21] — publish side, envelope, worker split, rate limit, fencing token
- [Source: _bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/addendum.md#B] — async parse via a queue is MVP, not deferred
- [Source: SRS.md §9.6, NFR-09] — rate limiting on AI parsing is MVP-recommended; Gemini free-tier quota is the one external cost
- [Source: docs/PROJECT-STANDARDS.md §7] — test tiers, control test, observed-to-fail rule
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-07-23.md] — Pattern 3 (docs that lie), action item D2 (this guard is 2.3's second circuit-breaker consumer)
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — login-guard fail-closed Redis behavior (Story 1.7), inherited here
- [Source: _bmad-output/implementation-artifacts/2-1a-exam-schema-and-create-draft-exam-by-pdf-upload.md] — the story this one extends
- [Source: _bmad-output/implementation-artifacts/1-7-login-rate-limiting.md] — the rate-limit guard pattern reused here
- Dependency versions verified in `backend/node_modules`: `amqplib@2.0.1` (ChannelModel API, opt-in `recovery`)

## Dev Agent Record

### Agent Model Used

claude-sonnet-5

### Debug Log References

- **P3 observed-to-fail**: for each new assertion below, the described breakage was verified before the fix landed, then the fix made it pass.
  - `exam.service.spec.ts` — "publishes exactly once with the right message": ran with `publisher.publish` not called at all (pre-Task-4 code) → assertion failed (`toHaveBeenCalledTimes(1)` got 0). Failed correctly.
  - `exam.service.spec.ts` — "still returns the exam when the publisher throws": ran with the `try/catch` removed around `this.publisher.publish(...)` → the whole `createDraftFromPdf` call rejected instead of resolving. Failed correctly.
  - `exam.service.spec.ts` — "transaction throws → publishes nothing": ran with the publish call moved *before* `await this.prisma.$transaction(...)` → `publisher.publish` was called despite the transaction throwing. Failed correctly.
  - `ai-parse-rate-limit.guard.spec.ts` — "429 when exceeded" / "keys off the authenticated teacher id": ran with the guard's Redis key built from `request.body.teacherId` instead of `request.user.sub` → the "not the body" assertion failed (key contained the spoofed value). Failed correctly.
  - `exam-upload.e2e-spec.ts` — "429 once a teacher exceeds the window": ran with `AiParseRateLimitGuard` NOT registered on the route → all `PARSE_RATE_LIMIT_MAX + 1` requests returned 201, the `.expect(429)` failed. Failed correctly.
  - `exam-upload.e2e-spec.ts` — "publisher called exactly once…": ran with `ParseJobPublisher` not provided to the testing module → Nest's DI threw at module compile time (`UnknownDependenciesException`), which is itself proof the fake is load-bearing rather than incidental.
- Full backend suite after all fixes: **101 unit / 31 e2e / 9 integration**, `npm run lint` clean, `npm run build` clean, `npx tsc --noEmit` clean across `src/` and `test/`.

### Completion Notes List

- AC 4 (publish) and AC 5 (rate limit) both implemented and wired into `exam.controller.ts` / `exam.service.ts` per the Dev Notes' scope guardrails; no consumer added (Story 2.2's job, left untouched: `worker.ts`, `modules/ai-parsing/`).
- **Dual-write gap is real and accepted, not papered over**: `ParseJobPublisher.publish()` failures are caught in `exam.service.ts`, logged with full context, and the exam is still returned with 201. `parse_status` stays `pending`; there is no outbox/2PC. Verified by both a unit test (publisher throws → exam still returned) and an e2e test (publisher throws → still 201).
- **Publish strictly after commit**: the call sits after the `$transaction` block returns, inside its own nested `try/catch`, so a transaction rollback can never reach the publish step (unit-tested: transaction throw → `publisher.publish` not called).
- `AiParseRateLimitGuard` mirrors `LoginRateLimitGuard`'s shape exactly, including the **inherited fail-closed Redis debt** (Task 3's note, retro D2) — left as a one-line comment pointing at Story 2.3, not fixed here.
- `ParseJobPublisher` uses amqplib 2.0.1's opt-in `{ recovery: true }` (`RecoveringChannelModel`), verified directly against the installed `node_modules/amqplib/index.d.ts` rather than assumed from tutorials — the 0.10.x API most docs show does not apply to this version. A **confirm channel** (`createConfirmChannel` + `sendToQueue(..., callback)`) is used so `publish()` only resolves once the broker has acknowledged the message.
- **Unplanned fix**: `test/integration/exam-create.int-spec.ts` (2.1a's spec) instantiated `ExamService` with only 2 constructor args. `ExamService` now takes a third (`ParseJobPublisher`), so this became a genuine `tsc` arity error (`TS2554: Expected 3 arguments, but got 2`) that `npm run test:integration`'s ts-jest transform did not catch at runtime — the missing publisher just resolved to `undefined`, and the dual-write-gap `try/catch` silently swallowed the resulting `TypeError`, masking the real problem. Found via `npx tsc --noEmit -p tsconfig.json` (not part of the story's own `npm test`/`npm run build` — `build` only compiles `src/`, not `test/`). Fixed by passing a no-op fake `ParseJobPublisher`. This is a fix to an existing file made necessary by this story's constructor signature change, not a new integration spec — the story's "no new integration spec required" guidance is unaffected.
- A `no-base-to-string` ESLint finding in `parse-job.publisher.ts` took two attempts: TypeScript widens `unknown` to `{}` once a preceding truthy/null check narrows it, and `{}` (unlike raw `unknown`) trips the rule when passed to `String()`. Fixed by capturing the callback's `err` into a second, never-narrowed `const cause: unknown = err` binding before the truthy check, then building the `Error` from `cause`.
- Manual smoke test run against the full `docker compose` stack (see below) — **not simulated**.

**Manual smoke test (Task 6) — what was actually run:**
1. `docker compose up -d` — brought up `postgres`, `redis`, `rabbitmq`, `api`, `worker` (postgres/redis were already running from a prior session; rabbitmq/api/worker were freshly started for this test).
2. Both `api` and `worker` containers' anonymous `node_modules` volumes were stale (predated several dependencies) and failed to compile — ran `npm install` inside each container, then `docker compose restart api worker`, until both reached "Found 0 errors" / "Nest application successfully started" / "RabbitMQ connected". This is pre-existing docker-infra staleness, unrelated to this story's code, and not fixed beyond unblocking the smoke test.
3. `npx prisma migrate deploy` — "No pending migrations to apply." `npx prisma db seed` — seeded 9 users/3 classes/8 enrollments (includes `teacher.alpha@onthi12.local` / `Password123!`).
4. Logged in as `teacher.alpha@onthi12.local`, uploaded a real PDF via HTTP multipart (curl was unusable here — Git Bash's MSYS path-conversion mangled the `;type=application/pdf` multipart field into a bogus path; worked around with a hand-built multipart request via PowerShell's `Invoke-RestMethod`). Response: `201` with the expected `{ data: { id, title, subject, durationMinutes, status: 'draft', parseStatus: 'pending' } }` shape.
5. Queried the RabbitMQ management API (`GET /api/queues/%2F/ai.parse`): `durable: true`, `messages_ready: 1`. Fetched the message body (requeuing it, non-destructive): `{"examId":"<id>","sourceFileRef":"exams/<id>/source.pdf","parseGeneration":1}` — exactly the documented shape. Confirmed nothing consumes it (Story 2.2's job).
6. Hammered `POST /api/exams` as the same teacher 22 more times: uploads 1–19 of this batch returned `201` (20th overall in the window, counting the upload in step 4), and the 20th through 22nd of this batch all returned `429` — matching the default `AI_PARSE_RATE_LIMIT_MAX=20` exactly (no `.env` override present; window/max fell back to `getPositiveIntConfig`'s defaults).
7. Final `ai.parse` queue depth: 20 durable, unconsumed messages (expected — no consumer until Story 2.2).
8. Cleanup: stopped `api`, `worker`, `rabbitmq` (the containers this session started) via `docker compose stop`, leaving `postgres`/`redis` running as they were found. The 20 smoke-test exam rows and queued messages were **not** purged — they are harmless dev-database/queue state, consistent with "an unconsumed durable message is the expected result" per the story's own Task 6 wording.
- **What was not run**: no browser/frontend check (backend-only story, no routable screen, per Task 6's own note). Did not verify behavior across a Redis restart or RabbitMQ broker blip (the fail-closed and reconnect-on-blip behaviors are inherited/documented debt, not newly tested here — see Task 3's retro-D2 note and the publisher's recovery-mode comment).

### Review Findings

- [x] [Review][Patch] `ParseJobPublisher.onModuleInit` couples the ENTIRE API's boot to RabbitMQ reachability, and is redundantly instantiated by the worker process too — `backend/src/modules/exam/parse-job.publisher.ts`, `backend/src/modules/exam/exam.module.ts`, `backend/src/main.ts:26-28`, `backend/src/worker.ts:11-15`. Verified: `main.ts`'s `bootstrap().catch(err => { ...; process.exit(1); })` means any provider's `onModuleInit` rejecting kills the whole process — and `ExamModule` (now carrying `ParseJobPublisher`, which does an unguarded `amqplib.connect()`) is unconditionally imported by `AppModule`, which is shared by every entrypoint. A RabbitMQ outage at API boot now takes down auth/submission/dashboard/class endpoints too, not just exam upload — a real availability regression from 2.1a, where the API had no reason to depend on RabbitMQ. Separately, `worker.ts` bootstraps via `NestFactory.createApplicationContext(AppModule)` *before* its own explicit `amqplib.connect()` a few lines later — so the worker process now also instantiates `ParseJobPublisher` and opens a second, entirely unused RabbitMQ connection + confirm channel + queue-assert, on top of the connection `worker.ts` opens for itself. **Decided by Admin during the Story 2.1b code review (2026-07-24): make `onModuleInit` resilient** — catch the connect failure, log it, and retry in the background instead of crashing the whole process; exam upload degrades/503s until connected, everything else boots normally. **FIXED**: `onModuleInit` no longer awaits the connect — it fires it and logs, so app boot never blocks on the broker (amqplib recovery retries in the background; with default `maxRetries: Infinity` the connect promise would otherwise *hang* boot on a down broker, not just crash it). The redundant worker connection is now harmless too: the publisher only opens its handle lazily/in-background and the worker never calls `publish()`.
- [x] [Review][Patch] `ParseJobPublisher` claims automatic self-recovery after a broker blip, but never re-creates the confirm channel after a reconnect, so it goes stale — `backend/src/modules/exam/parse-job.publisher.ts`. Verified against amqplib's own README **and its `lib/recovery.js` source**: the `RecoveringChannelModel` re-creates the *connection* but not channels; the opt-in `recovery.setup(model)` callback is the documented hook that runs after every successful (re)connect. The old code passed bare `{ recovery: true }` with no `setup`, so after a blip `this.channel` still referenced the channel bound to the dead connection and every subsequent `publish()` failed silently until process restart — exactly the "permanently dead publisher" the code's own comment claimed to avoid. **FIXED**: channel creation + `assertQueue` moved into `recovery.setup`, so `this.channel` is rebuilt on every reconnect; the `disconnect` handler clears `this.channel` so `publish()` fails fast (the dual-write gap) in the window before setup re-runs.
- [x] [Review][Patch] `publish()` has no timeout on the confirm-channel ack wait — `backend/src/modules/exam/parse-job.publisher.ts`. If the broker accepts the TCP/channel but never sends the publisher-confirm ack (a stalled channel / partial network partition), the awaited `Promise` in `publish()` never resolves or rejects; `exam.service.ts`'s surrounding `try/catch` only handles rejection, not a hang, so the HTTP request would hang indefinitely. **FIXED**: added a `PUBLISH_CONFIRM_TIMEOUT_MS` (10s) that rejects a stalled confirm, plus a `try/catch` around `sendToQueue` for a synchronous channel-closed throw. exam.service's existing catch turns both into the documented dual-write gap (201, exam stays pending). Covered by new `parse-job.publisher.spec.ts` (fake-timer timeout test).
- [x] [Review][Patch] `onModuleDestroy` isn't resilient to a channel that's already broken/closed — `backend/src/modules/exam/parse-job.publisher.ts`. `await this.channel?.close()` rejecting (e.g., the channel already errored) would abort the sequence before `this.connection?.close()` runs, leaking the socket on shutdown. **FIXED**: each close is now wrapped in its own `try/catch` so a failing channel close still lets the connection close.
- [x] [Review][Defer] Publish failure is only logged server-side; the teacher's 201 response looks identical to the fully-successful path — `backend/src/modules/exam/exam.service.ts:73-88` — deferred, explicitly documented in this story's own Dev Notes as accepted scope (Story 2.3 owns retry/notification).
- [x] [Review][Defer] The guard's documented "inherited debt" (fail-closed on a Redis blip, retro D2) ships with no test pinning today's 500 behavior — `backend/src/common/guards/ai-parse-rate-limit.guard.ts:53-70` — deferred, explicitly out of scope per this story's Task 3 note (Story 2.3 owns the NFR-11 circuit breaker both guards must consume).
- [x] [Review][Defer] No idempotency key on the create endpoint means a client retry after a slow/ambiguous response now duplicates both the exam row AND its enqueued parse job — `backend/src/modules/exam/exam.controller.ts`, `backend/src/modules/exam/exam.service.ts` — deferred, pre-existing gap from Story 2.1a; 2.1b makes the consequence of a retry-duplicate slightly more expensive (doubles real Gemini-quota burn per accidental retry) but does not introduce the underlying gap.

### File List

**New:**
- `backend/src/common/messaging/parse-queue.ts`
- `backend/src/common/guards/ai-parse-rate-limit.guard.ts`
- `backend/src/common/guards/ai-parse-rate-limit.guard.spec.ts`
- `backend/src/modules/exam/parse-job.publisher.ts`
- `backend/src/modules/exam/parse-job.publisher.spec.ts` (added during code review — covers the publish not-ready/nack/confirm-timeout paths)

**Modified:**
- `backend/src/modules/exam/exam.service.ts`
- `backend/src/modules/exam/exam.service.spec.ts`
- `backend/src/modules/exam/exam.controller.ts`
- `backend/src/modules/exam/exam.module.ts`
- `backend/test/exam-upload.e2e-spec.ts`
- `backend/test/integration/exam-create.int-spec.ts` (unplanned — see Completion Notes)
- `backend/src/common/config/validate-env.ts`
- `.env.example`
- `docs/PROJECT-STANDARDS.md`
