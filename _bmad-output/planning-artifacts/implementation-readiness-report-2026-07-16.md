---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/prd.md
  - _bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
  - docs/design-system.md
  - docs/stitch_exports/
---

# Implementation Readiness Assessment Report

**Date:** 2026-07-16
**Project:** Web_OnThi12 (OnThi12)

---

## Step 1 — Document Inventory

### PRD Files Found
**Whole Documents:**
- `_bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/prd.md` (433 lines)
- `_bmad-output/planning-artifacts/prds/prd-Web_OnThi12-2026-07-15/addendum.md` (86 lines — FR↔SRS map + technical reconciliations)

**Sharded Documents:** none

### Architecture Files Found
**Whole Documents:**
- `_bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md` (286 lines)
- Supporting: `reviews/review-adversarial.md`, `reviews/review-rubric.md`, `reviews/review-versions.md`

**Sharded Documents:** none

### Epics & Stories Files Found
**Whole Documents:**
- `_bmad-output/planning-artifacts/epics.md` (895 lines — full epic + story breakdown, 26 FRs)

**Sharded Documents:** none

### UX Design Files Found
**Whole Documents:**
- `docs/design-system.md` (197 lines — "Vietnamese EdTech Standard" direction)
- `docs/stitch_exports/` (11 screen exports: Student ×6, Teacher ×5)

**Sharded Documents:** none

**Note:** UX artifacts live under `docs/` (project_knowledge), not `planning_artifacts`. This is intentional — `epics.md` already lists both as input documents. Not a blocker.

### Duplicates
None. No document exists as both a whole file and a sharded folder.

### Missing Documents
None. All four required document types (PRD, Architecture, Epics & Stories, UX) are present.

---

## Step 2 — PRD Analysis

### Functional Requirements (26)

**Auth & Role-Based Access**
- **FR-1** (AUTH-01, Cao): Email/password login with role routing; token carries verified Role; passwords verified against stored hash.
- **FR-2** (AUTH-02, Cao): Role-based access enforced on every protected route; Student↔Teacher isolation (403 cross-role); Role from token, never client-supplied.
- **FR-3** (AUTH-03, TB): Password reset via time-limited email link; no account-existence leak; used/expired links rejected.

**Exam Creation via PDF Upload + AI Parsing (Teacher)**
- **FR-4** (EXAM-01, Cao): Create Exam by uploading exactly one PDF (incl. scanned) + title/subject/duration; PDF retained as Source File; new Exam starts Draft; no exam without a file.
- **FR-5** (EXAM-06, Cao): Async multimodal extraction — upload enqueues a job; Gemini returns structured questions (content, 4 options, answer-if-present, figure flag, AI confidence); key backend-only.
- **FR-6** (EXAM-07, Cao): Flag low-confidence/figure questions (yellow, distinct from red); Assign blocked while any flag unresolved/unacknowledged.
- **FR-7** (EXAM-09, Cao): No answer key → `needs_confirmation` (red); Teacher must click A/B/C/D before Assign; optional answer-key file matches by number; AI never auto-fills.
- **FR-8** (EXAM-08, TB): Auto-detect + crop figures from Bounding Box (padding); Teacher confirms/re-crops; parse failure preserves Source File, clear error, bounded retry + circuit breaker.
- **FR-9** (EXAM-05, TB): Edit/delete extracted questions while Draft only; Exam with ≥1 Submission cannot be deleted (only Closed).
- **FR-10** (EXAM-02, Cao): Assign Exam to ≥1 Class with due date, Draft→Open — rejected if any question `needs_confirmation` or unresolved flag; due-date comparisons UTC+7-safe.
- **FR-11** (EXAM-03, Cao): List created Exams, filter by Status, show per-Exam submission rate.
- **FR-12** (EXAM-04, TB): Close Exam at/before due date; no new Submissions after Close; content hidden from Students once not Open.

**Taking Exams & Auto-Grading (Student)**
- **FR-13** (TAKE-01, Cao): View assigned Exams for Student's Class, filter by done-state and subject, not-yet-done highlighted; only Open exams takeable.
- **FR-14** (TAKE-02, Cao): Take timed exam one question at a time under countdown; auto-submit at time zero; distraction-free UI.
- **FR-15** (TAKE-03, TB): Question navigator distinguishing answered/unanswered; free jumping without losing answers.
- **FR-16** (TAKE-04, Cao — highest-risk): Submit (manual/auto) → match answers, compute score immediately, write Submission + Answer Details in one transaction; exactly one Submission per Student per Exam (idempotent, unique constraint); server-side is_correct; NFR-01 ~40 concurrent.
- **FR-17** (TAKE-05, Cao): Post-submit results — score, correct/incorrect counts, per wrong question chosen vs correct Option.

