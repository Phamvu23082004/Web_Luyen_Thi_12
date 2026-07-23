# Project Standards — OnThi12

> **This is the single source of truth** for all project decisions, context, and conventions.
> Other files (`project-context.md`, `CLAUDE.md`, `README.md`) reference this document — they do not duplicate it.
>
> Filled from `SRS.md` (v1.1, July 2026) and `TechStack.md`. Update as the project evolves.

---

## 1. Project Context

### Overview

**Project name**: OnThi12
**Type**: [x] Internal product (capstone project) — an exam-prep web platform for high-school students and teachers
**Team size**: 1 developer
**Start date**: July 2026
**Expected duration**: ~5 weeks (per the MVP roadmap, SRS §8)

A web platform helping grade-12 students prepare for the university entrance exam and letting teachers manage/track their progress. Core differentiator: **teachers create exams solely by uploading a PDF → AI (Gemini) extracts the questions** — there is no from-scratch manual authoring screen.

### Stakeholders

| Stakeholder | Role / Needs |
|-------------|-------------|
| Students (grade 12) | Take practice exams, view scores, track personal progress |
| Teachers | Upload PDF exams, assign them, track class/per-student results |
| Admin | Create teacher accounts, manage class lists (limited scope in 1.1) |
| Supervisor / evaluation board | Assess project scope and completeness |

### Product Strategy

Minimize teachers' data-entry effort via AI parsing, while giving students one place to practice with systematic progress tracking. Version 1.1 supports single-correct-answer multiple-choice questions only (auto-graded).

### Development Phases

| Phase | Scope | Status |
|-------|-------|--------|
| Weeks 1–2 | Auth + role-based access; full exam-creation flow: upload PDF → AI parsing → review/edit → confirm answers → crop images (AUTH-01→02, EXAM-01→09) | Not started |
| Week 3 | Taking exams, submission, automatic multiple-choice grading (TAKE-01→05) | Not started |
| Week 4 | Student personal dashboard (DASH-01→03) | Not started |
| Week 5 | Teacher dashboard by class/student (DASH-04→06, CLASS-01→02) | Not started |
| Post-MVP | Pre-aggregate + cache dashboards, at-risk-student alerts (NFR-02, NFR-06) | Backlog |

### Key Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| 100% dependency on AI parsing (Gemini) for exam creation | High | Separate AI Parsing service, async via queue; keep source file for retry; circuit breaker / graceful degradation (NFR-11) |
| AI misreads / guesses a wrong answer, corrupting scores for the whole class | High | EXAM-09 forces manual teacher confirmation when the file has no answer key; AI never guesses answers |
| Bounding-box image crop is off (EXAM-08) | Medium | Crop with padding + require teacher confirmation before saving |
| Lost / duplicate submissions when a whole class submits at once | High | Submission is a transaction and idempotent (NFR-04) |
| Gemini API quota exhaustion / failure | Medium | Quota monitoring, rate limiting, clear error messaging, keep file for retry (NFR-09, NFR-11) |

---

## 2. Tech Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Language | TypeScript (frontend + backend) | One language across both tiers |
| Backend framework | NestJS (Node.js) | Modular monolith → split into containers later. Alt: Express / Python FastAPI |
| Frontend framework | React + Vite | |
| UI / Styling | TailwindCSS + shadcn/ui | Semantic color palette green/yellow/red (SRS §5.3) |
| Charts | Recharts | DASH-01, DASH-02 |
| Data fetching | TanStack Query (React Query) | Client cache, auto refetch |
| Database | PostgreSQL | 18 — JSON column for options, strong transactions (NFR-04) |
| ORM / data access | Prisma | Type-safe, auto migrations |
| Cache | Redis | Dashboard (§9.1), rate limiting (§9.6) |
| Message queue | RabbitMQ (+ amqplib) | Async AI parsing + dashboard (§9.2) |
| AI parsing | Google Generative AI SDK (`@google/generative-ai`) | Gemini Flash / Flash-Lite (NFR-09) |
| Reverse proxy | Nginx | SSL, basic load balancing |
| Container | Docker + Docker Compose | |
| CI/CD | GitHub Actions | |
| Hosting | Oracle Cloud Free Tier / small VPS | ~150–200 concurrent users |
| Monitoring (post-MVP) | Prometheus + Grafana | SRS §9.5 |

