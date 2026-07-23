# Project Context for AI Agents — OnThi12

> Lean, LLM-optimized coding rules for OnThi12. Full context and decisions live in
> [`docs/PROJECT-STANDARDS.md`](docs/PROJECT-STANDARDS.md); requirements in [`SRS.md`](SRS.md);
> stack in [`TechStack.md`](TechStack.md). This file is the "how to code here" summary — keep it short.

## What OnThi12 is

Exam-prep web app for grade-12 students and teachers. Teachers create exams **only by uploading a PDF**; Gemini extracts questions; teachers review, confirm answers, then assign to classes. Students take timed multiple-choice exams, auto-graded. Both roles get dashboards.

## Tech stack (summary)

- **Frontend**: React + TypeScript + Vite, TailwindCSS + shadcn/ui, Recharts (charts), TanStack Query (server state).
- **Backend**: Node.js + TypeScript + NestJS, one module per service: `auth`, `exam`, `ai-parsing`, `submission`, `dashboard`, `class`.
- **Data**: PostgreSQL 16 + Prisma ORM. Redis (cache/rate-limit). RabbitMQ (async AI parsing + dashboard).
- **AI**: `@google/generative-ai` (Gemini Flash/Flash-Lite), backend-only.
- **Infra**: Docker Compose, Nginx, GitHub Actions.

## Architecture rules

- **Modular monolith first**, one NestJS module per service; keep module boundaries clean so they can split into containers later. Shared PostgreSQL database.
- **AI parsing is asynchronous** — upload enqueues a job (RabbitMQ), a worker calls Gemini per page and writes results back. Never call Gemini synchronously inside the upload request.
- **Writes vs reads are separate** — Submission service owns transactional writes; Dashboard service reads pre-aggregated/cached stats. Don't compute heavy dashboard stats on the submission path.
- **JWT auth + role guards** — enforce student vs teacher access with NestJS Guards on every protected route (AUTH-02).

## Code generation rules

- TypeScript everywhere; prefer explicit types on public APIs (DTOs, service returns).
- NestJS modules follow `*.module.ts` / `*.controller.ts` / `*.service.ts` + DTOs with `class-validator` pipes. Mirror `modules/auth/` as the reference.
- Validate all input at the controller boundary (DTO + ValidationPipe). Never trust client-provided role, score, or `is_correct`.
- Errors: throw specific NestJS exceptions (`NotFoundException`, `ConflictException`, `UnprocessableEntityException`…) — never a bare `Error`, never hand-format error JSON. A single global exception filter builds every response. Use `BusinessException` + a centralized `errorCode` (`common/exceptions/error-codes.ts`) **only** when one statusCode has several business causes the frontend must branch on (e.g. AD-09 assign gate); plain built-in exceptions otherwise (see PROJECT-STANDARDS §6, AD-16).
- Frontend data access goes through a single API client in `lib/` — no ad-hoc `fetch` scattered in components. Server state goes through TanStack Query: **every GET uses `useQuery`; every write that invalidates cached data uses `useMutation`**. Sole exception: pre-auth forms that have no cached state to read or invalidate (login, forgot-password, reset-password) may call `apiFetch` with local `useState`. No new exceptions from Epic 2 onward.
- Use the semantic color system (SRS §5.3): green = good/high, yellow = mild warning (EXAM-07 low-confidence), **red = "missing answer" (EXAM-09)**. Keep these distinct.
- Match existing style; make surgical changes; don't add speculative abstractions or config.

## Domain invariants (do NOT break)

- **Every exam originates from an uploaded PDF.** There is no manual "author from scratch" screen (EXAM-01).
- **AI never guesses correct answers.** If the file has no answer key, the question is `needs_confirmation` and the teacher must pick A/B/C/D manually before the exam can be assigned (EXAM-09).
- **An exam cannot be assigned** while any question is `needs_confirmation` or flagged-unresolved (EXAM-02, EXAM-07).
- **Submission is transactional and idempotent** — one submission per student per exam, no partial/duplicate writes (NFR-04).
- **`questions.correct_answer` is nullable**; gate on `answer_status` (`ai_extracted` / `needs_confirmation` / `manually_confirmed`), not on whether the field is set.
- Exam content is only visible to students while the exam status is open (NFR-03).

## Anti-patterns (Do NOT)

- Do NOT call Gemini synchronously in an HTTP request path.
- Do NOT hard-code `GEMINI_API_KEY` or expose it to the frontend — backend env only (NFR-09/10).
- Do NOT let AI infer/auto-fill correct answers.
- Do NOT compare `@db.Date` columns against `new Date(y, m, d)` — UTC+7 causes off-by-one. Normalize via `Date.UTC(...)` or `YYYY-MM-DD::date` (see PROJECT-STANDARDS §9).
- Do NOT recompute dashboard aggregates on every submission.
- Do NOT store passwords in plaintext — hash before storing (NFR-03).
- Do NOT add topic/question-type tagging — out of scope in v1.1.
- Do NOT build a mobile app or manual-entry screens — out of scope (SRS §1.4).