**Student Dashboard**
- **FR-18** (DASH-01, Cao): Personal dashboard — avg score, exams done, study streak, score-over-time chart, vs-class comparison (4 cards).
- **FR-19** (DASH-02, Cao): Filter statistics by subject; all figures recompute for selected subject.
- **FR-20** (DASH-03, TB): Full results history table, filter by subject, sort by date/score.

**Teacher Dashboard**
- **FR-21** (DASH-04, Cao): Class-overview — per-Class avg, submission rate, at-risk list ordered by severity heuristic.
- **FR-22** (DASH-05, Cao): Per-exam stats — score distribution + questions ranked by wrong-answer rate.
- **FR-23** (DASH-06, TB): Individual student detail mirroring the Student's own dashboard.

**Class Management**
- **FR-24** (CLASS-01, Cao): Teacher class list — student count, avg score, most-recent submission rate.
- **FR-25** (CLASS-02, Cao): Class roster table (avg, last-activity) drilling into per-student detail (FR-23).
- **FR-26** (CLASS-03, Thấp): Student class view — class info + mini-leaderboard (top 3 + own rank).

**Total FRs: 26**

### Non-Functional Requirements (11)

- **NFR-01** — Submission throughput/integrity: ≥40 Students submitting in one 5-min window, zero data loss.
- **NFR-02** — Dashboard latency <2s for Class ≤40 Students, ≤30 Exams history.
- **NFR-03** — Security & content confidentiality: passwords hashed; Exam content visible to Students only while Open.
- **NFR-04** — Data integrity: Submission is a transaction, never partial/duplicated (idempotent). Highest-priority NFR (via FR-16).
- **NFR-05** — Availability during exam windows (weekday 19:00–22:00).
- **NFR-06** — Scalability: add services/cache without rewrite.
- **NFR-07** — Usability: minimal distraction-free exam-taking UI, desktop + tablet.
- **NFR-08** — Maintainability: code organized by service module (auth, exam, submission, dashboard, ai-parsing, class).
- **NFR-09** — AI operating cost: Gemini free tier; key backend-only, never exposed; quota monitored.
- **NFR-10** — Data privacy: only exam-page images (no student PII) sent to AI.
- **NFR-11** — AI-dependency reliability: handle Gemini error/timeout/quota; clear message, Source File preserved, no loss (via FR-8 + circuit breaker).

**Total NFRs: 11**

### Additional Requirements & Constraints

- **Non-Goals (§5):** no manual authoring, no AI-guessed answers, no essay grading, no topic tagging, no advanced anti-cheat, no native mobile, no payments, no no-review grading, no full admin console (seed script/minimal endpoint instead).
- **MVP scope (§6):** all 26 FRs in MVP; async AI Parsing via queue is MVP (not deferred); rate limiting on login + AI-Parsing is MVP. Deferred: `class_exam_stats` pre-aggregation + Redis dashboard cache, batch multi-page parsing, service splitting, horizontal scaling, predictive at-risk alerting, observability.
- **Open Questions (2, non-blocking):** OQ-1 password-reset email provider (stub acceptable for demo); OQ-2 quantitative SM-2/SM-3 targets (revisit after parsing ≥3 sample exams).
- **Success metrics:** SM-1→5 + counter-metrics SM-C1 (zero bypassed answer-confirmation), SM-C2 (zero lost/dup submissions), SM-C3 (no premature optimization).

### PRD Completeness Assessment

**Strong.** The PRD is unusually complete for readiness purposes:
- Every FR carries an SRS traceability code and testable "Consequences," so acceptance criteria are pre-seeded.
- A Glossary enforces a single vocabulary; NFRs are cross-cutting and separated from features.
- Correctness guardrails (idempotent submission, assignment gating, no AI-guessed answers) are explicit and reinforced by counter-metrics.
- The only loose ends are two explicitly-deferred, non-architecture-affecting Open Questions. No blocking ambiguity for epic-coverage validation.

---

## Step 3 — Epic Coverage Validation

The epics document (`epics.md`) contains an explicit **FR Coverage Map** and decomposes every FR into concrete numbered stories. Each PRD FR was cross-checked against an actual story (not just the claimed map).

### Coverage Matrix