---

## 3. Architecture Decisions

**Detailed architecture document**: none yet (planned via `bmad-architecture`). Overview currently lives in `SRS.md` §6.

Overall model: **Service-Oriented with a shared database**, starting as a **modular monolith** (each service is a NestJS module), split into independent containers in weeks 3–5.

### AD-01: Exam creation only via PDF upload + AI parsing

**Decision**: Drop the manual authoring screen entirely; every exam must originate from an uploaded PDF (EXAM-01).
**Why**: Teachers already have many PDF/scanned exams; retyping is the main barrier. Multimodal AI is markedly more accurate than traditional OCR (SRS §3.2).
**Alternatives considered**: Manual entry (v1.0) — removed; Tesseract OCR — math-formula accuracy too low.

### AD-02: Separate AI Parsing service, async via queue

**Decision**: AI parsing runs separately from the Exam service, processed asynchronously through a queue.
**Why**: Gemini takes seconds per page and depends on a third party; v1.1 depends 100% on this step, so synchronous calls would time out on multi-page exams (SRS §6.3).
**Alternatives considered**: Synchronous call inside the upload request — high timeout risk.

### AD-03: Split write (Submission) and read (Dashboard) — lightweight CQRS

**Decision**: The Submission service (writes submissions, transactional) is separate from the Dashboard service (reads stats from cache/pre-aggregated table).
**Why**: When a whole class submits, correct, loss-free writes must take priority and not be affected by analytics load (SRS §6.2).
**Alternatives considered**: Compute dashboards directly on every view — degrades as submission count grows.

### AD-04: AI never infers correct answers

**Decision**: When an exam file has no answer key, the teacher must select answers manually (EXAM-09) before assigning the exam.
**Why**: A single wrong answer corrupts every student's score — the highest risk in the system (SRS §3.2).

---

## 4. Git Workflow

**Branching model**: [x] Trunk-based (main) + short-lived feature branches
**Merge strategy**: [x] Squash merge
**Branch naming prefix**: `feature/`, `fix/`, `hotfix/`, `release/`
**Ticket system prefix**: SRS requirement codes as references — `AUTH-`, `EXAM-`, `TAKE-`, `DASH-`, `CLASS-`, `NFR-` (e.g. branch `feature/EXAM-06-ai-parsing`)

Follows Tier 1 (`docs/technical_architecture_guidelines/coding-standard/01-Git-Workflow.md`, `02-Commit-Conventions.md`).

### Deviations from Tier 1
None (single developer, trunk-based fits the project scale).

---

## 5. Code Organization

### Folder Structure

```
Web_OnThi12/
├── frontend/                 # React + Vite + TS
│   └── src/
│       ├── features/         # by domain: auth, exams, take, dashboard, classes
│       ├── components/ui/    # shadcn/ui
│       ├── lib/              # api client, react-query setup
│       └── routes/
├── backend/                  # NestJS (modular monolith)
│   └── src/
│       ├── modules/
│       │   ├── auth/         # AUTH-01→03, JWT, guards
│       │   ├── exam/         # EXAM-01→09
│       │   ├── ai-parsing/   # Gemini, queue consumer
│       │   ├── submission/   # TAKE-04, transactional grading
│       │   ├── dashboard/    # DASH-01→06, reads cache
│       │   └── class/        # CLASS-01→03
│       ├── common/           # guards, pipes, filters, interceptors
│       └── prisma/           # schema + migrations
├── docker-compose.yml
└── docs/
```

### Module Pattern

