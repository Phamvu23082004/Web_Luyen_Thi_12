---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/prd.md
  - _bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md
  - docs/design-system.md
  - docs/stitch_exports/
---

# OnThi12 - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for OnThi12, decomposing the requirements from the PRD, UX Design, and Architecture into implementable stories.

Design direction is **Vietnamese EdTech Standard** (`docs/design-system.md`); the alternative `warm_edtech_narrative` is not used.

## Requirements Inventory

### Functional Requirements

_26 FRs from PRD §4 (SRS codes and priority noted; Cao=High / TB=Medium / Thấp=Low). All are in MVP._

**Auth & role-based access**
- **FR-1** *(AUTH-01, Cao)*: Email/password login with role routing; token carries verified Role; passwords verified against a stored hash.
- **FR-2** *(AUTH-02, Cao)*: Role-based access enforced on every protected route (Student↔Teacher isolation, 403 on cross-role); role read from token, never client-supplied.
- **FR-3** *(AUTH-03, TB)*: Password reset via time-limited email link; no account-existence leak; used/expired links rejected.

**Exam creation via PDF upload + AI parsing (Teacher)**
- **FR-4** *(EXAM-01, Cao)*: Create an Exam by uploading exactly one PDF (incl. scanned) + title/subject/duration; PDF retained as Source File; new Exam starts Draft; no exam without a file.
- **FR-5** *(EXAM-06, Cao)*: Async multimodal extraction — upload enqueues a job; Gemini returns structured questions (content, 4 options, answer-if-present, figure flag, AI confidence); key backend-only.
- **FR-6** *(EXAM-07, Cao)*: Flag low-confidence/figure questions in the review screen (yellow, distinct from red); Assign blocked while any flag is unresolved/unacknowledged.
- **FR-7** *(EXAM-09, Cao)*: When no answer key, question is `needs_confirmation` (red) and Teacher must click A/B/C/D before Assign; optional answer-key file matches by question number; AI never auto-fills.
- **FR-8** *(EXAM-08, TB)*: Auto-detect + crop figures from Bounding Box (with padding); Teacher confirms/re-crops; on parse failure preserve Source File, clear error, manual retry (bounded retry + circuit breaker).
- **FR-9** *(EXAM-05, TB)*: Edit/delete extracted questions while Draft only; an Exam with ≥1 Submission cannot be deleted (only Closed).
- **FR-10** *(EXAM-02, Cao)*: Assign Exam to ≥1 Class with a due date, flipping Draft→Open — rejected if any question is `needs_confirmation` or has an unresolved flag; due-date comparisons UTC+7-safe.
- **FR-11** *(EXAM-03, Cao)*: List created Exams, filter by Status, show per-Exam submission rate.
- **FR-12** *(EXAM-04, TB)*: Close an Exam at/before due date; after Close no new Submissions; content not visible to Students once not Open.

**Taking exams & auto-grading (Student)**
- **FR-13** *(TAKE-01, Cao)*: View assigned Exams (own Class, Open), filter by done-state and subject, highlight not-yet-done.
- **FR-14** *(TAKE-02, Cao)*: Take a timed exam one question at a time under a countdown; auto-submit at time zero; distraction-free UI.
- **FR-15** *(TAKE-03, TB)*: Question navigator distinguishing answered/unanswered; jump freely without losing answers.
- **FR-16** *(TAKE-04, Cao — highest-risk)*: Submit + auto-grade in one transaction; exactly one Submission per Student per Exam (idempotent); `is_correct`/score server-side; holds under ~40 concurrent submits.
- **FR-17** *(TAKE-05, Cao)*: After submit, show score, correct/incorrect counts, and for each wrong question the chosen vs correct Option.

**Student dashboard**
- **FR-18** *(DASH-01, Cao)*: Personal dashboard — 4 cards (avg score, exams done, study streak, vs-class), score-over-time chart, class comparison.
- **FR-19** *(DASH-02, Cao)*: Filter all dashboard stats by a single subject.
- **FR-20** *(DASH-03, TB)*: Full results-history table with subject filter and date/score sort.

**Teacher dashboard**
- **FR-21** *(DASH-04, Cao)*: Class-overview dashboard — per-Class average + submission rate + at-risk student list ordered by severity heuristic.
- **FR-22** *(DASH-05, Cao)*: Per-Exam stats — score distribution + questions ranked by wrong-answer rate.
- **FR-23** *(DASH-06, TB)*: Individual student detail mirroring that student's personal dashboard.

**Class management**
- **FR-24** *(CLASS-01, Cao)*: Teacher class list — each Class shows student count, average score, most-recent submission rate.
- **FR-25** *(CLASS-02, Cao)*: Class roster table (avg score, last activity) with drill-in to per-student detail (FR-23).
- **FR-26** *(CLASS-03, Thấp)*: Student class view — class info (homeroom teacher, class avg) + mini-leaderboard (top 3 + own rank).

### NonFunctional Requirements

_11 cross-cutting NFRs from PRD §Cross-Cutting NFRs (SRS §4)._

- **NFR-01** — Submission throughput/integrity: ≥40 Students submitting in the same 5-min window, zero data loss.
- **NFR-02** — Dashboard latency <2s for a Class of ≤40 with ≤30 Exams of history (post-MVP cache is the lever).
- **NFR-03** — Security & confidentiality: passwords hashed; Exam content visible to Students only while Open.
- **NFR-04** — Data integrity: Submission is a transaction — never partial, never duplicated (idempotent). *Highest-priority NFR.*
- **NFR-05** — Availability during real exam windows (weekday evenings ~19:00–22:00).
- **NFR-06** — Scalability: add services/cache without a rewrite.
- **NFR-07** — Usability: exam-taking UI minimal/distraction-free, usable on desktop and tablet.
- **NFR-08** — Maintainability: code organized by service module.
- **NFR-09** — AI operating cost: Gemini free tier; key backend-env only; daily quota monitored.
- **NFR-10** — Data privacy on external AI calls: only exam-page imagery sent (no student PII).
- **NFR-11** — AI-dependency reliability: handle Gemini error/timeout/quota — clear message, Source File preserved, no loss.

### Additional Requirements

_Technical requirements from the Architecture Spine (AD-01→22) that shape stories — especially foundational/infra work for Epic 1._

