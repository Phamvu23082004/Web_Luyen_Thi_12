---
baseline_commit: 9b2a3a5
---

# Story 2.1a: Exam schema & create Draft exam by PDF upload

Status: done

<!-- Split from the original Story 2.1 at create-story time (Epic 1 retro action item P5 —
     the original introduced three new axes, the compound shape that produced Story 1.8's
     25 review findings). 2.1a delivers "a teacher's PDF becomes a Draft exam with its file
     stored" (AC 1-3). 2.1b adds "and it gets enqueued for parsing, under a per-teacher
     throttle" (AC 4-5). Decided by Admin, 2026-07-24. -->

## Story

As a teacher,
I want to create an exam by uploading one PDF and entering its basics,
so that I never retype an exam and the file becomes the exam's single source. *(FR-4, EXAM-01)*

## Acceptance Criteria

1. **The exam data model exists and is owned by `exam`.** Given the Prisma schema, when the migration runs, then `exams` (incl. `status`, `parse_status`, `parse_error`, `parse_generation`, `source_file_url`, `duration_minutes`, `subject`, `title`, `teacher_id`), `exam_classes` (incl. `due_date`), and `questions` (incl. `content`, `options` JSON, `correct_answer` **nullable**, `answer_status`, `reviewed_at` nullable, `ai_confidence`, `image_url`) exist, owned solely by `exam`, with index `questions(exam_id)`. [Source: epics.md#Story 2.1 AC1; ARCHITECTURE-SPINE.md#Structural Seed "Invariant attributes"; AR-3]
2. **Upload creates a Draft exam and stores the PDF behind the storage abstraction, without calling Gemini.** Given a teacher uploads exactly one PDF plus title/subject/duration, when the request is accepted, then the PDF is stored on the local volume behind the `source_file_url` abstraction (**write-temp-then-rename** at `exams/<id>/source.pdf`), a new Exam is created in **Draft** with `parse_status = pending`, and the response returns immediately without calling Gemini. [Source: epics.md#Story 2.1 AC2; ARCHITECTURE-SPINE.md#AD-13, #AD-15]
3. **No PDF, no exam.** Given any attempt to create an exam, when no PDF is provided, then it is rejected — no code path creates an exam without a Source File. [Source: epics.md#Story 2.1 AC3; ARCHITECTURE-SPINE.md#AD-01]

> **Deferred to Story 2.1b** (do NOT build here): AC 4 (publish the parse job to RabbitMQ) and AC 5 (per-teacher parse-enqueue rate limit). A 2.1a exam sits at `parse_status = pending` with **nothing enqueued** — that is 2.1a's correct end state; 2.1b adds the enqueue and its throttle. See Scope guardrails.

## Tasks / Subtasks

- [x] **Task 1 — Prisma schema: `Exam`, `ExamClass`, `Question` + enums** (AC: 1)
  - [x] Add three enums to [schema.prisma](../../backend/src/prisma/schema.prisma), lowercase values (the `Role` enum's precedent — values are what the API and DB both speak, no mapping layer):
    ```prisma
    enum ExamStatus   { draft open closed }
    enum ParseStatus  { pending parsing parsed failed }
    enum AnswerStatus { ai_extracted needs_confirmation manually_confirmed }
    ```
  - [x] Add the three models. `sourceFileUrl` is **NOT NULL** — that is what makes AC 3 structural rather than a controller check (AD-01):
    ```prisma
    // Owned by the `exam` module (AD-05). `exam` is the ONLY writer of `exams`
    // and `questions`; the worker persists through exam's service (AD-07).
    model Exam {
      id              String      @id @default(cuid())
      title           String
      subject         String
      durationMinutes Int         @map("duration_minutes")
      teacherId       String      @map("teacher_id")
      status          ExamStatus  @default(draft)
      sourceFileUrl   String      @map("source_file_url")
      parseStatus     ParseStatus @default(pending) @map("parse_status")
      parseError      String?     @map("parse_error")
      parseGeneration Int         @default(1) @map("parse_generation")
      createdAt       DateTime    @default(now()) @map("created_at")
      updatedAt       DateTime    @updatedAt @map("updated_at")

      teacher     User        @relation(fields: [teacherId], references: [id])
      questions   Question[]
      examClasses ExamClass[]

      @@index([teacherId])
      @@map("exams")
    }

    // Join table. AD-05 assigns this table to the `class` module — Story 2.1a
    // only creates it; Story 2.8's exam.assign() writes it THROUGH class's
    // service interface (AD-06). Do NOT add a write path here.
    model ExamClass {
      examId  String   @map("exam_id")
      classId String   @map("class_id")
      dueDate DateTime @map("due_date") @db.Date

      exam  Exam  @relation(fields: [examId], references: [id], onDelete: Cascade)
      class Class @relation(fields: [classId], references: [id])

      @@id([examId, classId])
      @@map("exam_classes")
    }

    model Question {
      id            String       @id @default(cuid())
      examId        String       @map("exam_id")
      content       String
      options       Json
      correctAnswer String?      @map("correct_answer")
      answerStatus  AnswerStatus @map("answer_status")
      reviewedAt    DateTime?    @map("reviewed_at")
      aiConfidence  Float?       @map("ai_confidence")
      imageUrl      String?      @map("image_url")
      createdAt     DateTime     @default(now()) @map("created_at")
      updatedAt     DateTime     @updatedAt @map("updated_at")

      exam Exam @relation(fields: [examId], references: [id], onDelete: Cascade)

      @@index([examId])
      @@map("questions")
    }
    ```
  - [x] Add back-relations: `examsCreated Exam[]` on `User`, `examClasses ExamClass[]` on `Class`.
  - [x] `@db.Date` on `dueDate` is load-bearing (AD-11/AR-13, UTC+7 off-by-one). Story 2.1a never compares it; the column type must still be right from the first migration.
  - [x] Run `npx prisma migrate dev --name exam_questions_exam_classes` (Node 24 via `fnm` — [[prisma7-dev-env-gotchas]]); then a standalone `npx prisma generate` if the client comes out incomplete (known gotcha). Verify `tsc`/`nest build` sees `prisma.exam` / `prisma.question`.
  - [x] Extend `resetDatabase()` in [prisma-test-client.ts](../../backend/test/integration/prisma-test-client.ts) — children first: `question`, `examClass`, `exam` before `class`/`user`. That file's own comment instructs this ("extend it as Epic 2+ tables land"); skipping it silently breaks every future integration spec.

- [x] **Task 2 — `FileStorage` abstraction + local implementation** (AC: 2)
  - [x] `backend/src/common/storage/file-storage.ts`: `export const FILE_STORAGE = Symbol('FILE_STORAGE')` + the interface. Mirror the `EMAIL_SENDER` shape from [email-sender.ts](../../backend/src/common/email/email-sender.ts) — same precedent, same reason (AD-15's "a later swap to S3/MinIO touches only the storage adapter"):
    ```ts
    export interface FileStorage {
      /** Writes bytes to a temp file inside the storage root; returns its handle. */
      writeTemp(buffer: Buffer, extension: string): Promise<string>;
      /** Atomically publishes a temp file at `key` (mkdir -p + rename). */
      publish(tempHandle: string, key: string): Promise<void>;
      /** Best-effort cleanup of an unpublished temp file; never throws. */
      discardTemp(tempHandle: string): Promise<void>;
    }
    ```
  - [x] `backend/src/common/storage/local-file-storage.service.ts`: `@Injectable()`, root from `ConfigService.get<string>('STORAGE_ROOT')` with a `./storage` fallback. `writeTemp` → `.tmp/<randomUUID()>.<ext>` under the root; `publish` → `mkdir(dirname, { recursive: true })` then `fs.rename` (atomic within one filesystem — this **is** the AD-15 write-temp-then-rename, not a simulation of it, because both paths live under the same root/volume).
  - [x] Assert every resolved path stays under the root (`path.resolve(root, key).startsWith(path.resolve(root) + path.sep)`) and throw otherwise. Keys are server-built today, but this is the check that keeps them safe when Story 2.6 starts building worker-side keys from parse output.
  - [x] `local-file-storage.service.spec.ts`: write→publish lands the bytes at the expected path; `publish` to a traversal key (`../../etc/x`) throws; `discardTemp` on an already-removed file resolves. Use `fs.mkdtemp(os.tmpdir())` as the root, cleaned up in `afterEach`.
  - [x] **Scope guardrail:** this story **writes** files. It does **not** add a static-serving route or a download endpoint — nothing reads `source_file_url` yet. Story 2.2 (worker reads the PDF) and Story 2.4/2.6 (teacher views the file/figures) own reads.

- [x] **Task 3 — Config, env, docker volume** (AC: 2)
  - [x] Add to the repo-root `.env.example` (the one documented env file), each with a one-line comment:
    - `STORAGE_ROOT=./storage` — local blob root behind the AD-15 URL abstraction; `/app/storage` inside the containers.
    - `EXAM_PDF_MAX_BYTES=20971520` — 20 MB upload cap.
  - [x] Mirror both into `docs/PROJECT-STANDARDS.md` §8's required-env table. Story 1.8's review found this table stale after new load-bearing vars landed — do not repeat it.
  - [x] `docker-compose.yml`: add a named volume `exam_files` mounted at `/app/storage` on **both** `api` and `worker` (the worker reads the PDF in Story 2.2 and writes figure crops in 2.6 — AD-15's two single-writer namespaces share one volume), and add `STORAGE_ROOT: /app/storage` to both `environment:` blocks. Declare `exam_files:` under top-level `volumes:` next to `postgres_data`.
  - [x] Read `EXAM_PDF_MAX_BYTES` via `getPositiveIntConfig()` from [positive-int-config.ts](../../backend/src/common/config/positive-int-config.ts) — **never** `?? DEFAULT` and never `ConfigService.get<number>`. This is Epic 1 retro Pattern 2; the helper exists precisely because Story 1.8 re-derived the bug one story after 1.7 fixed it.
  - [x] **Prep note:** action item **P1** (a boot-time `validate` on `ConfigModule.forRoot()`) lands as prep before this story is developed. If it has landed, add `STORAGE_ROOT` / `EXAM_PDF_MAX_BYTES` to that validator's optional-with-format section (blank/non-numeric fails at boot). If it has not, the `getPositiveIntConfig` fallback and the `./storage` default keep this story safe at request time.

- [x] **Task 4 — `exam` module: DTO, service, controller** (AC: 2, 3)
  - [x] Add `@types/multer` to `devDependencies` (types only — `multer@2.2.0` is already installed transitively via `@nestjs/platform-express`, but ships no typings, so `Express.Multer.File` will not resolve without it). This is not a runtime dependency and does not break the Story 1.7/1.8 no-new-dependency precedent; say so in the commit.
  - [x] `backend/src/modules/exam/dto/create-exam.dto.ts`:
    ```ts
    export class CreateExamDto {
      @IsString() @IsNotEmpty() @MaxLength(200) title!: string;
      @IsString() @IsNotEmpty() @MaxLength(100) subject!: string;
      @Type(() => Number) @IsInt() @Min(1) @Max(600) durationMinutes!: number;
    }
    ```
    `@Type(() => Number)` is **required**: multipart text fields arrive as strings and the global `ValidationPipe` has `transform: true` but no `enableImplicitConversion` ([configure-app.ts](../../backend/src/common/configure-app.ts)). This is the same latent gap `deferred-work.md` books against Story 2.9 for query params — use the explicit `@Type` form here and let 2.9 make the repo-wide call.
  - [x] `backend/src/modules/exam/exam.service.ts` — `createDraftFromPdf(teacherId, dto, file)`, in this exact order:
    1. **Validate the bytes, not the label.** `file.mimetype` is client-supplied. Require the buffer to start with the `%PDF-` magic (`file.buffer.subarray(0, 5).toString('latin1') === '%PDF-'`) and throw `BadRequestException` otherwise.
    2. `tempHandle = await storage.writeTemp(file.buffer, 'pdf')` — **outside** the transaction, so a multi-MB disk write never holds a DB transaction open.
    3. `prisma.$transaction(async (tx) => { ... })` — see "Why the rename sits inside the transaction" in Dev Notes for the exact shape; the `fs.rename` runs inside and a rename failure rolls the row back, so **no exam row can exist without its file** (AC 3, AD-01).
    4. On any throw before commit: `await storage.discardTemp(tempHandle)` in a `finally`.
    5. Return the created exam. **Do not enqueue anything** — 2.1b adds the publish step after this line.
  - [x] `backend/src/modules/exam/exam.controller.ts`:
    ```ts
    @Controller('exams')
    export class ExamController {
      @Post()
      @Roles('teacher')
      @UseInterceptors(FileInterceptor('file', {
        storage: memoryStorage(),
        limits: { fileSize: maxBytes, files: 1 },
      }))
      async create(
        @CurrentUser() user: AuthUser,
        @Body() dto: CreateExamDto,
        @UploadedFile() file?: Express.Multer.File,
      ) { ... }
    }
    ```
    - `file === undefined` → `throw new BadRequestException('A PDF file is required')` (AC 3).
    - `memoryStorage()` (not `diskStorage`) — the whole point is that `FileStorage` owns every byte that touches disk; `diskStorage` would write into a second, unmanaged location.
    - `limits.fileSize` must come from `EXAM_PDF_MAX_BYTES`; the interceptor's options need `ConfigService`, so register it via `FileInterceptor` inside a factory or read the value in the module — verify the shape you pick actually receives config at runtime rather than a module-load-time `undefined`.
    - Multer error mapping is already correct in NestJS 11 and needs no custom filter: `LIMIT_FILE_SIZE` → **413** `PayloadTooLargeException`, `LIMIT_FILE_COUNT`/`LIMIT_UNEXPECTED_FILE` → **400** (`@nestjs/platform-express/multer/multer/multer.utils.js`). Assert those codes in the e2e rather than hand-rolling handling.
    - **No `@UseGuards(AiParseRateLimitGuard)` in 2.1a** — the throttle arrives in 2.1b alongside the enqueue it protects. This route is still teacher-only via the global `RolesGuard` + `@Roles('teacher')`.
    - Response body: `{ id, title, subject, durationMinutes, status, parseStatus }` — the global `ResponseInterceptor` wraps it as `{ data: ... }`. Do not hand-build the envelope (AD-16).
  - [x] `exam.module.ts`: replace the empty `@Module({})` with controller + service + `{ provide: FILE_STORAGE, useClass: LocalFileStorageService }`.
  - [x] **Never** trust a client-supplied `teacherId`, `status`, or `parseStatus` — all three are server-set (AD-10). `whitelist: true` + `forbidNonWhitelisted: true` are already global, so an extra body field is a 400; keep it that way.

- [x] **Task 5 — Tests** (AC: 1, 2, 3)
  - [x] **Unit** `exam.service.spec.ts` (mocked Prisma / `FileStorage`): a non-PDF buffer with `mimetype: 'application/pdf'` is rejected; the happy path writes temp → creates the row with `status: draft`, `parseStatus: pending` → returns the exam; a transaction throw calls `discardTemp` and leaves no row.
  - [x] **E2E** `backend/test/exam-upload.e2e-spec.ts` — follow [password-reset.e2e-spec.ts](../../backend/test/password-reset.e2e-spec.ts)'s no-real-infra shape (fake `PrismaService`, fake `FILE_STORAGE`) **and register both global guards** (`{ provide: APP_GUARD, useClass: JwtAuthGuard }`, then `RolesGuard`) — Story 1.8's review caught an e2e that omitted them, so `@Public()`/`@Roles()` regressions were invisible. Assert: anonymous → 401; student token → 403; teacher without a file → 400; teacher with a non-PDF buffer → 400; oversize → 413; happy path → 201 with the `{ data: { ... } }` envelope and no `errorCode` anywhere.
  - [x] **Integration** `backend/test/integration/exam-create.int-spec.ts` (real Postgres, `npm run test:integration`) — the one property a fake structurally cannot show: **the exam row and its file commit together**. Assert (a) a successful create leaves exactly one row whose `source_file_url` resolves to a file that exists on disk; (b) when the `fs.rename` inside the transaction is made to throw, **zero** exam rows exist afterwards and no file is left at the final key; (c) `source_file_url` is genuinely NOT NULL at the database level — a direct `prisma.exam.create` omitting it is rejected by Postgres, not merely by TypeScript.
  - [x] **CONTROL test, mandatory** (PROJECT-STANDARDS §7 — every integration spec carries one): re-implement the naive ordering — create the row, commit, *then* rename — and assert the harness observes the orphan row when the rename fails. If that control ever stops failing, the spec has stopped being able to detect the regression. Model it on the `CONTROL:` block in [password-reset-concurrency.int-spec.ts](../../backend/test/integration/password-reset-concurrency.int-spec.ts).
  - [x] **P3 rule applies to every test above:** a test only counts once you have watched it fail against a deliberately broken implementation. Record in the Debug Log which assertions you actually broke to check.

- [x] **Task 6 — Verify** (AC: 1, 2, 3)
  - [x] Backend: `npm test`, `npm run test:e2e`, `npm run test:integration`, `npm run lint`, `npm run build` — all green/clean (Node 24 via `fnm`).
  - [x] `docker compose up` and confirm the `exam_files` volume mounts on both `api` and `worker`, and that `npx prisma migrate deploy` applies the new migration to a clean database.
  - [x] Manual smoke against the running stack, recorded honestly (Stories 1.5–1.8 precedent — state what you did **not** run): log in as `teacher.alpha@onthi12.local` / `Password123!`, `curl -F file=@<some>.pdf -F title=... -F subject=... -F durationMinutes=45 /api/exams`; confirm 201, a row in `exams` with `status=draft` / `parse_status=pending`, and the file present at `<STORAGE_ROOT>/exams/<id>/source.pdf`. Then confirm a student token gets 403 and a missing file gets 400. **No queue message is produced in 2.1a** — that is expected, not a failure.
  - [x] **No visual-verification task in this story.** PROJECT-STANDARDS §14.2 requires `npm run screenshots` on **front-end** stories; Story 2.1a adds no routable screen (see Dev Notes → Scope guardrails). Do not run it and do not claim it.

### Review Findings

- [x] [Review][Patch] `.gitignore`'s bare `storage/` pattern (line 24) git-ignores `backend/src/common/storage/` — the entire `FileStorage` abstraction (`file-storage.ts`, `local-file-storage.service.ts`, `local-file-storage.service.spec.ts`) is untracked and will never be committed [.gitignore:24] — fixed: anchored to `/backend/storage/`; verified `git check-ignore` no longer matches the source directory
- [x] [Review][Patch] `STORAGE_ROOT` blank-string bypasses `??` fallback and silently resolves to `process.cwd()` instead of failing at boot or applying `./storage` — not added to `validate-env.ts`'s format-checked vars despite Task 3's prep note [backend/src/common/storage/local-file-storage.service.ts:21] — fixed: added `NON_BLANK_IF_PRESENT_VARS` check in `validate-env.ts`, with 3 new spec cases
- [x] [Review][Patch] `CreateExamDto.title`/`subject` accept whitespace-only strings — `@IsNotEmpty()` doesn't reject them [backend/src/modules/exam/dto/create-exam.dto.ts:12-19] — fixed: added a trim `@Transform` before validation, plus a new `create-exam.dto.spec.ts`
- [x] [Review][Patch] `exam-upload.e2e-spec.ts` wires a hardcoded `MulterModule.register` instead of exercising the real `registerAsync` + `getPositiveIntConfig` factory from `exam.module.ts` — the runtime-config-read risk Task 4 flagged is untested [backend/test/exam-upload.e2e-spec.ts] — fixed: switched to the real factory shape; all 6 e2e cases (incl. the 413 path) still pass
- [x] [Review][Patch] Stale TODO comment says to add `EXAM_PDF_MAX_BYTES` to `NUMERIC_VARS` "as its story lands" — it's already added in this diff [backend/src/common/config/validate-env.ts:30-31] — fixed
- [x] [Review][Patch] Comment claims "every relation in this schema is ON DELETE RESTRICT" — this story's own migration makes `questions`/`exam_classes` → `exams` `ON DELETE CASCADE` [backend/test/integration/prisma-test-client.ts:28,33] — fixed
- [x] [Review][Patch] Comment overclaims the in-transaction write as "a single syscall" — `storage.publish()` actually does `mkdir(recursive) + rename`, at least two syscalls [backend/src/modules/exam/exam.service.ts:40-41] — fixed
- [x] [Review][Patch] `docs/PROJECT-STANDARDS.md` §8 marks `STORAGE_ROOT`/`EXAM_PDF_MAX_BYTES` "Required: ✅" alongside genuinely-required vars, though both are optional-with-fallback per their own description text [docs/PROJECT-STANDARDS.md] — fixed: added a clarifying footnote rather than rewriting existing rows (the same ✅-but-optional pattern predates this story, e.g. `PASSWORD_RESET_TOKEN_TTL_MINUTES`)
- [x] [Review][Defer] No sweep/TTL for orphaned `.tmp/` files on process crash between `writeTemp` and `discardTemp` — deferred, symmetric with the already-accepted "orphan published blob" risk, not a Story 2.1a AC [backend/src/common/storage/local-file-storage.service.ts] — deferred, pre-existing risk class already accepted in this story's own Dev Notes for published blobs
- [x] [Review][Defer] No concurrency/memory bound on simultaneous uploads (`memoryStorage()` buffers each file in-process) — deferred, MVP-scale tradeoff per SRS §9's threshold-based optimization principle, not this story's rate-limit concern (that's 2.1b's enqueue throttle) [backend/src/modules/exam/exam.module.ts] — deferred, out of scope per SRS §9
- [x] [Review][Defer] `writeTemp`'s `extension` param isn't path-validated the way `publish`'s `key` is — deferred, not exploitable today since the only caller hardcodes `'pdf'`; relevant once Story 2.6 builds worker-driven keys [backend/src/common/storage/local-file-storage.service.ts:24] — deferred, revisit at Story 2.6
- [x] [Review][Defer] Malformed multipart body (corrupt boundary) isn't explicitly handled — busboy parse errors bypass the documented 413/400 mapping and likely surface as a generic 500; the global exception filter already prevents any internal-detail leak, so this is a wrong-status-code gap, not a correctness/security one [backend/src/modules/exam/exam.controller.ts:28] — deferred, low-impact edge case
- [x] [Review][Defer] No DB-level length constraint on `title`/`subject` beyond the DTO — deferred, speculative hardening beyond any AC, consistent with unbounded `String`/`TEXT` elsewhere in this schema [backend/src/prisma/schema.prisma] — deferred, no AC requires it
- [x] [Review][Defer] Controller response is hand-built with no serializer/`@Exclude()` guardrail against a future field leak — deferred, correct today, and a dedicated response-DTO layer for one endpoint is premature abstraction [backend/src/modules/exam/exam.controller.ts:41-48] — deferred, revisit if a second endpoint needs the same shape

## Dev Notes

### Scope guardrails (read first)

- **Backend only. No frontend in this story.** Story 2.1a's ACs are entirely server-side, and the teacher-facing upload surface is the *same screen* as the review list — SRS §5.2's "Trang tạo đề thi (upload + xem/sửa): bắt đầu bằng khu vực kéo-thả file PDF. Sau khi AI xử lý xong, hiển thị danh sách câu hỏi" — which is `docs/stitch_exports/Teacher - Review AI Questions`, owned by **Story 2.4**. Building a throwaway upload form here would be built twice. Verification is `curl` (Task 6). *This is a scope decision, confirmed with Admin at story creation, not an omission.*
- **No enqueue, no rate limit — those are Story 2.1b.** 2.1a stops at "Draft exam with its file". The RabbitMQ publisher, the `AI_PARSE_*` env vars, the `AiParseRateLimitGuard`, and the publish-after-commit step all live in 2.1b. A 2.1a exam is `parse_status = pending` with nothing in the queue; that is the intended seam.
- **No Gemini. No `@google/genai`.** Not installed, must not be installed here. AD-13 forbids any Gemini call on the HTTP path; Story 2.2 owns the SDK and the worker consumer.
- **No consumer, no `worker.ts` change.** Leave [worker.ts](../../backend/src/worker.ts) as-is (Story 2.2 adds the consumer).
- **No `error-codes.ts` entries.** The 400s (Task 4) are single-cause. `error-codes.ts` has been deliberately empty for four consecutive stories; Story 2.8's assign gate is its first legitimate consumer (AD-16).
- **No file-serving route.** This story writes blobs; nothing reads them yet (Task 2).
- **No `order_index` on `questions`.** Question ordering *will* be needed (FR-15's navigator, addendum H's answer-key-by-sequence) but Story 2.1a never creates a question, and it is not in AC 1's column list. Story **2.2**, the first writer of `questions`, adds it in its own migration. Prisma migrations are cheap and reversible (AD-22); a speculative column is not (CLAUDE.md §2).
- **No pagination / list endpoint.** Story 2.9 owns `GET /api/exams`.

### Why this story was split from 2.1 (Epic 1 retro action item **P5**)

P5: *flag any story introducing more than one new axis and split it.* The original Story 2.1 introduced **three** — (1) three tables + three enums + a migration; (2) multipart upload + a blob-storage abstraction + a Docker volume; (3) a RabbitMQ confirm-channel publisher — the exact compound shape of Story 1.8, which produced 25 patch findings (more than the previous seven stories combined). Admin took the split at create-story time. **2.1a is axes 1 and 2** (schema + upload → stored Draft exam); **2.1b is axis 3** (publish + its per-teacher throttle). The rate limiter was never a fourth axis: `SlidingWindowRateLimiterService` already exists and 2.1b reuses it unchanged.

### Why the rename sits inside the transaction

AD-15 fixes the storage key to `exams/<examId>/source.pdf`, so the path cannot be known until the row's id exists; AD-01 plus a NOT NULL `source_file_url` say the row cannot exist without the file. Those two pull in opposite directions, and the resolution is the ordering below — write it as an interactive transaction:

```
tempHandle = writeTemp(buffer)                    // outside — multi-MB write, no txn held
$transaction(async (tx) => {
  const exam = await tx.exam.create({ data: { ..., sourceFileUrl: PLACEHOLDER } });
  await storage.publish(tempHandle, `exams/${exam.id}/source.pdf`);   // single rename syscall
  return tx.exam.update({ where: { id: exam.id },
                          data: { sourceFileUrl: `exams/${exam.id}/source.pdf` } });
})
```

Failure directions, deliberately asymmetric:

- rename fails → transaction rolls back → **no row, no file**. Correct.
- commit fails after a successful rename → **file with no row**. An orphan blob: harmless, cheap to sweep, never a violation of AD-01. This is the direction you want the failure to fall.

The `fs.rename` inside the transaction is a single syscall on the same volume, in the microseconds range — it does not meaningfully extend the transaction. If a reviewer objects to I/O inside a transaction, that is the answer, and it belongs in the comment. **Do not write a comment claiming any guarantee the code does not have** (Epic 1 retro Pattern 3 — the epic's most dangerous defect class was documentation describing an implementation the code did not actually have).

### `source_file_url` holds a storage **key**, not an absolute URL

The column keeps its schema-mandated name (AR-3, SRS §7) but stores `exams/<id>/source.pdf` — a key the storage adapter resolves. Storing a fully-qualified URL would defeat AD-15's own purpose: swapping to S3/MinIO would then require rewriting every stored value. With a key, the swap is one adapter. **Put this in a schema comment**, because the column name reads like it promises otherwise.

### Previous story intelligence (Epic 1, and what it costs to ignore)

- **`getPositiveIntConfig()` exists — use it** for `EXAM_PDF_MAX_BYTES`. [positive-int-config.ts](../../backend/src/common/config/positive-int-config.ts). `?? DEFAULT` only guards `undefined`, and `ConfigService.get<number>` is a compile-time-only cast. Story 1.8 re-derived this exact bug one story after 1.7 fixed it (retro Pattern 2).
- **Prisma 7 ESM `moduleNameMapper`** — `"^(\\.{1,2}/.*)\\.js$": "$1"` is present in all three Jest configs (`package.json`, `test/jest-e2e.json`, `test/jest-integration.json`). Retro action item **P4** (consolidate them) is still open; do not add a fourth config.
- **Node 24 via `fnm`** for every backend command. `.nvmrc` + `engines` + `engine-strict` landed with retro item C2, so a wrong version now fails loudly.
- **Prisma 7 needs the pg driver adapter** — a bare `new PrismaClient()` does not connect. Mirror [prisma.service.ts](../../backend/src/prisma/prisma.service.ts) if you construct a client anywhere.
- **Interactive `$transaction(async (tx) => ...)` is the form to use.** Story 1.8 shipped the array-of-promises form and its review had to rewrite it, because the array form cannot express "do a thing between the writes". Both forms exist in Prisma 7.8.0.
- **E2E harness precedent**: in-spec `TestingModule`, `PrismaService` overridden by an in-memory fake, real `configureApp()` baseline, **both global guards registered**. See [password-reset.e2e-spec.ts](../../backend/test/password-reset.e2e-spec.ts) and [roles-guard.e2e-spec.ts](../../backend/test/roles-guard.e2e-spec.ts).
- **Integration harness precedent**: `createTestPrismaClient()` + `resetDatabase()` + one deliberate `CONTROL:` test. See [password-reset-concurrency.int-spec.ts](../../backend/test/integration/password-reset-concurrency.int-spec.ts).
- **Dev-Agent-Record honesty is reviewed every story**, and extends to numerical precision — quote test counts from actual command output, and state plainly what you did not run.

### Architecture compliance

- **AD-01 / FR-4** — enforced structurally: `source_file_url` is NOT NULL and the row is created inside the same transaction that publishes the file. No code path to an exam without a Source File.
- **AD-05 / AD-07** — `exam` owns `exams` and `questions` and is their only writer. `exam_classes` is created here but **owned by `class`**; its writer arrives in Story 2.8 through `class`'s service interface (AD-06).
- **AD-13** — upload creates Draft (`parse_status = pending`), stores the file, returns. No Gemini on the HTTP path. (The enqueue that completes AD-13's publish side is 2.1b.)
- **AD-15** — `FileStorage` interface + local adapter; write-temp-then-rename; the HTTP process writes **only** `exams/<id>/source.pdf`.
- **AD-16** — `POST /api/exams` (kebab-case plural under `/api`); `{ data }` from the global interceptor; errors from the global filter; no `errorCode`.
- **AD-21** — `parse_generation` starts at 1. 2.1a only *seeds* the fencing token; 2.2 enforces it and 2.3 increments it on manual retry.
- **AD-10** — DTO + global `ValidationPipe`; `teacherId` from the verified JWT, never the body.
- **NFR-10** — nothing student-identifying is stored alongside the PDF; only the teacher's own id is on the row.

### Project Structure Notes

**New (backend):**
- `backend/src/common/storage/file-storage.ts`
- `backend/src/common/storage/local-file-storage.service.ts` (+ `.spec.ts`)
- `backend/src/modules/exam/exam.controller.ts`
- `backend/src/modules/exam/exam.service.ts` (+ `.spec.ts`)
- `backend/src/modules/exam/dto/create-exam.dto.ts`
- `backend/src/prisma/migrations/<timestamp>_exam_questions_exam_classes/migration.sql`
- `backend/test/exam-upload.e2e-spec.ts`
- `backend/test/integration/exam-create.int-spec.ts`

**Modified (backend):**
- `backend/src/prisma/schema.prisma` (+3 enums, +3 models, +2 back-relations)
- `backend/src/modules/exam/exam.module.ts` (empty `@Module({})` → real module)
- `backend/test/integration/prisma-test-client.ts` (`resetDatabase()` + 3 tables, children first)
- `backend/package.json` (+`@types/multer` devDependency)

**Modified (repo root / docs):**
- `.env.example` (+`STORAGE_ROOT`, +`EXAM_PDF_MAX_BYTES`)
- `docker-compose.yml` (+`exam_files` volume on `api` and `worker`, +`STORAGE_ROOT`)
- `docs/PROJECT-STANDARDS.md` §8 (+2 rows)

**Untouched on purpose:** `backend/src/worker.ts`, `backend/src/modules/ai-parsing/`, `backend/src/common/exceptions/error-codes.ts`, everything under `frontend/`.

### Testing requirements

Story 2.1a is **not** one of PROJECT-STANDARDS §7's three merge-blocking Must-Have areas — but two properties are load-bearing enough to test at the right tier:

| Property | Tier | Why not cheaper |
|---|---|---|
| Role isolation on `POST /api/exams` (student → 403, anonymous → 401) | E2E | Must exercise the **real** global guards |
| No exam row without a file (row + rename commit together) | **Integration** | Transactional. An in-memory `$transaction` fake reports success either way — the exact failure mode Story 1.8 shipped |
| `source_file_url` NOT NULL is real at the DB level | **Integration** | A constraint. TypeScript proves nothing about the migration that ran |
| Magic-byte PDF validation, temp cleanup on failure | Unit | Pure branch logic |

Every integration spec carries a control test; every new test must be observed to fail against a broken implementation before it counts (P3).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 2.1: Exam schema & create Draft exam by PDF upload] — ACs 1-3 (ACs 4-5 → Story 2.1b)
- [Source: ARCHITECTURE-SPINE.md#AD-01] · [#AD-05] · [#AD-07] · [#AD-13] · [#AD-15] · [#AD-16] · [#AD-21] — the invariants this story realizes
- [Source: ARCHITECTURE-SPINE.md#Structural Seed] — invariant attributes and index list (AR-3)
- [Source: SRS.md EXAM-01, §5.2, §7] — "mọi đề thi bắt buộc xuất phát từ 1 file PDF"; the create-exam screen; the `exams`/`questions` column list
- [Source: docs/PROJECT-STANDARDS.md §7] — the three test tiers, the mandatory control test, the observed-to-fail rule
- [Source: docs/PROJECT-STANDARDS.md §14.2] — the visual-verification step, and why it does not apply here
- [Source: _bmad-output/implementation-artifacts/epic-1-retro-2026-07-23.md] — Patterns 1-4, action items P1/P3/P4/P5
- [Source: _bmad-output/implementation-artifacts/1-8-password-reset-via-email.md] — `EmailSender` interface precedent, e2e harness shape, honesty requirements
- Codebase state verified directly: `backend/src/prisma/{schema.prisma,prisma.service.ts,seed.ts}`, `backend/src/{app.module.ts,main.ts,worker.ts}`, `backend/src/common/{configure-app.ts,config/positive-int-config.ts,rate-limit/sliding-window-rate-limiter.service.ts,redis/redis.service.ts,interceptors/response.interceptor.ts,decorators/,types/authenticated-request.ts,email/email-sender.ts}`, `backend/src/modules/exam/exam.module.ts`, `backend/test/{jest-e2e.json,jest-integration.json,integration/*}`, `backend/package.json`, `docker-compose.yml`, `.env.example`
- Dependency versions verified in `backend/node_modules`: `multer@2.2.0` (no bundled typings), `@types/multer` **not installed**, `@google/genai` **not installed**

### Latest technical specifics (verified locally, not from memory)

- **NestJS 11 multer mapping** is already correct: `LIMIT_FILE_SIZE` → 413, the other limit errors → 400 (`@nestjs/platform-express/multer/multer/multer.utils.js`). No custom filter needed.
- **multer 2.2.0** is installed transitively and ships no typings → `@types/multer` is required for `Express.Multer.File`.
- **Guard/interceptor order in NestJS 11**: global guards → controller guards → route guards → interceptors → pipes.
- **Prisma 7.8.0** supports both `$transaction` forms; the interactive callback form is the one this story needs.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Amelia / bmad-dev-story)

### Debug Log References

**Environment.** All backend commands run under Node v24.18.0 via `fnm use 24` ([[prisma7-dev-env-gotchas]]). The default shell Node was v20.

**Prisma client incomplete after `migrate dev` (known gotcha).** `npx prisma migrate dev --name exam_questions_exam_classes` applied the migration but `nest build` then failed with `Module '"generated/prisma/client"' has no exported member 'Exam'` and `Property 'exam' does not exist`. A standalone `npx prisma generate` fixed it; build clean afterwards.

**Raw SQL works in the integration tier.** The NOT-NULL assertion uses `$executeRawUnsafe`; it runs fine under the `--experimental-vm-modules` flag the `test:integration` script already passes. Postgres raises `23502`, but the Prisma pg driver adapter wraps it as `P2010` and carries the native code/message inside — so the test asserts on the surfaced detail (`/23502|null value in column "source_file_url"/`), not the outer wrapper code.

**P3 — every new test observed to fail against a deliberately broken implementation** (PROJECT-STANDARDS §7):
- *Removed the `%PDF-` magic-byte check* (`if (false && …)`): unit `rejects a non-PDF buffer …` FAILED and e2e `rejects a teacher uploading a non-PDF buffer with 400` FAILED. Restored → green.
- *Moved the `fs.rename` (publish) to after the `$transaction`* (naive create-then-rename): integration `rolls the row back and leaves no file when the rename … throws` FAILED (row survived, count 1 not 0) and unit `discards the temp file and persists no row when the transaction throws` FAILED (`update` was called). Restored → green.
- The integration file also carries the mandatory `CONTROL:` test, which passes precisely because the naive ordering it re-implements leaves the orphan row the real transactional version prevents.
- NOT-NULL test is discriminating by construction: a nullable column would let the raw insert succeed, leaving `caught` undefined and failing `expect(caught).toBeDefined()`.

**Test counts (from actual command output):** unit `88 passed / 14 suites` (was 81/13; +3 exam.service, +3 local-file-storage, +1 validate-env — one existing suite gained the EXAM_PDF_MAX_BYTES case rather than a new file, so suite count +1 for exam.service, +1 for local-file-storage = 14 total). e2e `28 passed / 5 suites` (+6 exam-upload). integration `9 passed / 2 suites` (+4 exam-create incl. CONTROL). `npm run lint` clean, `npm run build` clean.

### Completion Notes List

- **AC 1 (schema owned by `exam`).** Three enums + three models added to `schema.prisma`; migration `20260724015036_exam_questions_exam_classes` creates `exams`/`exam_classes`/`questions` with `source_file_url` NOT NULL, `correct_answer` nullable, `due_date DATE`, `options JSONB`, and indexes `exams(teacher_id)` + `questions(exam_id)`. `resetDatabase()` extended, exam children first.
- **AC 2 (upload → stored Draft, no Gemini).** `FileStorage` abstraction + `LocalFileStorageService` (write-temp-then-rename); `POST /api/exams` stores the PDF at `exams/<id>/source.pdf` and creates a Draft with `parse_status=pending`, returning immediately. `source_file_url` holds a storage **key**, not a URL (schema comment records this). No Gemini, no enqueue — verified end-to-end.
- **AC 3 (no PDF, no exam).** Enforced two ways: controller rejects a missing file with 400, and the row is created inside the same transaction that publishes the file so a rename failure rolls it back — proven at the DB level (integration) and structurally by `source_file_url` NOT NULL.
- **Scope honored.** No enqueue / rate-limit (2.1b), no Gemini/SDK, no `worker.ts` change, no `error-codes.ts` entry, no file-serving route, no `order_index`, no list endpoint, no frontend. `MulterModule.registerAsync` reads `EXAM_PDF_MAX_BYTES` via `getPositiveIntConfig` at app init (not a decorator-time `undefined`); `EXAM_PDF_MAX_BYTES` added to `validateEnv`'s numeric vars (P1 had landed).
- **Manual smoke (real app boot, run honestly).** Booted the built app (`node dist/src/main.js`) on port 3999 against the running dev Postgres+Redis (RabbitMQ NOT running and NOT needed for 2.1a). Verified: anonymous `POST /api/exams` → **401**; teacher login → token; teacher upload of a real PDF → **201** `{ data: { id, title, subject, durationMinutes:45, status:draft, parseStatus:pending } }`; file present at `backend/storage/exams/<id>/source.pdf`; DB row `status=draft, parse_status=pending, parse_generation=1, source_file_url=exams/<id>/source.pdf`; teacher with no file → **400**. Smoke row + file cleaned up afterward. `student → 403` was NOT exercised manually (covered by the e2e against the real `RolesGuard`). No queue message is produced — expected in 2.1a.
- **Docker.** `docker compose config` validates the `exam_files` named volume mounted at `/app/storage` on both `api` and `worker`, with `STORAGE_ROOT=/app/storage` on both. `prisma migrate deploy` applying this migration to a clean `postgres:18` is exercised every integration run by `global-setup.ts` ("All migrations have been successfully applied"). A full `docker compose up` of the freshly-built `api`/`worker` images was NOT run (heavy image rebuild); the volume wiring and clean-DB migration are covered by the two checks above.
- Added `backend/storage/` + `storage/` to `.gitignore` (the dev blob root behind `STORAGE_ROOT=./storage`) so local uploads never get committed; containers use the named volume.
- Reverted a spurious line-ending-only change to `migration_lock.toml` (no content diff).

### File List

**New (backend):**
- `backend/src/common/storage/file-storage.ts`
- `backend/src/common/storage/local-file-storage.service.ts`
- `backend/src/common/storage/local-file-storage.service.spec.ts`
- `backend/src/modules/exam/exam.controller.ts`
- `backend/src/modules/exam/exam.service.ts`
- `backend/src/modules/exam/exam.service.spec.ts`
- `backend/src/modules/exam/dto/create-exam.dto.ts`
- `backend/src/modules/exam/dto/create-exam.dto.spec.ts` (added in code review — whitespace-only title/subject)
- `backend/src/prisma/migrations/20260724015036_exam_questions_exam_classes/migration.sql`
- `backend/test/exam-upload.e2e-spec.ts`
- `backend/test/integration/exam-create.int-spec.ts`

**Modified (backend):**
- `backend/src/prisma/schema.prisma` (+3 enums, +3 models, +2 back-relations)
- `backend/src/modules/exam/exam.module.ts` (empty `@Module({})` → controller + service + MulterModule + FILE_STORAGE)
- `backend/src/common/config/validate-env.ts` (+`EXAM_PDF_MAX_BYTES` numeric var)
- `backend/src/common/config/validate-env.spec.ts` (+1 assertion for `EXAM_PDF_MAX_BYTES`)
- `backend/test/integration/prisma-test-client.ts` (`resetDatabase()` + 3 exam tables, children first)
- `backend/package.json` / `backend/package-lock.json` (+`@types/multer` devDependency)

**Modified (repo root / docs):**
- `.env.example` (+`STORAGE_ROOT`, +`EXAM_PDF_MAX_BYTES`)
- `.gitignore` (+`/backend/storage/`; code review found the initial `storage/` line also matched and hid `backend/src/common/storage/`, fixed by anchoring)
- `docker-compose.yml` (+`exam_files` volume + `STORAGE_ROOT` on `api` and `worker`, +top-level `exam_files:`)
- `docs/PROJECT-STANDARDS.md` §8 (+2 env rows)

## Change Log

| Date | Change |
|---|---|
| 2026-07-24 | Story 2.1a implemented: exam/question/exam_class schema + migration; `FileStorage` abstraction + local write-temp-then-rename adapter; `POST /api/exams` (teacher-only) stores the PDF and creates a Draft/pending exam with no Gemini and no enqueue; unit + e2e + integration (with control) tests; env/docker/docs wiring. All tiers green (unit 88, e2e 28, integration 9), lint + build clean. Status → review. |