**Reference module**: `backend/src/modules/auth/` is the canonical service module — each NestJS module has `*.module.ts`, `*.controller.ts`, `*.service.ts`, DTOs + validation pipe, and a role guard.

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files (FE) | kebab-case | `exam-editor.tsx` |
| Files (BE) | kebab-case + NestJS suffix | `exam.service.ts`, `exam.controller.ts` |
| Functions / methods | camelCase | `extractQuestions()` |
| Types / Interfaces / Classes | PascalCase | `ExamService`, `QuestionDto` |
| Database tables | snake_case, plural | `exam_classes`, `answer_details` |
| Database columns | snake_case | `correct_answer`, `answer_status` |
| API endpoints | kebab-case, plural | `/api/exams`, `/api/submissions` |

---

## 6. API Conventions

**Base URL**: `/api` (behind the Nginx reverse proxy)
**Auth method**: JWT (issued by Auth service on login); role-based access via NestJS Guards (AUTH-01, AUTH-02)
**Response format**: JSON. Proposed `{ data, meta? }` on success.
**Error format**: JSON `{ statusCode, message, error, errorCode? }`, built by a **single global exception filter** (never hand-formatted in a controller/service).

- `statusCode` / `message` / `error` — unchanged from the NestJS default shape (AD-16). Generic errors (validation 400, simple 404) stop here.
- `errorCode` *(optional)* — a `SCREAMING_SNAKE_CASE` string constant, added **only** for business errors where one `statusCode` covers several distinct causes the frontend must branch on (e.g. the AD-09 assign gate: `needs_confirmation` vs unreviewed-flag — same 422, two reasons). Constants live centrally in `backend/src/common/exceptions/error-codes.ts`, never as inline literals. The frontend branches on `errorCode`, **never** by parsing `message`.
- Unexpected 5xx never leak internal `message`/stack to the client — they return a generic message and are logged server-side with full context (context + stack). Normal 4xx business errors are not logged as incidents.

**Pagination**: query `?page=&limit=` for lists of exams/students/results.

> The response/pagination conventions above are proposed defaults — finalize them while building the first module (`auth`) and update this section.

---

## 7. Testing Strategy

Follows Tier 1 `08-Quality-Gates.md`. Prioritize high-risk areas over blanket coverage.

### Must-Have Tests (block merge/release)

1. Grading & submission (TAKE-04): answer matching, transaction, **idempotency** — no duplicate/partial writes (NFR-04).
2. Role-based access (AUTH-02): students cannot reach teacher pages/APIs and vice versa.
3. Block assigning an exam while any question is "missing answer" or flagged-unresolved (EXAM-02, EXAM-07, EXAM-09).

### Should-Have Tests

1. AI parser: map returned JSON → `questions` entities, handle `answer_status`, `ai_confidence`.
2. Gemini API error/timeout/quota handling (NFR-11): keep file, surface clear error.

### Nice-to-Have Tests

1. Dashboard computations (class average, score distribution).
2. Bounding-box image cropping (EXAM-08).

### Test Infrastructure

**Test database**: [x] Docker container (separate PostgreSQL for tests)
**Test data**: [x] Factories / seed scripts
**Coverage target**: No hard number — focus on the Must-Have areas (grading, access control, assignment blocking).

---

## 8. Environment Configuration

### Required Environment Variables