- **AR-1 — Project scaffold** *(Structural Seed)*: monorepo — `backend/` NestJS modular monolith (modules `auth, exam, ai-parsing, submission, dashboard, class` + `common/` + `prisma/`, `main.ts` HTTP + `worker.ts` WORKER entrypoint), `frontend/` React/Vite (`features, components/ui, lib, routes`), `docker-compose.yml` (nginx · api · worker · postgres · redis · rabbitmq), committed `.env.example`. **This drives Epic 1, Story 1.**
- **AR-2 — Pinned stack** *(Stack)*: Node 24.x, TS 5.9.x, NestJS 11.x, Prisma 7.x, PostgreSQL 18.x, Redis 8.x, RabbitMQ 4.x, React 19.x, Vite 8.x, Tailwind+shadcn/ui 4.x, TanStack Query 5.x, Recharts, `@google/genai` (Gemini Flash/Flash-Lite).
- **AR-3 — Data model** *(AD-05, AD-20, entities)*: Prisma schema for `users, classes, class_students, exams, exam_classes, questions, submissions, answer_details, exam_attempts` (+ `class_exam_stats` post-MVP). Invariant columns: `exams.status`, `parse_status`/`parse_error`/`parse_generation`, `source_file_url`; `exam_classes.due_date`; `questions.correct_answer` (nullable), `answer_status`, `reviewed_at` (nullable), `options` (JSON), `ai_confidence`, `image_url`; `exam_attempts.deadline_at`, `status`; `submissions.score` (0–10). Unique: `submissions(student_id, exam_id)`, one in-progress `exam_attempts(student_id, exam_id)`. Indexes: `submissions(student_id, exam_id)`, `questions(exam_id)`, `exam_attempts(student_id, exam_id)`. No topic/type tag column.
- **AR-4 — API envelope & errors** *(AD-16)*: base `/api`, kebab-case plural; global response interceptor `{ data, meta? }`; single global exception filter `{ statusCode, message, error, errorCode? }`; centralized `common/exceptions/error-codes.ts` (`EXAM_HAS_UNCONFIRMED_ANSWERS`/`EXAM_HAS_UNREVIEWED_FLAGS` 422; `EXAM_NOT_OPEN`/`EXAM_PAST_DUE` 409); `?page=&limit=` pagination; 5xx never leak internals.
- **AR-5 — Auth infra** *(AD-10, AD-17)*: minimal-claim JWT (`sub`+`role`); global `JwtAuthGuard` with `@Public()`; `RolesGuard` + `@Roles()` reading role from token; access token short-TTL stateless; refresh token hashed in Redis + rotated on `/refresh`; logout revokes refresh only; password hashing (bcrypt/argon2); DTO + `ValidationPipe` at every controller; never trust client `role`/`score`/`is_correct`.
- **AR-6 — Module boundaries** *(AD-05, AD-06, AD-07)*: single-writer table ownership; cross-module access via owner service interface only (no foreign-table writes); `dashboard` read-only direct-query exception; `exam` is the only writer of `questions`; re-parse replaces all questions atomically, Draft-only.
- **AR-7 — Async parse pipeline** *(AD-02, AD-13, AD-18, AD-21)*: upload creates Draft (`parse_status=pending`) + stores file + publishes `{examId, sourceFileRef}` to RabbitMQ + returns immediately; separate worker (`WORKER=true`) consumes → `markParsing` → Gemini per page → `persistParsedQuestions`/`markParseFailed`; `parse_generation` fencing discards stale results; no Gemini call on HTTP path.
- **AR-8 — Gemini reliability** *(AD-14, NFR-11, addendum G)*: bounded auto-retry (~3, exp backoff + jitter) on transient (timeout/5xx/429); no retry + open circuit on non-retryable (quota/malformed/auth); on failure `parse_status=failed`, preserve Source File, clear message, manual "retry parsing"; only exam-page imagery to Gemini.
- **AR-9 — Blob storage abstraction** *(AD-15)*: MVP local Docker volume behind `source_file_url`/`image_url` URL abstraction; write-temp-then-rename; single-writer namespaces — HTTP writes `exams/<id>/source.pdf`, worker writes `exams/<id>/gen-<n>/fig-<q>.png`.
- **AR-10 — Rate limiting (MVP)** *(AD-19, NFR-09)*: Redis sliding-window limiter on login (per IP + per account) and AI-parse-enqueue (per teacher); 429 on reject; never blocks the submission path.
- **AR-11 — Exam lifecycle gate** *(AD-09, AD-21)*: `exams.status` state machine Draft→Open→Closed (no reopen); `exam.assign()` is the single chokepoint, takes a row lock, re-validates the gate in the same transaction (every question `answer_status ≠ needs_confirmation` and (`reviewed_at` set or never flagged)); question writes rejected once `status ≠ Draft`.
- **AR-12 — Submission integrity** *(AD-11, AD-12, AD-20)*: `exam_attempts` first-class with `deadline_at = min(started_at+duration, due_date)` snapshot server timer; submit accepted while `now ≤ deadline_at` regardless of later Close; single-transaction write; unique-constraint idempotency (duplicate submit = 200 no-op); AD-11 cutoff gates only attempt *start*.
- **AR-13 — UTC+7 date safety** *(AD-11, addendum D)*: normalize every `@db.Date` comparison (`Date.UTC(...)` / `YYYY-MM-DD::date`) — due-date logic and "submitted today" dashboard filters must not off-by-one.
- **AR-14 — Delivery & migration safety** *(AD-22)*: GitHub Actions CI (lint+test+build) gates merge to `main`; deploy on `main`; reversible Prisma migrations; DB backup before prod migrate; rollback = redeploy previous image tag.
- **AR-15 — Concurrency validation** *(NFR-01/04, addendum I)*: lightweight script firing ~40 parallel submits asserting exactly-once rows, no partial writes (capstone proof, not a load-test harness).

### UX Design Requirements

_Actionable UX work items from `docs/design-system.md` (Vietnamese EdTech Standard) + the 11 Stitch mockups in `docs/stitch_exports/`. Each is specific enough to generate testable ACs._