| FR | Requirement (short) | Epic | Story | Status |
|----|---------------------|------|-------|--------|
| FR-1 | Email/password login + role routing | 1 | 1.5 | ✓ Covered |
| FR-2 | Role-based access enforcement | 1 | 1.6 | ✓ Covered |
| FR-3 | Password reset via email | 1 | 1.8 | ✓ Covered |
| FR-4 | Create exam by PDF upload | 2 | 2.1 | ✓ Covered |
| FR-5 | Async multimodal extraction | 2 | 2.2 | ✓ Covered |
| FR-6 | Flag low-confidence/figure questions | 2 | 2.4 | ✓ Covered |
| FR-7 | Confirm missing correct answer | 2 | 2.5 | ✓ Covered |
| FR-8 | Auto-crop figures (+ reliability) | 2 | 2.6 (+2.3) | ✓ Covered |
| FR-9 | Edit/delete questions while Draft | 2 | 2.7 | ✓ Covered |
| FR-10 | Assign exam with correctness gate | 2 | 2.8 | ✓ Covered |
| FR-11 | List exams with submission rate | 2 | 2.9 | ✓ Covered |
| FR-12 | Close an exam | 2 | 2.10 | ✓ Covered |
| FR-13 | View assigned exams | 3 | 3.1 | ✓ Covered |
| FR-14 | Timed exam + auto-submit | 3 | 3.2 + 3.4 | ✓ Covered |
| FR-15 | Question navigator | 3 | 3.4 | ✓ Covered |
| FR-16 | Submit + auto-grade transactionally | 3 | 3.3 | ✓ Covered |
| FR-17 | Review detailed results | 3 | 3.5 | ✓ Covered |
| FR-18 | Personal student dashboard | 4 | 4.1 | ✓ Covered |
| FR-19 | Filter statistics by subject | 4 | 4.2 | ✓ Covered |
| FR-20 | Full results history | 4 | 4.3 | ✓ Covered |
| FR-21 | Class-overview + at-risk list | 5 | 5.4 | ✓ Covered |
| FR-22 | Per-exam statistics | 5 | 5.5 | ✓ Covered |
| FR-23 | Individual student detail | 5 | 5.2 | ✓ Covered |
| FR-24 | Teacher class list | 5 | 5.1 | ✓ Covered |
| FR-25 | Class roster with drill-in | 5 | 5.3 | ✓ Covered |
| FR-26 | Student class view + leaderboard | 4 | 4.4 | ✓ Covered |

### Missing Requirements

None. Every PRD FR has a traceable implementation path in a concrete story.

**Reverse check (epics → PRD):** No story introduces a functional requirement absent from the PRD. Supporting `AR-*` (architecture) and `UX-DR*` (design) work items are traceable to the Architecture Spine and design system respectively, not orphaned FRs.

**Notable strengths:**
- The highest-risk FR-16 (transactional idempotent submission) has a dedicated story (3.3) *plus* a concurrency-validation criterion (AR-15, ~40 parallel submits).
- The assignment gate (FR-10) is realized as a single transactional chokepoint (Story 2.8) with typed `errorCode`s — matching the PRD's counter-metric SM-C1.
- NFRs are attached to stories as testable ACs (e.g. NFR-03 content-confidentiality in 3.1/2.10; NFR-11 reliability in 2.3), not left as floating cross-cutting text.

### Coverage Statistics

- **Total PRD FRs:** 26
- **FRs covered in epics:** 26
- **Coverage percentage:** 100%

---

## Step 4 — UX Alignment Assessment

### UX Document Status

**Found.** `docs/design-system.md` (Vietnamese EdTech Standard — full token spec: colors, Inter type scale, spacing, radius, 260px sidebar / 1200px container, component specs) + 11 Stitch screen mockups in `docs/stitch_exports/`. The epics further distill these into 14 actionable UX design requirements (UX-DR1→14) attached to stories.

### UX ↔ PRD Alignment

**Aligned.** The 11 mockups map one-to-one onto the PRD's Information Architecture surface list (§ Information Architecture):
- **Student:** Home, Exam List, Take Exam, Results, Result Detail, Study History, My Class.
- **Teacher:** Home, Exam Management, Review AI Questions (= Create-Exam review screen), Class Management, Detailed Statistics.
- User journeys UJ-1→4 each have a corresponding surface. No UX surface exists without a PRD feature, and no user-facing PRD feature lacks a mockup.

### UX ↔ Architecture Alignment