| Variable | Description | Example Value | Required |
|----------|------------|---------------|----------|
| `DATABASE_URL` | PostgreSQL connection string (Prisma) | `postgresql://user:pass@db:5432/onthi12` | ✅ |
| `REDIS_URL` | Redis cache connection | `redis://redis:6379` | ✅ |
| `RABBITMQ_URL` | RabbitMQ connection | `amqp://guest:guest@rabbitmq:5672` | ✅ |
| `GEMINI_API_KEY` | Gemini API key — **backend only (AI Parsing)**, never exposed to frontend (NFR-09) | `AIza...` | ✅ |
| `JWT_SECRET` | JWT signing secret | `<random-secret>` | ✅ |
| `JWT_EXPIRES_IN` | Token lifetime | `1d` | ✅ |
| `NODE_ENV` | Environment | `development` / `production` | ✅ |
| `EMAIL_PROVIDER_API_KEY` | Transactional email provider key (Resend) — **backend only**, never exposed to the frontend. Password reset (AUTH-03) silently stops delivering without it. | `re_...` | ✅ |
| `EMAIL_FROM_ADDRESS` | Sender address on reset emails. Resend's shared `onboarding@resend.dev` only delivers to the account's own registered address until a custom domain is verified. | `onboarding@resend.dev` | ✅ |
| `PASSWORD_RESET_TOKEN_TTL_MINUTES` | Reset-link validity window. Falls back to 30 when absent, blank, or non-numeric. | `30` | ✅ |
| `FRONTEND_BASE_URL` | Origin used to build the reset link (`${FRONTEND_BASE_URL}/reset-password?token=…`). Becomes the real domain in production. | `http://localhost:5173` | ✅ |

> ⚠️ `GEMINI_API_KEY` must never be hard-coded in source or exposed to the frontend (NFR-09, NFR-10).

### Ports

| Service | Port | Notes |
|---------|------|-------|
| Nginx | 80 / 443 | Reverse proxy, SSL |
| Frontend (Vite dev) | 5173 | Dev only |
| Backend (NestJS) | 3000 | Behind Nginx |
| PostgreSQL | 5432 | |
| Redis | 6379 | |
| RabbitMQ | 5672 / 15672 | 15672 = management UI |

> Concrete ports finalized when writing `docker-compose.yml`.

---

## 9. Database Conventions

**Migration tool**: Prisma Migrate
**Schema conventions**: `snake_case` tables & columns, `id` PK, `created_at` / `updated_at` where appropriate.

### Key Design Decisions

Core tables (SRS §7): `users`, `classes`, `class_students`, `exams`, `exam_classes`, `questions`, `submissions`, `answer_details`, `class_exam_stats`.

- `exams.source_file_url`: stores the original PDF — the **single source** of an exam, needed to retry AI parsing.
- `questions.correct_answer`: **nullable** — empty until the answer is confirmed.
- `questions.answer_status`: `ai_extracted` / `needs_confirmation` / `manually_confirmed` — used to block assignment (EXAM-09).
- `questions.options`: JSON column (4 choices).
- No question-type/topic-tag column in v1.1.
- Suggested indexes: `submissions(student_id, exam_id)`, `questions(exam_id)`.
- `class_exam_stats`: pre-computed stats table for dashboards (post-MVP optimization — §9.1).

### Common Pitfalls

- **DATE column timezone mismatch (Prisma + PostgreSQL)** — **directly relevant** here since the project is in Vietnam (UTC+7) and has `due_date`, `submitted_at`. JavaScript `new Date(year, month, day)` creates local-timezone midnight; in UTC+7 that resolves to the **previous calendar day** in UTC. `DATE` columns (`@db.Date`) store UTC midnight → direct comparison silently returns wrong results. **Fix**: Raw SQL — use a `YYYY-MM-DD` string cast `::date`; Prisma ORM — normalize with `new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))`.

---

## 10. Deployment

**Target environment**: [x] Docker Compose (VPS, Oracle Cloud Free Tier)
**CI/CD tool**: GitHub Actions (auto-deploy on push)
**Environments**: Local, Production (staging optional at project scale)

| Environment | URL | Deployed from | How |
|------------|-----|--------------|-----|
| Local | localhost | Working copy | `docker compose up` |
| Staging | (optional) | | |
| Production | VPS (Oracle Cloud) | branch `main` | GitHub Actions → Docker Compose |

### Rollback Procedure

Deploy by image tag; rollback = redeploy the previous tag/commit via GitHub Actions. Prisma: keep migrations reversible, back up the DB before migrating in production.

---

## 11. Documentation Index