- **UX-DR1 — Design tokens**: implement the Vietnamese EdTech Standard tokens (color palette, Inter typography scale, 4/8px spacing, 10px default radius, 260px sidebar / 1200px container) as the single Tailwind theme config used by all UI.
- **UX-DR2 — Semantic color system (three distinct meanings)**: green = correct/completed/positive growth; amber = low-confidence (FR-6), pending review, time warning; red = missing answer (FR-7), incorrect, critical/error. The **yellow (FR-6) vs red (FR-7) distinction is a hard requirement** — they must never be visually conflated.
- **UX-DR3 — App shell**: fixed 260px left sidebar + fluid content (12-col, max-width 1200px); role-scoped nav (separate Student vs Teacher menus); active item = primary-blue 10% tint + 3px left pill indicator; 20×20 stroke icons.
- **UX-DR4 — Responsive**: sidebar collapses to bottom-nav/hamburger on mobile; horizontal margins shrink to 16px; tablet-friendly, desktop-first (NFR-07).
- **UX-DR5 — Metric Card component**: flat white, 1px `#E2E8F0` border, 10px radius, Label-SM title + H2 metric — the 4 headline cards on Student & Teacher home (FR-18, FR-21, FR-24).
- **UX-DR6 — Multiple-Choice Control component**: large tap targets; 1px border → primary blue when selected; correct/incorrect state fills bg 10% semantic + border 100% semantic — used in Take-Exam (FR-14) and Results review (FR-17).
- **UX-DR7 — Data Table component**: minimalist; Label-MD uppercase headers on light gray; horizontal dividers only (no vertical borders) — Exam list (FR-11), History (FR-20), Roster (FR-25).
- **UX-DR8 — Status Badge component**: 10px rounded, 10% semantic bg + 100% semantic text — Exam status (Draft/Open/Closed) and question flags (low-confidence/missing-answer).
- **UX-DR9 — Button variants**: Primary (solid blue / white text), Secondary (white / Slate-200 border / Slate-800 text), Ghost (blue text, no bg) for secondary actions.
- **UX-DR10 — Progress Bar component**: 8px track; green = complete, primary blue = in-progress — submission rate / completion indicators.
- **UX-DR11 — Focus & keyboard accessibility**: high-contrast focus ring (2px offset primary blue) on all interactive elements; full keyboard navigation — essential during timed tests.
- **UX-DR12 — Question navigator (take-exam)**: overview grid distinguishing answered/unanswered, jump-to-any (FR-15); take-exam surface shows only exam content, no secondary nav (NFR-07).
- **UX-DR13 — Charts (Recharts, themed)**: score-over-time line chart (Student dashboard FR-18/19); score-distribution chart (Teacher per-exam FR-22) — styled to the palette.
- **UX-DR14 — Screen fidelity to mockups**: build each surface to match its Stitch mockup — Student: Home, Exam List, Take Exam, Results, Result Detail, Study History, My Class; Teacher: Home, Exam Management, Review AI Questions, Class Management, Detailed Statistics.

### FR Coverage Map

- **FR-1** → Epic 1 — email/password login with role routing
- **FR-2** → Epic 1 — role-based access enforcement
- **FR-3** → Epic 1 — password reset (real email provider)
- **FR-4** → Epic 2 — create exam by PDF upload
- **FR-5** → Epic 2 — async multimodal question extraction
- **FR-6** → Epic 2 — flag low-confidence/figure questions
- **FR-7** → Epic 2 — confirm missing correct answer
- **FR-8** → Epic 2 — auto-crop question figures
- **FR-9** → Epic 2 — edit/delete questions while Draft
- **FR-10** → Epic 2 — assign exam to classes (gate)
- **FR-11** → Epic 2 — list created exams with submission rate
- **FR-12** → Epic 2 — close exam
- **FR-13** → Epic 3 — view assigned exams
- **FR-14** → Epic 3 — take timed exam with auto-submit
- **FR-15** → Epic 3 — navigate between questions
- **FR-16** → Epic 3 — submit + auto-grade transactionally
- **FR-17** → Epic 3 — review detailed results
- **FR-18** → Epic 4 — personal student dashboard
- **FR-19** → Epic 4 — filter statistics by subject
- **FR-20** → Epic 4 — full results history
- **FR-21** → Epic 5 — class-overview dashboard with at-risk list
- **FR-22** → Epic 5 — per-exam statistics
- **FR-23** → Epic 5 — individual student detail
- **FR-24** → Epic 5 — teacher class list
- **FR-25** → Epic 5 — class roster with drill-in
- **FR-26** → Epic 4 — student class view with mini-leaderboard

## Epic List

### Epic 1: Foundation & Authentication
Users log in with email/password and land in their role-specific experience, with Student↔Teacher access fully isolated. This epic also carries the project foundation (monorepo scaffold, Docker infra for PostgreSQL/Redis/RabbitMQ, core `users`/`classes`/`class_students` schema, global API envelope + error filter, auth infrastructure, design tokens + app shell, CI/CD) folded into its earliest stories — delivered as real login value, not a standalone technical epic.
**FRs covered:** FR-1, FR-2, FR-3
**Supporting:** AR-1, AR-2, AR-3 (core tables), AR-4, AR-5, AR-10 (login), AR-14 · UX-DR1, UX-DR3, UX-DR4, UX-DR9, UX-DR11

### Epic 2: Exam Creation via PDF + AI Parsing
A Teacher creates an Exam by uploading a PDF, the AI extracts questions asynchronously, and the Teacher reviews/corrects, confirms missing answers and figures, and assigns the Exam to classes — with the assignment gate blocking any exam that still has an unconfirmed answer or unresolved flag. Realizes EXAM-01→09 as one seamless flow over the `exam` module + `ai-parsing` worker.
**FRs covered:** FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11, FR-12
**Supporting:** AR-3 (`exams`/`exam_classes`/`questions`), AR-6, AR-7, AR-8, AR-9, AR-10 (AI-parse), AR-11, AR-13 (due_date) · UX-DR2, UX-DR7, UX-DR8

### Epic 3: Taking Exams & Auto-Grading
A Student views assigned Exams, takes one under a server-authoritative countdown (auto-submit at time-out), navigates freely between questions, and on submit is graded instantly in a single atomic, idempotent transaction, then reviews detailed results. Realizes UJ-2 over the `submission` module.
**FRs covered:** FR-13, FR-14, FR-15, FR-16, FR-17
**Supporting:** AR-3 (`exam_attempts`/`submissions`/`answer_details`), AR-12, AR-13 (submit), AR-15 · UX-DR6, UX-DR11, UX-DR12

### Epic 4: Student Dashboard & Class View
A Student tracks personal progress — headline cards, score-over-time chart, class comparison, subject filtering, full history table — and views their class info with a mini-leaderboard. Read-side only (no submission-path coupling). Realizes UJ-3 over the `dashboard` read layer + `class` reads.
**FRs covered:** FR-18, FR-19, FR-20, FR-26
**Supporting:** AD-08 read-side · UX-DR5, UX-DR7, UX-DR13