**Aligned.** Every UX component has architectural support:
- Server-authoritative countdown (UX-DR12) ← `exam_attempts.deadline_at` snapshot timer (AD-20).
- Recharts score-over-time / distribution charts (UX-DR13) ← Recharts pinned in stack; dashboard read-side (AD-08).
- MC controls with correct/incorrect states (UX-DR6) ← results review (FR-17), server-computed `is_correct` (AD-10).
- App shell + role-scoped nav (UX-DR3) ← `frontend/src/features` + role from JWT (AD-17).
- Single API client + TanStack Query (frontend data access convention) supports all data-driven screens.
- No UI component requires a capability the architecture doesn't provide.

### Alignment Issues

None blocking.

### Warnings (minor, non-blocking)

1. **Semantic-color terminology drift.** `docs/design-system.md` prose labels the mild-warning slot **"amber"** and describes red loosely as "incorrect / errors / critical deadlines" — it does **not** itself spell out the SRS §5.3 hard rule that *red = missing answer (EXAM-09/FR-7)* must be visually distinct from *yellow/amber = low-confidence (EXAM-07/FR-6)*. This mapping **is** made explicit and hard-required in the epics (UX-DR2) and in the Architecture Spine (Consistency Conventions § Semantic colors), so the binding is captured where implementers will read it. **Recommendation:** implementers follow UX-DR2's explicit FR-6/FR-7 color mapping; treat "amber" and "yellow" as the same semantic slot. No document change required to proceed.
2. **UX artifacts location.** UX lives under `docs/` (project_knowledge) rather than `planning_artifacts`. Intentional and already referenced by `epics.md`; noted for discoverability only.

---

## Step 5 — Epic Quality Review

Rigorous validation of the 6 epics / 34 stories against create-epics-and-stories best practices.

### Best-Practices Compliance Checklist

| Check | Result |
|-------|--------|
| Epics deliver user value (not technical milestones) | ✅ Pass (1 minor: Epic 6, see below) |
| Epic independence (Epic N never requires Epic N+1) | ✅ Pass |
| Stories appropriately sized & independently completable | ✅ Pass |
| No forward story dependencies | ✅ Pass |
| Database tables created when first needed (not all upfront) | ✅ Pass (exemplary) |
| Clear, testable Given/When/Then acceptance criteria | ✅ Pass |
| Traceability to FRs maintained | ✅ Pass (every story cites its FR) |
| Greenfield: initial-setup story present | ✅ Pass (Story 1.1) |

### Epic-by-Epic Findings

- **Epic 1 (Foundation & Auth)** — Correctly avoids the "standalone technical epic" anti-pattern: scaffold, Docker infra, core schema, API envelope, and design tokens are *folded into the earliest stories* and the epic ships as real login value. Story 1.1 is a proper greenfield project-setup story. ✅
- **Epic 2 (Exam Creation)** — Strong user-value framing; realizes EXAM-01→09 as one flow. The highest-severity correctness gate (Story 2.8) re-validates in-transaction with typed `errorCode`s. ✅
- **Epic 3 (Taking & Grading)** — The highest-risk FR-16 gets a dedicated story (3.3) with an explicit ~40-parallel-submit concurrency AC and idempotent-duplicate (200 no-op) handling. ✅
- **Epic 4 (Student Dashboard)** — Read-side only, no submission-path coupling; clean. ✅
- **Epic 5 (Teacher Dashboard)** — Reuses Epic 4's read layer (Story 5.2), a legitimate backward dependency; includes cross-role refusal AC (FR-2). ✅
- **Epic 6 (Production Deployment)** — See minor concern below.

### Dependency Analysis

- **No forward dependencies found.** Narrative references point backward or are explanatory only (e.g. Story 2.4 sets `reviewed_at` "so the gate in Story 2.8 will accept it" — 2.4 is independently buildable/testable; it does not require 2.8 to exist).
- **Database-creation timing is exemplary** — each table is introduced in the story that first needs it: `users`/`classes`/`class_students` in 1.2; `exams`/`exam_classes`/`questions` in 2.1; `submissions` in 3.1; `exam_attempts` in 3.2; `answer_details` in 3.3; `class_exam_stats` deferred. No "create all tables upfront" violation.
- **Epic independence holds** — Epic 1 stands alone; each later epic consumes only prior-epic outputs.

### 🔴 Critical Violations

None.

### 🟠 Major Issues

None.

### 🟡 Minor Concerns