| Document | Location | Purpose |
|----------|----------|---------|
| This file | `docs/PROJECT-STANDARDS.md` | Single source of truth |
| SRS | `SRS.md` | Software Requirements Specification (v1.1) — exhaustive requirements source |
| PRD (BMad-format) | `_bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/prd.md` | Downstream-ready PRD distilled from the SRS (26 FRs, User Journeys, Glossary, Success Metrics); `addendum.md` alongside holds the FR↔SRS map and technical reconciliations |
| Tech Stack | `TechStack.md` | Technology per layer |
| AI implementation rules | `project-context.md` | Lean coding rules for AI/BMad agents |
| Claude Code entry point | `CLAUDE.md` | References the two files above |
| Quick-start | `README.md` | Setup guide for new developers |
| Tier 1 standards | `docs/technical_architecture_guidelines/coding-standard/` | Company process (git, commits, review, CI/CD, security, testing) |
| Architecture (detailed) | *(none yet — planned via `bmad-architecture`)* | |

---

## 12. AI-Assisted Development

> This project follows the company **Quality-Assured Delivery Workflow** — one shared spec feeds every AI tool, with machine-enforced gates and 100% of PRs reviewed, scanned, and tested before merge. See `docs/technical_architecture_guidelines/coding-standard/07a-Workflow-Quick-Reference.md`.

### project-context.md Scope

Location: project root. Holds lean coding rules for OnThi12 — stack summary, architecture rules, naming, anti-patterns. Consumed by BMad agents and any AI tool.

### CLAUDE.md Scope

Location: project root. Thin file referencing `@project-context.md` and `@docs/PROJECT-STANDARDS.md` plus behavioral guidelines.

### BMad Artifacts

| Artifact | Location | Status |
|----------|----------|--------|
| Brainstorming | — | Skipped (SRS already exists) |
| PRD | `SRS.md` (source) + `_bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/prd.md` (BMad-format, distilled 2026-07-15) | ✅ SRS is the exhaustive source; the distilled PRD (26 FRs, UJs, Glossary, SMs) is the downstream-ready artifact for `bmad-architecture`/`bmad-ux`/`bmad-create-epics-and-stories` |
| Tech Stack | `TechStack.md` | ✅ |
| Architecture | — | ⏳ planned via `bmad-architecture` |
| Epics & Stories | — | ❌ planned via `bmad-create-epics-and-stories` |

### Quality Review Schedule

| Trigger | Review Type |
|---------|-------------|
| Auth module complete | `/bmad-review-adversarial-general` |
| Grading/submission flow (TAKE-04) complete | `/bmad-review-edge-case-hunter` |
| AI parsing flow (EXAM-06→09) complete | `/bmad-review-adversarial-general` |
| Before release | `/bmad-review-adversarial-general` on the full system |

---

## 13. Tier 1 Deviations

| Standard | Deviation | Reason |
|----------|-----------|--------|
| 09 — Project Structure | Tier 1 standards docs are copied into the repo under `docs/technical_architecture_guidelines/` | Agents and devs need the full process locally; the wiki stays authoritative |

The skeleton's "required files absent" row is **resolved** now that the stack is chosen (Node + React): `.env.example`, `docker-compose.yml`, and the CI pipeline are added when scaffolding the code.

---

## Changelog

| Date | What Changed | Who |
|------|-------------|-----|
| 2026-07-15 | Filled entirely from SRS v1.1 + TechStack for OnThi12 (replaced skeleton) | phamquangvu2308 |
| 2026-07-15 | Added BMad-format PRD distilled from SRS (`_bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/`); §11 index and §12 BMad-Artifacts PRD row now point to it | Admin |
| 2026-07-16 | §6 — extended the error envelope with an optional `errorCode` (mirrors AD-16); rule: centralized `SCREAMING_SNAKE_CASE` constants, only for multi-cause business errors, FE branches on code not message | Admin |
| 2026-07-17 | §2 — PostgreSQL 16 → 18, matching Story 1.1's AC 3 and the `postgres:18` image the scaffold actually runs (`TechStack.md` §3 updated to match) | Admin (code review of story-1.1) |