### Epic 5: Teacher Dashboard & Class Management
A Teacher sees class overviews (average, submission rate, at-risk list by severity), per-exam statistics (score distribution, most-missed questions), individual student detail, the class list, and class rosters with drill-in to any student. Realizes UJ-4 over the `dashboard` read layer + `class` module.
**FRs covered:** FR-21, FR-22, FR-23, FR-24, FR-25
**Supporting:** AD-08 read-side · UX-DR7, UX-DR13

### Epic 6: Production Deployment
The system runs on a public VPS behind Nginx + SSL, with every merge to `main` gated by CI and auto-deployed, and production database migrations performed safely with backups and a rollback path. Delivers real availability (NFR-05) rather than new user features; realizes AD-22. Provisioning the VPS + domain is an operator prerequisite.
**FRs covered:** — (infrastructure; supports all FRs in production)
**Supporting:** AR-14, AD-22 · NFR-05

## Epic 1: Foundation & Authentication

Users log in with email/password and land in their role-specific experience with Student↔Teacher access fully isolated. Foundational work (scaffold, Docker infra, core schema, API envelope, auth infrastructure, design tokens, app shell) is folded into the earliest stories so the epic ships as real login value rather than a standalone technical epic.

### Story 1.1: Project scaffold & Docker infrastructure

As a developer,
I want the monorepo and local infrastructure scaffolded and running,
So that every later story has a working backend, frontend, database, cache, and queue to build on.

**Acceptance Criteria:**

**Given** a clean checkout
**When** the scaffold is created
**Then** `backend/` is a NestJS app (modules `auth, exam, ai-parsing, submission, dashboard, class` + `common/` + `prisma/`, `main.ts` HTTP entry and `worker.ts` `WORKER=true` entry) and `frontend/` is a React + Vite app (`features, components/ui, lib, routes`)
**And** the pinned stack versions (AR-2) are used.

