# PRD Addendum — OnThi12

Depth that belongs downstream (architecture, tech decisions, traceability) but not in the PRD's main narrative. The PRD stays capability-only; the mechanism lives here and in the repo's existing `SRS.md`, `TechStack.md`, `docs/PROJECT-STANDARDS.md`.

## A. FR ↔ SRS traceability map

| PRD FR | SRS code | Priority | Feature group |
|---|---|---|---|
| FR-1 | AUTH-01 | Cao | Auth |
| FR-2 | AUTH-02 | Cao | Auth |
| FR-3 | AUTH-03 | TB | Auth |
| FR-4 | EXAM-01 | Cao | Exam creation |
| FR-5 | EXAM-06 | Cao | Exam creation |
| FR-6 | EXAM-07 | Cao | Exam creation |
| FR-7 | EXAM-09 | Cao | Exam creation |
| FR-8 | EXAM-08 | TB | Exam creation |
| FR-9 | EXAM-05 | TB | Exam creation |
| FR-10 | EXAM-02 | Cao | Exam creation |
| FR-11 | EXAM-03 | Cao | Exam creation |
| FR-12 | EXAM-04 | TB | Exam creation |
| FR-13 | TAKE-01 | Cao | Take |
| FR-14 | TAKE-02 | Cao | Take |
| FR-15 | TAKE-03 | TB | Take |
| FR-16 | TAKE-04 | Cao | Take |
| FR-17 | TAKE-05 | Cao | Take |
| FR-18 | DASH-01 | Cao | Student dashboard |
| FR-19 | DASH-02 | Cao | Student dashboard |
| FR-20 | DASH-03 | TB | Student dashboard |
| FR-21 | DASH-04 | Cao | Teacher dashboard |
| FR-22 | DASH-05 | Cao | Teacher dashboard |
| FR-23 | DASH-06 | TB | Teacher dashboard |
| FR-24 | CLASS-01 | Cao | Class mgmt |
| FR-25 | CLASS-02 | Cao | Class mgmt |
| FR-26 | CLASS-03 | Thấp | Class mgmt |

UJ ↔ FR: UJ-1 → FR-4..FR-10 · UJ-2 → FR-13..FR-17 · UJ-3 → FR-18..FR-20 · UJ-4 → FR-21..FR-23 (+FR-25).

## B. MVP-vs-post-MVP queue reconciliation

Apparent tension: `SRS §9.2` lists "message queue for async processing" as a *post-MVP* optimization, while `project-context.md` and `TechStack.md` place **RabbitMQ in the core stack** and state "AI parsing is asynchronous — upload enqueues a job (RabbitMQ)."

Resolution used in this PRD: **async AI parsing via a queue is MVP** (it is the mechanism that lets the upload request return without waiting on Gemini — required by NFR-11 and AD-02). The SRS §9.2 post-MVP item refers specifically to **scaling/optimizing** the queue: batching multiple pages into one Gemini call and worker fan-out under concurrent teacher load. If the product owner instead intends the simplest possible MVP (a lightweight in-process job, no broker) with RabbitMQ added later, that would flip FR-5's transport — flag at architecture time. Logged as an assumption in the PRD §9 index.

## C. Architecture decisions (reference, not re-decided here)

Full rationale in `docs/PROJECT-STANDARDS.md` §3. Summary for downstream:
- **AD-01** — exam creation only via PDF upload + AI parsing (no manual authoring). Drives FR-4, Non-Goals.
- **AD-02** — AI Parsing is a separate service, async via queue. Drives FR-5, NFR-11.
- **AD-03** — lightweight CQRS: Submission (write, transactional) separated from Dashboard (read, cached/pre-aggregated). Drives FR-16 vs FR-18/21.
- **AD-04** — AI never infers answers; teacher confirms. Drives FR-7, SM-C1.

## D. Known technical pitfall carried from PROJECT-STANDARDS §9

**UTC+7 DATE off-by-one.** `due_date` (FR-10) and `submitted_at` (FR-16) touch `@db.Date` columns. `new Date(y,m,d)` creates local-midnight which in UTC+7 resolves to the previous UTC calendar day, so naive comparisons silently return wrong results. Normalize via `Date.UTC(...)` (Prisma) or `YYYY-MM-DD::date` cast (raw SQL). Called out so due-date logic and any "submitted today" dashboard filter don't regress.

## E. Data model touchpoints (reference — SRS §7)

Core tables: `users`, `classes`, `class_students`, `exams` (incl. `source_file_url`, `status`), `exam_classes` (incl. `due_date`), `questions` (incl. nullable `correct_answer`, `answer_status`, `options` JSON, `ai_confidence`, `image_url`), `submissions`, `answer_details`, `class_exam_stats` (post-MVP). Suggested indexes: `submissions(student_id, exam_id)`, `questions(exam_id)`. No topic/type tag column in v1.1.

## F. System-design technique checklist (for SM-5)

Techniques from SRS §9.8 the builder aims to demonstrate, mapped to where they land:
- Async message queue → FR-5 (AI parsing).
- CQRS read/write split → FR-16 (write) vs FR-18/21 (read).
- Idempotency → FR-16 (one submission per student per exam).
- Rate limiting → login (FR-1) + AI-parsing calls (NFR-09), MVP-recommended.
- Caching → dashboard reads (post-MVP §9.1; "path demonstrated" for SM-5).
- Circuit breaker / graceful degradation → Gemini calls (FR-8 error path, NFR-11).
- Load balancing / read replica / horizontal scaling → post-MVP §9.4 (design-allows only, not built).
- Health checks → per-service `/health` for observability (§9.5).

## G. AI Parsing reliability mechanism (resolves FR-8 / NFR-11 retry)

Contract the AI Parsing worker implements when calling Gemini:
- **Transient errors** (timeout, HTTP 5xx, 429/rate-limit) → auto-retry a small bounded count (suggested 3) with exponential backoff + jitter.
- **Non-retryable errors** (daily quota exhausted, malformed/unreadable file, auth error) → do not retry; open the circuit for further calls in that job.
- On retry-exhaustion or non-retryable → mark the parse job failed, **preserve the Source File**, surface a clear teacher-facing message, and expose a manual "retry parsing" action. Never an unbounded retry loop.
- Circuit-breaker/graceful-degradation is the SRS §9.8 technique this realizes, tracked for SM-5.

## H. Answer-key matching (resolves FR-7 optional path)

v1 scope: a separate answer-key upload is a **simple ordered list** (question number → letter, e.g. "1-A, 2-C…") as a short PDF or image. The AI extracts the ordered list and joins to Questions by sequence/number; matched Questions still require teacher review before assign. Out of scope: multi-column tables, per-section keys, answer keys embedded mid-document — teacher uses the manual A/B/C/D path (always available) for those.

## I. Submission concurrency (resolves FR-16 / NFR-01)

Idempotency is enforced by a **unique constraint on `submissions(student_id, exam_id)`**; a duplicate submit hits the constraint and no-ops rather than writing a second row. The whole submit (score + answer_details) is one transaction. Capstone validation = a lightweight concurrency script firing ~40 parallel submissions and asserting exactly-once rows with no partial writes — not a full load-test harness (NFR-01 is argued from design + spot-checked, not benchmarked at scale).