1. **Epic 6 is an infrastructure epic with no FRs.** It delivers operational value (NFR-05 availability, public HTTPS access) rather than a user feature — borderline against the "no technical epics" rule. **Mitigated:** it is correctly sequenced last, framed around real availability, and a capstone genuinely needs a deploy story. *Acceptable as-is; not a blocker.*
2. **Cross-reference prefix typos (`AR-` vs `AD-`).** Several stories cite `AR-19` (Stories 1.7, 2.1) and `AR-20` (Story 3.2) — but the epics' Additional Requirements list only runs AR-1…AR-15; these clearly mean architecture decisions **AD-19** (rate limiting) and **AD-20** (exam-attempt entity). Purely a citation typo; the substance is correct and present. **Recommendation:** normalize `AR-19→AD-19`, `AR-20→AD-20` during a light editorial pass (optional; does not block implementation).
3. **Full CI/CD pipeline realized in Epic 6 (Story 6.2) rather than Epic 1.** CI-early is a common best practice; here CI-gate-on-merge is *referenced* in Story 1.1's ACs but *fully built* in 6.2. **Acceptable** at single-developer capstone scale, where production deployment is legitimately a later phase. Optional: stand up the lint+test+build GitHub Action during Epic 1 even if VPS deploy waits for Epic 6.

### Acceptance-Criteria Quality

Uniformly high. All ACs use Given/When/Then, are specific and testable (concrete status codes, unique constraints, transactional guarantees), and cover error/edge paths (invalid credentials, 401/403 isolation, past-due 409, duplicate-submit idempotency, stale-parse fencing). The two highest-risk flows (assignment gate, transactional submission) have the most thorough ACs — appropriate risk-weighting.

---

## Summary and Recommendations

### Overall Readiness Status

## ✅ READY

The planning artifacts (PRD, UX, Architecture, Epics & Stories) are complete, mutually consistent, and traceable. The project can proceed to **Sprint Planning → implementation** now.

### Scorecard

| Dimension | Result |
|-----------|--------|
| Document completeness (all 4 types present, no duplicates) | ✅ |
| FR coverage (PRD → epics/stories) | ✅ 26/26 = 100% |
| NFR coverage (attached to stories as ACs) | ✅ 11/11 |
| UX ↔ PRD ↔ Architecture alignment | ✅ Aligned |
| Epic/story structure & dependency hygiene | ✅ No forward deps, incremental schema |
| Acceptance-criteria quality | ✅ Testable Given/When/Then throughout |
| Critical violations | ✅ 0 |
| Major issues | ✅ 0 |
| Minor concerns | 🟡 5 (all non-blocking) |

### Critical Issues Requiring Immediate Action

**None.** No blocker prevents implementation from starting.

### Minor Concerns (fix opportunistically, do not block)

1. **Semantic-color mapping** is explicit only in the epics (UX-DR2) / Architecture, not in `docs/design-system.md` prose — implementers must follow UX-DR2's *red = missing-answer / amber = low-confidence* mapping (SRS §5.3).
2. **`AR-19`/`AR-20` citation typos** in Stories 1.7, 2.1, 3.2 → should read `AD-19`/`AD-20`.
3. **CI pipeline** is fully built in Epic 6; consider standing up the lint+test+build GitHub Action during Epic 1.
4. **UX artifacts** live under `docs/` rather than `planning_artifacts` (intentional; discoverability note).
5. **Two deferred PRD Open Questions** (password-reset email provider; quantitative SM-2/SM-3 targets) — both explicitly non-blocking with revisit conditions; a stubbed email provider is acceptable for the evaluation.

### Recommended Next Steps

1. **Proceed to `bmad-sprint-planning`** — generate the sprint status/plan the implementation agents will follow (Epic 1 first: Story 1.1 scaffold → 1.2 schema/seed → 1.3 envelope → 1.4 shell → 1.5–1.8 auth).
2. **Then the story cycle** — `bmad-create-story` (Story 1.1) → `bmad-dev-story` → `bmad-code-review`, iterating through the sprint.
3. **Optionally** apply the two-minute editorial fixes above (color-mapping note + AR/AD typos) before or during Epic 1 — neither gates the start.

### Final Note

This assessment reviewed 4 document types, 26 FRs, 11 NFRs, and 6 epics / 34 stories. It found **0 critical**, **0 major**, and **5 minor** (non-blocking) issues across document/coverage/UX/epic-quality categories. The plan is unusually well-formed for a capstone — correctness guardrails (idempotent submission, assignment gate, no AI-guessed answers) are traceable end-to-end from SRS → PRD counter-metrics → architecture invariants → story ACs. **Recommendation: proceed to implementation.**

---

*Assessed by: Implementation Readiness workflow (acting Product Manager) · Date: 2026-07-16 · Project: Web_OnThi12*

