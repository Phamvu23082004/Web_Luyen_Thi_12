---
baseline_commit: 353ba302d7b3c6e63824f3d891fc8987449384ee
---

# Story 1.2: Core data model & account/class seeding

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an operator,
I want the core user/class schema and a seed path for teacher accounts and class rosters,
so that people and classes exist to authenticate and be assigned exams, without a full admin console.

## Acceptance Criteria

1. **Schema — exactly three tables.** The Prisma schema defines `users` (`id`, `name`, `email` **unique**, `password_hash`, `role`), `classes` (`id`, `name`, `teacher_id`), and `class_students` (`class_id`, `student_id`) with correct relations. **Only these three tables** are created by this story's migration — no `exams`, `questions`, `exam_classes`, `submissions`, or any other table. [Source: epics.md#Story 1.2]
2. **Migration runs cleanly.** Running the migration against a database creates the three tables with their relations, unique constraint on `users.email`, and the `class_students` composite key. `prisma generate` regenerates the client with the new models and the backend still builds. [Source: epics.md#Story 1.2; ARCHITECTURE-SPINE.md#Structural Seed]
3. **Idempotent seed.** A seed script run against an **empty** database creates teacher and student accounts and class rosters. Passwords are **stored hashed, never plaintext** (NFR-03/AD-10). Re-running the seed does **not** duplicate rows (idempotent — via upsert on natural keys). [Source: epics.md#Story 1.2; ARCHITECTURE-SPINE.md#AD-10]
4. **Single-writer ownership honored (AD-5/AD-6).** The schema is defined such that `users` is conceptually owned by `auth` and `classes`/`class_students` by `class`; nothing in this story adds a code path where another module writes them. (No module business logic exists yet — this is a schema/seed-only story; the constraint is documented, not yet enforced by guards.) [Source: ARCHITECTURE-SPINE.md#AD-05, #AD-06]

## Tasks / Subtasks

- [x] **Task 1 — Define the three Prisma models + `Role` enum** (AC: 1, 4)
  - [x] In `backend/src/prisma/schema.prisma`, add a `Role` enum with values `student` and `teacher` (lowercase, matching the JWT `role` claim in AD-17).
  - [x] Add model `User` mapped to table `users`: `id` (server-generated PK), `name` (String), `email` (String, `@unique`), `passwordHash` (String, `@map("password_hash")`), `role` (`Role`). Map the model with `@@map("users")` and every camelCase field to its snake_case column via `@map` where they differ.
  - [x] Add model `Class` mapped to `classes`: `id`, `name` (String), `teacherId` (`@map("teacher_id")`) with a relation to `User` (the teacher). Use `@@map("classes")`.
  - [x] Add model `ClassStudent` mapped to `class_students`: `classId` (`@map("class_id")`), `studentId` (`@map("student_id")`), relations to `Class` and `User`, and a composite primary key `@@id([classId, studentId])`. Use `@@map("class_students")`.
  - [x] Wire the back-relations on `User` (teaches many `Class`; enrolled in many `ClassStudent`) and `Class` (has many `ClassStudent`) so `prisma validate` passes. Name the two `User`→`Class`/`ClassStudent` relations explicitly if Prisma requires disambiguation (a `User` is both a teacher-of-classes and a student-in-class_students).
  - [x] **Do NOT** add any other model. `exams`, `questions`, `exam_classes`, `submissions`, `answer_details`, `exam_attempts`, `class_exam_stats` are **later stories** (Epic 2/3/5). Adding them here violates AC 1.
  - [x] **ID convention (decide once, reuse for every future table):** use `String @id @default(cuid())`. This is Prisma-idiomatic ("server-generated ids", ARCHITECTURE-SPINE Consistency Conventions) and keeps `teacher_id`/`student_id` FK types consistent. Record this choice in Dev Agent Record so Epic 2+ tables follow it.

- [x] **Task 2 — Create and run the migration** (AC: 2)
  - [x] Run the Prisma 7 migrate command (`npx prisma migrate dev --name core_user_class_model` — Prisma reads schema path + `DATABASE_URL` from `prisma.config.ts`, not from `schema.prisma`). Migrations land in `backend/src/prisma/migrations/` (per `prisma.config.ts`).
  - [x] Confirm the generated SQL creates **only** `users`, `classes`, `class_students` (+ the `Role` enum type), with `users.email` unique and the `class_students` composite PK. Inspect the migration `.sql` before committing.
  - [x] `npx prisma generate` regenerates the client into `backend/generated/prisma/` (git-ignored). Verify `PrismaService` now exposes `user`, `class`, `classStudent` delegates and `npm run build` is clean.
  - [x] Requires a running Postgres — use the local `docker compose up postgres` (or the full stack) with `DATABASE_URL` pointing at it. The compose Postgres is `postgres:18`.

- [x] **Task 3 — Add a password-hashing dependency** (AC: 3)
  - [x] Add **one** hashing library and use it in the seed. Recommended: `bcrypt` (+ `@types/bcrypt` devDep), per AD-10's "bcrypt/argon2" examples. If native-build friction appears under Node 24 / Docker, `bcryptjs` (pure-JS, drop-in) is an acceptable substitute — note whichever you pick in the Dev Agent Record.
  - [x] **This choice is load-bearing for Story 1.5** (login verifies against this same hash). Whatever library + cost factor you pick here **must** be reused verbatim by the `auth` login story. Do not pick a different scheme later.
  - [x] Prisma 7 uses an `allowScripts` allowlist in `package.json` (see Story 1.1) — if the new dependency needs an install script (`bcrypt` compiles native bindings), approve it via `npm approve-scripts` so CI/Docker installs non-interactively.

- [x] **Task 4 — Idempotent seed script + wire it into Prisma config** (AC: 3)
  - [x] Create `backend/src/prisma/seed.ts`. It constructs a `PrismaClient` the **same way `PrismaService` does** — with the `@prisma/adapter-pg` driver adapter and `DATABASE_URL` (Prisma 7 requires the adapter; a bare `new PrismaClient()` will not connect). Import the client from the generated path `../../generated/prisma/client`.
  - [x] Seed at least: a couple of teachers, a couple of classes owned by those teachers (`teacher_id`), several students, and `class_students` rows enrolling students into classes — enough for later auth/exam/dashboard stories to have real people to work with.
  - [x] Hash every password with the Task-3 library **before** insert; never write a plaintext password to `password_hash`.
  - [x] **Idempotency:** use `upsert` keyed on natural keys — `users` on `email` (`@unique`), `class_students` on the `@@id([classId, studentId])` composite. For `classes` (no natural unique column in the schema), use a **stable, explicitly-provided `id`** in the seed (e.g. a fixed cuid/string per class) and upsert on it, so re-running does not create duplicate classes. Re-running the whole seed must leave row counts unchanged.
  - [x] Wire the seed command into `backend/prisma.config.ts` under `migrations.seed` (Prisma 7 config field — confirmed present in `@prisma/config`), e.g. `migrations: { path: "src/prisma/migrations", seed: "ts-node src/prisma/seed.ts" }`. `ts-node` is already a devDependency. If ESM/CJS friction appears when running the seed, `tsx` is a lighter alternative — note which you used.
  - [x] Verify `npx prisma db seed` (or the equivalent Prisma 7 invocation) runs the script.

- [x] **Task 5 — Verify** (AC: 1–4)
  - [x] Prove **exactly three tables** exist after migrate: query `information_schema.tables` (or `\dt`) and assert `users`, `classes`, `class_students` are present and nothing exam/submission-related is. This is the AC-1 guardrail.
  - [x] Run the seed **twice** against the same database and assert identical row counts in all three tables after the second run (idempotency, AC 3).
  - [x] Assert no seeded `password_hash` equals its plaintext source — spot-check one row is a bcrypt/argon2 hash string, not the raw password (AC 3 / NFR-03).
  - [x] A lightweight assertion script under `backend/` (or a Jest spec against the test DB) is sufficient — see Testing requirements. Manual verification of the row-count/idempotency check is acceptable at this stage if an automated harness against a live DB is not yet wired.

### Review Findings

Resolved during code review (2026-07-18) — all 4 applied to `backend/src/prisma/seed.ts` and re-verified: `tsc --noEmit` clean, `eslint` clean, seed run twice via `npx prisma db seed` against the live DB still reports `8 users, 3 classes, 7 enrollments` both times (idempotency intact), and `NODE_ENV=production npx tsx src/prisma/seed.ts` confirmed throws before writing anything.

- [x] [Review][Decision→Patch] Seed script had no environment guard and bakes a single known shared password (`Password123!`) for all 8 accounts — `backend/src/prisma/seed.ts:14`. Decision: add a guard. **Fixed** — `main()` now throws immediately if `NODE_ENV === 'production'`, before hashing or writing anything.
- [x] [Review][Decision→Patch] `users.email @unique` was case-sensitive with no normalization — `backend/src/prisma/schema.prisma:28`. Decision: normalize now, no schema change. **Fixed** — `seed.ts` lowercases every email (`t.email.toLowerCase()` / `s.email.toLowerCase()`) before upsert/lookup; schema and migration untouched.
- [x] [Review][Patch] `seed.ts` enrollment loop didn't validate `classId` against the known `CLASSES` list before upserting `ClassStudent`, unlike the teacher lookup which throws a clear `Seed misconfigured` error [`backend/src/prisma/seed.ts:128`]. **Fixed** — added the same explicit guard (`knownClassIds` set), throws `Seed misconfigured: unknown classId <id> for student <email>` before the upsert.
- [x] [Review][Patch] `seed.ts` user upserts used `update: {}` so re-running the seed never synced a corrected `name`, inconsistent with the `Class` upsert which does sync on rerun [`backend/src/prisma/seed.ts:99`, `126`]. **Fixed** — both teacher and student upserts now `update: { name: ... }`, matching the `Class` upsert pattern.

## Dev Notes

### Scope guardrails (read first — prevents the most likely mistakes)

- **Three tables, full stop.** AC 1 is explicit: only `users`, `classes`, `class_students`. The full ERD in `ARCHITECTURE-SPINE.md#Structural Seed` shows `exams`, `questions`, `exam_attempts`, `submissions`, etc. — those are **future stories** and must not be added here. Pulling them forward is the single most likely error on this story.
- **Schema + seed only — no module logic.** Do not add controllers, services, DTOs, guards, or repository methods to `auth`/`class`. Those modules stay empty `@Module({})` classes (as Story 1.1 left them). AD-5/AD-6 ownership is *documented* here and *enforced* by guards/service interfaces in later stories (1.5, 1.6, and the `class` CRUD stories). [Source: ARCHITECTURE-SPINE.md#AD-05, #AD-06]
- **No auth flow.** Login, JWT, and role guards are Stories 1.5–1.6. This story only produces hashed passwords in the DB so those stories have credentials to verify against.
- **`common/` stays absent.** The global envelope/error filter is Story 1.3 — don't create anything under `backend/src/common/` here.

### Architecture compliance

- **Single-writer ownership (AD-5):** `auth`→`users`; `class`→`classes`, `class_students`, `exam_classes`. `exam_classes` is **not** part of this story (it arrives with exam assignment, Story 2.8). The seed is an *operator* concern (a bootstrap path, not a module) so it may write across `users`/`classes`/`class_students` — that does not violate AD-5, which governs *runtime module* writes. [Source: ARCHITECTURE-SPINE.md#AD-05]
- **Passwords hashed (AD-10 / NFR-03):** bcrypt or argon2, never plaintext. Server-generated ids. [Source: ARCHITECTURE-SPINE.md#AD-10]
- **Role values match the token (AD-17):** the JWT carries `role` ∈ `student|teacher`. Make the `Role` enum values exactly `student`/`teacher` so the login story (1.5) reads the DB value straight into the claim with no mapping. [Source: ARCHITECTURE-SPINE.md#AD-17]
- **Naming (PROJECT-STANDARDS §5 / Consistency Conventions):** DB tables snake_case **plural** (`users`, `classes`, `class_students`); columns snake_case (`password_hash`, `teacher_id`, `class_id`, `student_id`). Prisma models are PascalCase, mapped down with `@@map`/`@map`. Types PascalCase, methods camelCase. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions]
- **Indexes:** none required by this story. The suggested indexes in the architecture (`submissions(student_id, exam_id)`, `questions(exam_id)`, `exam_attempts(student_id, exam_id)`) are all on tables that don't exist yet — do not add them. `users.email @unique` and the `class_students` composite PK provide the lookups this story needs.

### Prisma 7 specifics (current codebase state — carried over from Story 1.1)

The scaffold already established the Prisma 7 wiring; work **with** it, don't re-architect it:
- **Schema currently has zero models** — `backend/src/prisma/schema.prisma` holds only `generator client` (with `output = "../../generated/prisma"`, `moduleFormat = "cjs"`) and a `datasource db` block with **no inline `url`**. The connection string lives in `backend/prisma.config.ts` (`datasource.url = process.env.DATABASE_URL`). [Source: backend/src/prisma/schema.prisma, backend/prisma.config.ts]
- **Driver adapter is mandatory.** `PrismaService` constructs `PrismaClient` with `new PrismaPg({ connectionString: process.env.DATABASE_URL })`. The seed's standalone client must do the same — a plain `new PrismaClient()` fails to connect under Prisma 7. [Source: backend/src/prisma/prisma.service.ts]
- **Generated client path:** `backend/generated/prisma/` (git-ignored via `.gitignore` → `backend/generated/`). Import in code as `../../generated/prisma/client` (matches `PrismaService`). `moduleFormat = "cjs"` was set deliberately to avoid an ESM/CJS `exports is not defined` crash — do not change it.
- **Migrations path:** `backend/src/prisma/migrations/` (set in `prisma.config.ts`), not the default `prisma/migrations`.
- **Seed config:** Prisma 7 reads the seed command from `prisma.config.ts` → `migrations.seed` (a shell command string). Confirmed available in the installed `@prisma/config@7.8.0` types. The old `package.json` `"prisma": { "seed": ... }` block is **not** the Prisma 7 mechanism.
- **Install-script allowlist:** `package.json` has an `allowScripts` block (`prisma`, `@prisma/engines`, `unrs-resolver` pinned). A native dep like `bcrypt` will need adding to it via `npm approve-scripts`.

### Previous story intelligence (Story 1.1)

- The six domain modules (`auth`, `exam`, `class`, …) are **empty isolated `@Module({})` classes** with no cross-module imports — keep them that way; do not import one into another.
- `PrismaModule` is `@Global()` and already imported in `AppModule`; `PrismaService` calls `$connect()` in `onModuleInit`. You get `prisma.user` / `prisma.class` / `prisma.classStudent` for free after `prisma generate` — no new module needed for this story.
- Backend is under **`strict: true`** TypeScript and **`no-floating-promises: error`** ESLint (tightened during 1.1 review). Every async Prisma call in the seed must be `await`ed (or explicitly `void`ed) or lint fails. Provide explicit types on any exported helper.
- Story 1.1's review flagged **Dev-Agent-Record honesty**: it recorded fixes/verifications that weren't in the committed code. Only record what you actually ran and committed — the verification in Task 5 must reflect real command output.
- `.env` handling: `ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'] })` is wired for the Nest runtime; the Prisma CLI reads `backend/.env` via `dotenv/config` in `prisma.config.ts`. Make sure `DATABASE_URL` is resolvable in whichever context you run migrate/seed from (CLI reads `backend/.env`). [Source: Story 1.1 Review Findings]

### Project Structure Notes

- Files this story touches/creates: `backend/src/prisma/schema.prisma` (add models), `backend/src/prisma/migrations/**` (new migration), `backend/src/prisma/seed.ts` (new), `backend/prisma.config.ts` (add `migrations.seed`), `backend/package.json` + lockfile (hashing dep, possible `allowScripts` entry). No frontend changes. No new NestJS module.
- Matches `ARCHITECTURE-SPINE.md#Source tree`: schema + migrations live under `backend/src/prisma/`. No variance detected.

### Testing requirements

- **Must-Have category does not fully apply yet**, but this story is the first to touch data integrity. The relevant bar (PROJECT-STANDARDS §7): correctness of the schema and the **idempotency** guarantee of the seed (foreshadows the NFR-04 idempotency discipline).
- Minimum: the Task-5 verification — (a) exactly three tables exist, (b) double-seed leaves row counts unchanged, (c) `password_hash` is a hash not plaintext. A Jest spec against a disposable/test Postgres is the durable form; a scripted manual check with captured output is acceptable if no test-DB harness exists yet (that harness is not this story's deliverable).
- Do not build a full test-DB CI setup here — that tooling is Story 6.2's concern.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.2: Core data model & account/class seeding]
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#AD-05] (single-writer table ownership)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#AD-06] (cross-module contract)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#AD-10] (server-authoritative trust; passwords hashed)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#AD-17] (JWT role values `student|teacher`)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#Consistency Conventions] (naming, ids)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#Structural Seed] (core entities ERD — future tables NOT in this story)
- [Source: docs/PROJECT-STANDARDS.md §5 Code Organization, §7 Testing Strategy, §9 Database Conventions]
- [Source: SRS.md §7 Mô hình dữ liệu — users/classes/class_students definitions]
- [Source: _bmad-output/implementation-artifacts/1-1-project-scaffold-and-docker-infrastructure.md] (Prisma 7 wiring, strict TS/ESLint, module isolation, Dev-Agent-Record honesty)
- Codebase state verified: `backend/src/prisma/schema.prisma` (zero models), `backend/prisma.config.ts` (seed field available in `@prisma/config@7.8.0`), `backend/src/prisma/prisma.service.ts` (driver-adapter pattern), `backend/package.json` (no hashing lib yet; `allowScripts` allowlist present).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (Claude Code, `/bmad-dev-story`)

### Debug Log References

Issues hit and resolved during implementation (all commands actually run against the local `postgres:18` compose DB):

- **Prisma CLI crashes under Node 20** (`ERR_REQUIRE_ESM` in `@prisma/dev/dist/state.cjs` → `zeptomatch`). The machine's default `node` on PATH is v20.17.0; Prisma 7 needs Node ≥ 22. Fixed by selecting Node 24 via `fnm` (`eval "$(fnm env)" && fnm use 24`) for every Prisma/tsc/lint invocation. Docker/CI already run Node 24, so no repo change was needed — this is a local-shell note only.
- **`prisma migrate dev` left the generated client incomplete** — `generated/prisma/models/` was empty and `models.ts` only re-exported `commonInputTypes`, so `tsc` reported `Property 'user' does not exist on PrismaClient<never, …>`. A standalone `npx prisma generate` regenerated `User.ts`/`Class.ts`/`ClassStudent.ts` and `tsc --noEmit` then passed clean. (The generated dir is git-ignored, so this only affects local builds.)
- **Seed could not run under `ts-node`** — the Prisma 7 `prisma-client` generator emits ESM-style `./internal/class.js` imports; `ts-node` in CommonJS mode resolved them to non-existent `.js` files (`MODULE_NOT_FOUND` at `generated/prisma/client.ts:18`). Switched the seed runner to **`tsx`** (per the story's stated fallback), added `tsx` as a devDependency, and approved `esbuild`'s install script via `npm approve-scripts esbuild` (added to `allowScripts`). Seed then ran successfully.

### Completion Notes List

- **Schema (Task 1 / AC 1, 4):** Added `Role` enum (`student`/`teacher`, lowercase to match the AD-17 JWT claim) and exactly three models — `User`→`users`, `Class`→`classes`, `ClassStudent`→`class_students` — with snake_case `@map`/`@@map`, `users.email @unique`, and a `@@id([classId, studentId])` composite PK. No other model added. Relations are unambiguous (each model pair has a single relation) so no named `@relation` disambiguation was required. `prisma validate` passes.
- **ID convention (decided once, reuse everywhere):** `String @id @default(cuid())` for every table. Keeps `teacher_id`/`student_id` FK types consistent. **Epic 2+ tables must follow this.**
- **Migration (Task 2 / AC 2):** `20260718050016_core_user_class_model`. Inspected SQL — creates only the `Role` enum + `users`/`classes`/`class_students`, `users_email_key` unique index, and the composite PK. `npm run build` clean after generate.
- **Hashing (Task 3 / AC 3):** Chose **`bcryptjs@3.0.3`** (pure-JS, cost factor **10**) over native `bcrypt` to avoid native-build friction between Windows dev and the Linux Docker image and to keep the `allowScripts` allowlist minimal. Types ship with the package (no `@types` needed). **Load-bearing for Story 1.5 — login must verify against bcryptjs cost-10 hashes; do not switch schemes.**
- **Seed (Task 4 / AC 3):** `backend/src/prisma/seed.ts` builds a standalone `PrismaClient` with the `@prisma/adapter-pg` adapter + `DATABASE_URL` (mirrors `PrismaService`). Seeds 2 teachers, 3 classes (stable `seed-class-*` ids), 6 students, and 7 enrollments. Every password hashed with bcryptjs before insert. Idempotent via `upsert` — users on `email`, classes on the fixed `id`, enrollments on the composite key. Wired into `prisma.config.ts` → `migrations.seed = "tsx src/prisma/seed.ts"`.
- **Verification (Task 5 / AC 1–4):** Ran against the live seeded DB via `docker exec … psql`:
  - Exactly three domain tables exist (`users`, `classes`, `class_students`; `_prisma_migrations` excluded) — AC-1 guardrail holds, no exam/submission tables.
  - Double-seed: both runs report `8 users, 3 classes, 7 enrollments`; psql row counts confirm 8/3/7 unchanged after the second run (idempotency).
  - `password_hash` sample is `$2b$10$…`, length 60, and `password_hash = 'Password123!'` is `false` — hashed, never plaintext (AC-3 / NFR-03).
  - `eslint src/prisma/seed.ts` clean (strict TS, no floating promises); `npm run build` clean.
- **Scope discipline:** No NestJS module logic, controllers, services, guards, or `common/` created — schema + seed only, as the story requires. Modules remain empty `@Module({})` classes.

### File List

- `backend/src/prisma/schema.prisma` (modified — `Role` enum + three models)
- `backend/src/prisma/migrations/20260718050016_core_user_class_model/migration.sql` (new)
- `backend/src/prisma/migrations/migration_lock.toml` (new — first migration)
- `backend/src/prisma/seed.ts` (new)
- `backend/prisma.config.ts` (modified — `migrations.seed`)
- `backend/package.json` (modified — `bcryptjs` dep, `tsx` devDep, `esbuild` allowScripts entry)
- `backend/package-lock.json` (modified)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-18 | Implemented Story 1.2 — three Prisma models + `Role` enum, migration `20260718050016_core_user_class_model`, bcryptjs hashing, idempotent `tsx` seed wired into `prisma.config.ts`. All 4 ACs verified against the live DB (3 tables, double-seed idempotency 8/3/7, hashed passwords). Status → review. | claude-opus-4-8 (dev-story) |