**Given** `docker-compose.yml`
**When** `docker compose up` runs
**Then** PostgreSQL, Redis, and RabbitMQ start and the backend connects to all three, and in local dev the frontend reaches the backend directly (Vite proxies `/api` to `:3000`) — **no Nginx is required locally**.
**And** a committed `.env.example` documents every required variable (`DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`, `GEMINI_API_KEY`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV`, `EMAIL_PROVIDER_API_KEY`) with no real secrets committed.

**Given** production delivery (VPS, Nginx reverse proxy + SSL, GitHub Actions deploy step)
**When** it is considered
**Then** it is handled in **Epic 6 (Production Deployment)** — local dev needs no Nginx; CI that gates merges (lint + test + build, AR-14) runs on GitHub and needs no VPS.

**Given** the backend is running
**When** `GET /api/health` is called
**Then** it returns 200 with a basic status payload wrapped in the `{ data }` envelope.

### Story 1.2: Core data model & account/class seeding

As an operator,
I want the core user/class schema and a seed path for teacher accounts and class rosters,
So that people and classes exist to authenticate and be assigned exams, without a full admin console.

**Acceptance Criteria:**

**Given** the Prisma schema
**When** the migration runs
**Then** `users` (id, name, email unique, password_hash, role), `classes` (id, name, teacher_id), and `class_students` (class_id, student_id) exist with correct relations, and only these three tables are created in this story.

**Given** the seed script
**When** it runs against an empty database
**Then** it creates teacher and student accounts (passwords stored hashed, never plaintext) and class rosters, and is idempotent (re-running does not duplicate rows).

**Given** the single-writer rule (AR-6)
**When** the schema is defined
**Then** `users` is owned by `auth` and `classes`/`class_students` by `class`; no other module writes them.

### Story 1.3: Global API envelope, error filter & validation baseline

As a frontend developer,
I want every API response and error to have one consistent shape,
So that clients never branch on ad-hoc formats and 5xx internals never leak.

**Acceptance Criteria:**

**Given** any successful controller response
**When** it is returned
**Then** a global interceptor wraps it as `{ data, meta? }`, with list endpoints returning `meta: { page, limit, total }` for `?page=&limit=`.

**Given** any thrown exception
**When** it reaches the boundary
**Then** a single global exception filter builds `{ statusCode, message, error, errorCode? }`, where `errorCode` is present only for multi-cause business errors and comes from a centralized `common/exceptions/error-codes.ts` (no inline literals).

**Given** an unexpected 5xx
**When** it is returned to the client
**Then** the response carries a generic message only (no internal message/stack) and the full context + stack is logged server-side.

**Given** any controller with a body/query
**When** input arrives
**Then** a global `ValidationPipe` validates the DTO and rejects invalid input with a 400 before the handler runs.

### Story 1.4: Design tokens & role-aware app shell

As a user,
I want a consistent, accessible application shell,
So that I navigate the product coherently on desktop and tablet before any feature screen exists.

**Acceptance Criteria:**

**Given** the Vietnamese EdTech Standard design system (`docs/design-system.md`)
**When** the Tailwind theme is configured
**Then** its color palette, Inter typography scale, 4/8px spacing, and 10px default radius are the single token source for all UI (UX-DR1), and the three semantic colors are defined distinctly — green (good), amber (warning/low-confidence), red (missing-answer/error) — so they can never be conflated (UX-DR2).

**Given** an authenticated user
**When** the shell renders
**Then** a fixed 260px left sidebar + fluid content (max-width 1200px) shows role-scoped navigation, with the active item styled as a 10% primary tint + 3px left pill indicator (UX-DR3).

**Given** a narrow (mobile/tablet) viewport
**When** the shell renders
**Then** the sidebar collapses to a hamburger/bottom nav and horizontal margins shrink to 16px (UX-DR4).

**Given** keyboard navigation
**When** an interactive element receives focus
**Then** it shows a high-contrast 2px offset primary-blue focus ring, and Primary/Secondary/Ghost button variants render per spec (UX-DR9, UX-DR11).

**Given** the Stitch mockups in `docs/stitch_exports/`
**When** any feature screen is built in later stories
**Then** it is implemented to match its corresponding mockup (Student: Home, Exam List, Take Exam, Results, Result Detail, Study History, My Class; Teacher: Home, Exam Management, Review AI Questions, Class Management, Detailed Statistics) — this fidelity is a cross-cutting acceptance bar for every front-end story. *(UX-DR14)*

### Story 1.5: Email/password login with JWT and role routing

As a user,
I want to log in with email and password,
So that I reach my own Student or Teacher experience. *(FR-1)*

**Acceptance Criteria:**

**Given** valid credentials
**When** the user logs in
**Then** the password is verified against the stored hash, an access token carrying `sub` + verified `role` (minimal claims) is issued, and the frontend lands on the role-specific home.

**Given** invalid credentials
**When** the user submits
**Then** login is rejected without revealing which field was wrong, and no token is issued.

**Given** a successful login
**When** the token pair is created
**Then** the short-TTL access token is verified statelessly per request and a longer-lived refresh token is stored **hashed in Redis** and rotated on `/refresh`; logout revokes the stored refresh token only. *(AR-5)*

**Given** a `role` value supplied in the request body
**When** login or any authenticated call is processed
**Then** it is ignored — role is read only from the verified token. *(AR-5)*

### Story 1.6: Role-based access enforcement & isolation

As the system,
I want every protected route gated by role,
So that Students cannot reach Teacher functions and vice versa. *(FR-2)*

**Acceptance Criteria:**

**Given** a global `JwtAuthGuard`
**When** any route except `@Public()` ones (login/reset) is called without a valid token
**Then** it returns 401.

**Given** a Student token
**When** it calls any Teacher-only endpoint
**Then** `RolesGuard` + `@Roles()` returns 403 (not data); the same holds for a Teacher token on a Student-only endpoint.

**Given** the frontend
**When** a user navigates
**Then** route guards prevent rendering the other role's pages and the sidebar shows only that role's menu items.

### Story 1.7: Login rate limiting

As the system,
I want login attempts rate-limited,
So that brute-force attacks are throttled without affecting legitimate traffic. *(AR-10, AR-19)*

**Acceptance Criteria:**

**Given** a Redis sliding-window limiter on the login endpoint
**When** attempts exceed the configured threshold for an IP or a target account
**Then** further attempts in the window return 429.

**Given** the limiter
**When** any non-login path (including submission) is called
**Then** it is never blocked by the login limiter.

### Story 1.8: Password reset via email

As a user,
I want to reset a forgotten password and receive a real email,
So that I can regain access on my own. *(FR-3)*

**Acceptance Criteria:**

**Given** a reset request for a registered email
**When** it is submitted
**Then** a time-limited, single-use reset token is created and the reset link is delivered by a real transactional email provider (e.g. Resend or Brevo free tier) behind a provider-agnostic email interface, with the provider API key read from backend env only (`EMAIL_PROVIDER_API_KEY`), never committed or exposed to the frontend.

**Given** a reset request for an unknown email
**When** it is submitted
**Then** the response reveals nothing about whether the account exists.

**Given** a used or expired reset token
**When** it is presented to set a new password
**Then** it is rejected; a valid token sets a new hashed password.

## Epic 2: Exam Creation via PDF + AI Parsing

A Teacher creates an Exam by uploading a PDF, the AI extracts questions asynchronously, and the Teacher reviews/corrects, confirms missing answers and figures, then assigns to classes — with the assignment gate blocking any exam that still has an unconfirmed answer or unresolved flag. Realizes EXAM-01→09 as one seamless flow over the `exam` module + `ai-parsing` worker.

> **Story 2.1 was split at create-story time (2026-07-24)** into **2.1a** and **2.1b**, per Epic 1 retrospective action item P5 — the original introduced three new axes (schema + migration, multipart upload + blob storage + volume, RabbitMQ confirm-channel publisher), the compound shape that produced Story 1.8's 25 review findings. AC 1-3 → 2.1a; AC 4-5 → 2.1b. 2.1b depends on 2.1a. The five ACs below are preserved verbatim under their new stories.

### Story 2.1a: Exam schema & create Draft exam by PDF upload

As a teacher,
I want to create an exam by uploading one PDF and entering its basics,
So that I never retype an exam and the file becomes the exam's single source. *(FR-4)*

**Acceptance Criteria:**

**Given** the Prisma schema
**When** the migration runs
**Then** `exams` (incl. `status`, `parse_status`, `parse_error`, `parse_generation`, `source_file_url`, `duration_minutes`, `subject`, `title`, `teacher_id`), `exam_classes` (incl. `due_date`), and `questions` (incl. `content`, `options` JSON, `correct_answer` **nullable**, `answer_status`, `reviewed_at` nullable, `ai_confidence`, `image_url`) exist, owned solely by `exam`, with index `questions(exam_id)`.

**Given** a teacher uploads exactly one PDF plus title/subject/duration
**When** the request is accepted
**Then** the PDF is stored on the local volume behind the `source_file_url` abstraction (write-temp-then-rename at `exams/<id>/source.pdf`), a new Exam is created in **Draft** with `parse_status = pending`, and the response returns immediately without calling Gemini. *(AR-9, AR-13-async)*

**Given** any attempt to create an exam
**When** no PDF is provided
**Then** it is rejected — no code path creates an exam without a Source File.

### Story 2.1b: Enqueue the parse job, with a per-teacher rate limit

As a teacher,
I want my uploaded exam queued for AI parsing automatically and my uploads throttled,
So that the review screen fills itself and a burst of uploads can't burn the Gemini daily quota. *(FR-4; supports FR-5, NFR-09)*

**Acceptance Criteria:**

**Given** a created Draft exam (from Story 2.1a)
**When** creation completes
**Then** a parse job `{ examId, sourceFileRef, parse_generation }` is published to RabbitMQ. *(AR-7 publish side)*

**Given** a Redis sliding-window rate limiter on the parse-enqueue endpoint (per teacher)
**When** a teacher's upload/parse requests exceed the configured threshold
**Then** further requests in the window return 429, protecting the Gemini daily quota, and the limiter never blocks the submission path. *(AR-10, AR-19, NFR-09)*

### Story 2.2: Asynchronous AI parsing worker (Gemini extraction)

As a teacher,
I want the uploaded PDF's questions extracted automatically in the background,
So that the review screen fills itself instead of me typing. *(FR-5)*

**Acceptance Criteria:**

**Given** the separate worker process (`WORKER=true`, same image)
**When** it consumes a parse job
**Then** it calls `exam.markParsing()`, sends each page image to Gemini (Flash/Flash-Lite) with the API key read from **backend env only** (never exposed to the frontend), and receives structured questions (content, four options, correct-answer-if-present, figure-present flag, `ai_confidence`). *(AR-7, AR-18, NFR-09/10)*

**Given** a successful parse
**When** results are written
**Then** the worker calls `exam.persistParsedQuestions(examId, result)` — `exam` is the **only** writer of `questions` — each question's `answer_status` is derived (`ai_extracted` if an answer was read, else `needs_confirmation`), and `parse_status` becomes `parsed`.

**Given** re-parsing of a Draft exam
**When** persist runs
**Then** it replaces all of that exam's questions atomically in one transaction, and applies **only if its `parse_generation` matches the exam's current generation** (a stale/superseded result is discarded). *(AR-7 fencing)*

**Given** an exam not in Draft
**When** a parse result arrives
**Then** the question write is rejected (no clobbering of assigned exams).

### Story 2.3: Gemini reliability — retry, circuit breaker, failure surfacing

As a teacher,
I want parsing failures handled gracefully with my file kept,
So that a Gemini outage never loses my upload and I can retry. *(NFR-11, AR-8)*

**Acceptance Criteria:**

**Given** a transient Gemini error (timeout, HTTP 5xx, 429)
**When** the worker calls Gemini
**Then** it auto-retries a small bounded number of times (~3) with exponential backoff + jitter.

**Given** a non-retryable error (quota exhausted, malformed/unreadable file, auth) or exhausted retries
**When** it occurs
**Then** the worker stops calling (circuit open), sets `parse_status = failed` with `parse_error`, **preserves the Source File**, and never loops infinitely.

**Given** a failed parse
**When** the teacher views the exam
**Then** a clear teacher-facing message is shown and a manual **"retry parsing"** action is available (which republishes the job with a new `parse_generation`).

### Story 2.4: Review screen with attention flags

As a teacher,
I want extracted questions shown in one review screen with attention flags,
So that I can prioritize checking low-confidence and figure questions before assigning. *(FR-6)*

**Acceptance Criteria:**

**Given** a parsed exam
**When** the review screen renders
**Then** all extracted questions appear in one editable list (no blank authoring screen), each showing content, four options, and status.

**Given** a question with `ai_confidence < AI_CONFIDENCE_LOW_THRESHOLD` (a single backend config value) or containing a figure
**When** it renders
**Then** it shows a **yellow** low-confidence/figure treatment, visually **distinct** from the red missing-answer treatment. *(UX-DR2, UX-DR8)*

**Given** a flagged question
**When** the teacher acknowledges/dismisses the flag
**Then** `reviewed_at` is set, so the assignment gate (Story 2.8) will accept it.

### Story 2.5: Confirm missing answers

As a teacher,
I want to set the correct answer for any question the AI couldn't read,
So that no exam is assigned with an unconfirmed answer. *(FR-7)*

**Acceptance Criteria:**

**Given** a question with `answer_status = needs_confirmation`
**When** it renders in the review screen
**Then** it shows in **red** (distinct from yellow), and the AI never auto-fills its answer.

**Given** a `needs_confirmation` question
**When** the teacher clicks A/B/C/D
**Then** `correct_answer` is set and `answer_status` becomes `manually_confirmed`.

**Given** the optional answer-key path
**When** the teacher uploads a short ordered answer-key file (image/PDF, "1-A, 2-C…")
**Then** the AI matches answers to questions by sequence/number and moves matched questions to a confirmed state, still subject to teacher review; complex layouts fall back to the manual A/B/C/D path. *(addendum H)*

### Story 2.6: Auto-crop question figures

As a teacher,
I want figures auto-cropped from the page and attached to their questions,
So that figure-based questions display correctly with minimal manual work. *(FR-8)*

**Acceptance Criteria:**

**Given** the AI returns a Bounding Box for a figure question
**When** the worker processes it
**Then** it crops the image from the source page **with padding** and attaches it via `image_url`, written only to the worker's namespace `exams/<id>/gen-<n>/fig-<q>.png` (write-temp-then-rename). *(AR-9)*

**Given** an auto-cropped figure
**When** the teacher reviews it
**Then** the crop is not final until the teacher confirms it, and the teacher can manually re-crop if the region is off.

### Story 2.7: Edit and delete questions while Draft

As a teacher,
I want to fix AI misreads and remove bad questions while the exam is Draft,
So that the assigned exam is correct. *(FR-9)*

**Acceptance Criteria:**

**Given** an exam in Draft
**When** the teacher edits a question's content/options/answer or deletes a question
**Then** the change is saved; edits are locked while `parse_status = parsing`.

**Given** an exam whose `status ≠ Draft`
**When** a question edit/delete is attempted
**Then** it is rejected.

**Given** an exam with ≥1 Submission
**When** deletion of the exam is attempted
**Then** it is blocked (only Close is allowed).

### Story 2.8: Assign exam to classes with the correctness gate

As a teacher,
I want to assign a fully-confirmed exam to my classes with a due date,
So that students can take it — but never a half-confirmed one. *(FR-10)*

**Acceptance Criteria:**

**Given** `exam.assign()` is the single chokepoint for Draft→Open
**When** the teacher assigns to one or more classes with a due date
**Then** it takes a row lock on the exam, **re-validates the gate in the same transaction**, and flips to Open only if **every** question has `answer_status ≠ needs_confirmation` **and** (`reviewed_at` set or never flagged). *(AR-11)*

**Given** any question is `needs_confirmation` or has an unresolved flag
**When** assign is attempted
**Then** it is rejected with 422 and `errorCode` = `EXAM_HAS_UNCONFIRMED_ANSWERS` or `EXAM_HAS_UNREVIEWED_FLAGS` so the frontend can branch. *(AR-4)*

**Given** a due date
**When** it is stored and later compared
**Then** the comparison is UTC+7-safe (no off-by-one). *(AR-13)*

**Given** a successful assign
**When** status becomes Open
**Then** the exam appears to the assigned classes' students.

### Story 2.9: List created exams with submission rate

As a teacher,
I want to see all my exams filtered by status with submission rates,
So that I can track which exams are drafted, open, or closed and how many students submitted. *(FR-11)*

**Acceptance Criteria:**

**Given** the teacher's exams
**When** the list is requested
**Then** it is filterable by Status (Draft/Open/Closed) and paginated via `?page=&limit=`.

**Given** an Open/Closed exam assigned to classes
**When** it appears in the list
**Then** it shows the share of assigned students who have submitted, rendered with the Progress Bar component (8px track, blue in-progress / green complete). *(UX-DR10)*

### Story 2.10: Close an exam

As a teacher,
I want to close an exam at or before its due date,
So that no new submissions are accepted and its content is hidden. *(FR-12)*

**Acceptance Criteria:**

**Given** an Open exam
**When** the teacher closes it
**Then** `status` becomes Closed (no reopen) and the change goes only through the owner's state-machine method.

**Given** a Closed exam
**When** a student attempts to start/submit
**Then** it is rejected, and the exam's content is not visible to students once it is no longer Open. *(NFR-03)*

## Epic 3: Taking Exams & Auto-Grading

A Student views assigned Exams, takes one under a server-authoritative countdown (auto-submit at time-out), navigates freely between questions, and on submit is graded instantly in a single atomic, idempotent transaction, then reviews detailed results. Realizes UJ-2 over the `submission` module.

### Story 3.1: View assigned exams

As a student,
I want to see the exams assigned to my class,
So that I know what to practice and what I've already done. *(FR-13)*

**Acceptance Criteria:**

**Given** the Prisma schema
**When** the migration runs
**Then** `submissions` (id, student_id, exam_id, score, time_taken_seconds, submitted_at) exists with a **unique constraint on (student_id, exam_id)** and index `submissions(student_id, exam_id)`, owned solely by `submission`.

**Given** a student in a class
**When** they open the exams list
**Then** only exams assigned to their class and currently **Open** are listed as takeable (composes NFR-03).

**Given** the list
**When** filters are applied
**Then** done-state (not-yet-done / done, by joining `submissions`) and subject filters work independently, and not-yet-done exams are highlighted.

### Story 3.2: Start an attempt with a server-authoritative deadline

As a student,
I want a reliable countdown that starts when I begin,
So that my timer can't be cheated and an in-flight attempt is protected. *(FR-14 — timing; AR-12/AR-20)*

**Acceptance Criteria:**

**Given** the Prisma schema
**When** the migration runs
**Then** `exam_attempts` (student_id, exam_id, started_at, deadline_at, status `in_progress|submitted`) exists with a **unique constraint enforcing one `in_progress` per (student, exam)** and index `exam_attempts(student_id, exam_id)`.

**Given** a student starts an Open, not-past-due exam they haven't submitted
**When** the attempt is created
**Then** `deadline_at = min(started_at + duration, due_date)` is **snapshotted at start** as the server-authoritative timer, using UTC+7-safe date handling. *(AR-13)*

**Given** the exam is not Open or is past due
**When** the student tries to start
**Then** it is rejected with 409 and `errorCode` = `EXAM_NOT_OPEN` or `EXAM_PAST_DUE`. *(AR-4)*

**Given** an existing `in_progress` attempt
**When** the student starts again
**Then** no second attempt is created (the unique constraint holds).

### Story 3.3: Submit and auto-grade transactionally

As the system,
I want submissions written and graded atomically and exactly once,
So that a whole class submitting at once never loses or duplicates a result. *(FR-16 — highest-risk; NFR-01/04)*

**Acceptance Criteria:**

**Given** the Prisma schema
**When** the migration runs
**Then** `answer_details` (id, submission_id, question_id, student_answer, is_correct) exists, owned solely by `submission`.

**Given** a submit (manual or auto) on an attempt where `now ≤ deadline_at`
**When** it is processed
**Then** answers are matched against each question's confirmed `correct_answer`, the score (0–10, one decimal) and every `is_correct` are computed **server-side only**, and the `submissions` row + all `answer_details` are written in a **single transaction** — never a partial write. The attempt is accepted regardless of a later Close or `due_date` change. *(AR-12)*

**Given** a duplicate submit for the same (student, exam)
**When** it hits the unique constraint
**Then** it **no-ops and returns 200** (idempotent) rather than writing a second row or erroring.

**Given** a submit where `now > deadline_at`
**When** it is attempted
**Then** it is rejected.

**Given** a concurrency validation script firing ~40 parallel submissions
**When** it runs
**Then** each student ends with exactly one submission and zero partial rows. *(AR-15, NFR-01)*

### Story 3.4: Take the exam — one question at a time, countdown, navigator

As a student,
I want a distraction-free timed interface where I can move between questions,
So that my practice mirrors the real exam. *(FR-14 UI, FR-15)*

**Acceptance Criteria:**

**Given** an in-progress attempt
**When** the take screen renders
**Then** it shows one question at a time with large multiple-choice controls (1px border → blue when selected), a countdown driven by the server `deadline_at`, and **only exam content** — no secondary navigation. *(UX-DR6, UX-DR12, NFR-07)*

**Given** the countdown
**When** it reaches zero
**Then** the system auto-submits the current answers via Story 3.3 and grades them.

**Given** the question navigator
**When** the student uses it
**Then** it distinguishes answered from unanswered questions and lets the student jump to any question without losing prior answers. *(FR-15)*

**Given** keyboard navigation during a timed test
**When** the student tabs through controls
**Then** focus is always visible (2px offset primary-blue ring). *(UX-DR11)*

### Story 3.5: Review detailed results

As a student,
I want my score and mistakes immediately after submitting,
So that I can review while it's fresh. *(FR-17)*

**Acceptance Criteria:**

**Given** a completed submission
**When** the results screen renders
**Then** it shows the total score prominently and the count of correct/incorrect.

**Given** each incorrect question
**When** it is displayed
**Then** it shows the student's chosen option next to the correct option, using the green/red semantic colors. *(UX-DR2, UX-DR6)*

**Given** a submitted exam
**When** the student returns to their exams list
**Then** it now appears under "done."

## Epic 4: Student Dashboard & Class View

A Student tracks personal progress — headline cards, score-over-time chart, class comparison, subject filtering, full history table — and views their class info with a mini-leaderboard. Read-side only (no submission-path coupling). Realizes UJ-3 over the `dashboard` read layer + `class` reads.

### Story 4.1: Personal student dashboard

As a student,
I want an at-a-glance view of my progress,
So that I know whether I'm improving and how I compare to my class. *(FR-18)*

**Acceptance Criteria:**

**Given** the `dashboard` read layer
**When** it serves the student dashboard
**Then** it reads submissions/exams read-only behind its own query layer (MVP queries source tables directly; no submission-path coupling). *(AD-08, AR-6 read exception)*

**Given** a student with submissions
**When** the dashboard renders
**Then** four headline cards show — average score, exams done, study streak, and average-vs-class — using the Metric Card component (flat white, 1px border, 10px radius, Label-SM title + H2 metric). *(UX-DR5)*

**Given** the study-streak card
**When** it is computed
**Then** it counts consecutive days with ≥1 exam attempt in the student's **local (UTC+7) day**; a gap day resets it. *(AR-13)*

**Given** the trend section
**When** it renders
**Then** a score-over-time line chart (Recharts, themed) reflects the student's submissions, and the class-comparison shows the student's average against the class average. *(UX-DR13)*

### Story 4.2: Filter dashboard by subject

As a student,
I want to filter my dashboard to one subject,
So that I can see the trend and history for that subject alone. *(FR-19)*

**Acceptance Criteria:**

**Given** a selected subject
**When** the dashboard recomputes
**Then** all figures (average, trend chart, metrics) reflect **only** that subject's submissions.

**Given** no subject selected
**When** the dashboard renders
**Then** it shows the all-subjects view (Story 4.1).

### Story 4.3: Full results history

As a student,
I want my entire exam history in a sortable, filterable table,
So that I can find and compare past attempts. *(FR-20)*

**Acceptance Criteria:**

**Given** the student's submissions
**When** the history table renders
**Then** it lists all of them using the Data Table component (minimalist, uppercase Label-MD headers, horizontal dividers) and paginates via `?page=&limit=`. *(UX-DR7)*

**Given** the table
**When** the student applies controls
**Then** it filters by subject and sorts by date or score independently.

### Story 4.4: Class view with mini-leaderboard

As a student,
I want to see my class info and where I stand,
So that I have a sense of my standing among classmates. *(FR-26)*

**Acceptance Criteria:**

**Given** a student in a class
**When** the class view renders
**Then** it shows class info (homeroom teacher, class average).

**Given** the mini-leaderboard
**When** it renders
**Then** it shows the top 3 students plus the requesting student's own rank.

## Epic 5: Teacher Dashboard & Class Management

A Teacher sees class overviews (average, submission rate, at-risk list by severity), per-exam statistics (score distribution, most-missed questions), individual student detail, the class list, and class rosters with drill-in to any student. Realizes UJ-4 over the `dashboard` read layer + `class` module.

### Story 5.1: Teacher class list

As a teacher,
I want to see all the classes I'm responsible for at a glance,
So that I can pick one to dive into. *(FR-24)*

**Acceptance Criteria:**

**Given** a teacher responsible for classes
**When** the class list renders
**Then** every responsible class appears with student count, average score, and most-recent submission rate, read-only behind the `dashboard`/`class` read layer. *(AD-08)*

### Story 5.2: Individual student detail

As a teacher,
I want to open one student and see their full history,
So that I can understand how an individual is doing. *(FR-23)*

**Acceptance Criteria:**

**Given** a teacher and a student in one of their classes
**When** the teacher opens that student
**Then** the view shows the same history/metrics the student sees on their own personal dashboard (score history, averages), reusing the Epic 4 read layer.

**Given** a student not in any of the teacher's classes
**When** the teacher requests that student's detail
**Then** it is refused (a teacher only sees their own classes' students). *(FR-2)*

### Story 5.3: Class roster with drill-in

As a teacher,
I want a roster of a class's students,
So that I can scan the class and drill into anyone. *(FR-25)*

**Acceptance Criteria:**

**Given** a selected class
**When** the roster renders
**Then** it lists each student with average score and most-recent activity, using the Data Table component, paginated via `?page=&limit=`. *(UX-DR7)*

**Given** a roster row
**When** the teacher clicks it
**Then** it drills into that student's detail (Story 5.2).

### Story 5.4: Class-overview dashboard with at-risk list

As a teacher,
I want a class-overview dashboard that surfaces struggling students,
So that I'm alerted early instead of at term's end. *(FR-21)*

**Acceptance Criteria:**

**Given** the teacher's classes
**When** the overview dashboard renders
**Then** each class shows its average score and submission rate.

**Given** the at-risk list
**When** it is computed
**Then** it lists students flagged by a simple heuristic (declining scores or long inactivity) **ordered by severity**; each entry links to that student's detail (Story 5.2). *(v1 heuristic, not predictive)*

### Story 5.5: Per-exam statistics

As a teacher,
I want per-exam statistics,
So that I know what my class didn't grasp and what to reteach. *(FR-22)*

**Acceptance Criteria:**

**Given** a selected exam
**When** the statistics render
**Then** a score-distribution chart shows the class's spread (Recharts, themed). *(UX-DR13)*

**Given** the exam's questions
**When** they are ranked
**Then** questions are sortable by wrong-answer rate, surfacing the most-missed questions.

## Epic 6: Production Deployment

The system runs on a public VPS behind Nginx + SSL, every merge to `main` is gated by CI and auto-deployed, and production database migrations are performed safely with backups and a rollback path. Delivers real availability (NFR-05); realizes AD-22. Provisioning the VPS + domain (and setting server secrets) is an operator prerequisite.

### Story 6.1: Production environment on VPS with Nginx + SSL

As an operator,
I want the app served publicly over HTTPS,
So that real students and teachers can reach it securely. *(AD-22, NFR-05)*

**Acceptance Criteria:**

**Given** a provisioned VPS with Docker and a domain
**When** the production `docker-compose` stack is brought up
**Then** Nginx serves the built frontend statically, proxies `/api` to the backend, and runs the api + worker + PostgreSQL + Redis + RabbitMQ services.

**Given** the domain
**When** SSL is configured
**Then** Nginx terminates HTTPS with a valid Let's Encrypt certificate and HTTP redirects to HTTPS.

**Given** production secrets (`GEMINI_API_KEY`, `JWT_SECRET`, DB creds, `EMAIL_PROVIDER_API_KEY`)
**When** the stack runs
**Then** they are read from server-side env only — never committed, never in the frontend bundle. *(NFR-09/10)*

**Given** the deployed stack
**When** a health probe hits `GET /api/health` through Nginx
**Then** it returns 200 over HTTPS.

### Story 6.2: CI/CD auto-deploy with migration safety and rollback

As a developer,
I want merges to `main` to deploy automatically and safely,
So that shipping is repeatable and recoverable. *(AR-14, AD-22)*

**Acceptance Criteria:**

**Given** a pull request
**When** CI runs
**Then** lint + test + build must pass to gate the merge to `main`; a failing check blocks merge.

**Given** a merge to `main`
**When** the deploy workflow runs
**Then** it builds a tagged image and deploys it to the VPS.

**Given** a deploy that includes a schema change
**When** it runs
**Then** the Prisma migration is reversible and a **database backup is taken before migrating** production.

**Given** a bad release
**When** rollback is needed
**Then** redeploying the previous image tag restores the prior working version.
