---
title: OnThi12
status: final
created: 2026-07-15
updated: 2026-07-15
---

# PRD: OnThi12
*Working title — confirm.*

## 0. Document Purpose

This PRD is for the OnThi12 product owner/developer, the supervising evaluation board, and the downstream BMad workflows (`bmad-architecture`, `bmad-ux`, `bmad-create-epics-and-stories`). It is **distilled from the existing `SRS.md` (v1.1)** — the SRS remains the exhaustive requirements source; this document restructures its content into a capability-first PRD with a Glossary-anchored vocabulary, features grouped with globally numbered Functional Requirements (FR) nested underneath, cross-cutting NFRs in their own section, and assumptions tagged inline and indexed. Deep technical mechanism (message-transport choice, ORM, the UTC+7 date pitfall, architecture decisions AD-01→AD-04) is **not duplicated here** — it lives in `SRS.md`, `TechStack.md`, `docs/PROJECT-STANDARDS.md`, and this run's `addendum.md`, which also carries the FR↔SRS traceability map. Each FR notes its SRS requirement code so nothing is orphaned.

## 1. Vision

OnThi12 is a web platform that helps Vietnamese grade-12 students prepare for the university entrance exam and helps their teachers assign practice exams and track progress in one place. Today students hunt for practice exams scattered across many sources with no systematic way to track their own progress, while teachers manage scores and completion in spreadsheets or notebooks — slow to compile and poor at surfacing a student who is falling behind.

The product's defining bet is **removing the teacher's data-entry burden with AI**: a teacher creates an exam *only* by uploading a PDF (including scanned/image PDFs), and a multimodal AI model (Gemini) extracts the questions, options, answers-if-present, and figure locations into a single review screen. There is no from-scratch authoring screen. The teacher reviews, corrects any misreads, confirms any missing answers, and assigns the exam to their classes. Students then take the exam in a timed, distraction-free interface and are graded automatically the instant they submit.

Because the entire exam-creation flow depends on AI, correctness discipline is the product's spine: the AI never guesses a correct answer, low-confidence and image questions are flagged for teacher attention, and an exam cannot be assigned while any question still lacks a confirmed answer. On the student side, submission is a transaction — one submission per student per exam, never partial, never duplicated — so a whole class submitting at once never loses a result.

## 2. Target User

### 2.1 Jobs To Be Done

**Teacher (subject or homeroom teacher, responsible for one or more classes)**
- When I already have dozens of PDF/scanned exams, I want to publish one to my class *without retyping it*, so I stop avoiding the platform because of data-entry effort. *(functional, the core barrier)*
- When AI extracts an exam, I want to trust that a wrong answer can't silently corrupt every student's score, so I can confirm answers with confidence rather than fear. *(emotional / trust)*
- When my class finishes an exam, I want to see the score distribution and the most-missed questions at a glance, so I know what to reteach. *(functional)*
- When a student starts falling behind, I want to be alerted early instead of discovering it at term's end. *(functional / social)*

**Student (grade-12, member of exactly one class)**
- When I want to practice, I want assigned exams in one place with a countdown timer like the real exam, so my practice mirrors test conditions. *(functional / contextual)*
- When I submit, I want my score and every wrong answer *immediately*, so I can review while it's fresh — no waiting on a teacher. *(functional / emotional)*
- When I've done several exams, I want to see my trend over time and how I compare to my class, so I know whether I'm improving and where to focus. *(functional / social)*

**Builder (this project's developer)**
- I want to build and demonstrate a service-oriented system that exercises real system-design techniques (async queue, read/write split, idempotency, rate limiting, caching, circuit breaker), so the capstone proves architectural competence, not just a working CRUD app. *(builder's own JTBD — explicitly in scope for this project's success, see §7)*

### 2.2 Non-Users (v1)

- **Students not enrolled in a class** — every student belongs to exactly one class; there is no self-serve, class-less practice mode in v1.
- **Teachers wanting to author questions by typing** — unsupported by design; every exam originates from an uploaded PDF.
- **Non-grade-12 / other subjects at scale** — the product is framed around grade-12 entrance-exam prep; nothing hard-blocks other grades, but they are not a v1 design target.
- **Institutional admins as daily users** — admin scope is deliberately minimal in v1.1. **Decision:** teacher accounts and class rosters are provisioned via a seed script / minimal internal endpoint, not a full admin console (which is a Non-Goal, §5). Architecture needs only a seeding path over the existing `users` / `classes` / `class_students` tables.

### 2.3 Key User Journeys

*Named-persona narratives the product enables. FRs reference these by ID inline. Personas are representative (invented) for grade-12 Vietnam.*

- **UJ-1. Cô Lan turns a scanned PDF into an assigned exam without typing a single question.**
  - **Persona + context:** Cô Lan teaches math to two grade-12 classes and has a folder of scanned exam PDFs she's never uploaded anywhere because retyping is too slow.
  - **Entry state:** authenticated as a teacher, on the exam-creation screen.
  - **Path:** she drags a 6-page scanned PDF into the drop zone and enters title/subject/duration; the system accepts it and tells her parsing is running in the background so she can leave the page; minutes later she returns to a single review screen pre-filled with the extracted questions; two questions have a **yellow** low-confidence border and one figure-based question shows an auto-cropped image; three questions carry a **red** "missing answer" flag because the PDF had no answer key.
  - **Climax:** she fixes one misread formula, confirms the cropped figure, and clicks A/B/C/D on each red question; the red flags clear and the "Assign" button becomes enabled.
  - **Resolution:** she assigns the exam to both classes with a due date; status flips Draft → Open; students can now see it. **Edge case:** if Gemini had failed or timed out, she'd see a clear error with her uploaded file preserved and a retry action — never a lost upload.

- **UJ-2. Minh takes a timed exam after dinner and reviews his mistakes immediately.**
  - **Persona + context:** Minh, a grade-12 student, opens the app in the evening study window to practice a math exam his teacher assigned.
  - **Entry state:** authenticated as a student, viewing his assigned-exams list filtered to "not yet done."
  - **Path:** he opens the exam, a countdown starts; he answers one question at a time, jumps around via the question-navigator to revisit a flagged one, then submits with time to spare.
  - **Climax:** the instant he submits, a large score appears with a per-question breakdown — each wrong question shows his choice next to the correct answer.
  - **Resolution:** he's left on the results page having learned what he got wrong; the exam moves to his "done" history. **Edge case:** if the timer hits zero first, the system auto-submits whatever he has and grades it the same way.

- **UJ-3. Minh checks whether he's actually improving.**
  - **Persona + context:** after several exams, Minh wants to know if his practice is paying off.
  - **Entry state:** authenticated student, on his personal dashboard.
  - **Path:** he sees average score, number of exams done, a score-over-time chart, and his average versus the class average; he filters to just "Math" to see the trend for that subject.
  - **Climax:** the subject-filtered trend line makes it obvious math is trending up while another subject lags.
  - **Resolution:** he knows where to spend the next study session.

- **UJ-4. Cô Lan spots a struggling student and finds the class's weakest topic.**
  - **Persona + context:** Cô Lan opens her dashboard the morning after an exam deadline.
  - **Entry state:** authenticated teacher, on the class-overview dashboard.
  - **Path:** she sees each class's average and submission rate, plus an "at-risk" list ordered by severity; she clicks one exam to see its score distribution and the questions with the highest wrong-answer rate, then clicks a flagged student to see that student's full history.
  - **Climax:** the most-missed-questions list points at a specific concept the class didn't grasp.
  - **Resolution:** she knows exactly what to reteach and which student to check on. `[ASSUMPTION: v1 at-risk detection is a simple heuristic (declining scores or long inactivity), not a predictive model — SRS DASH-04; advanced alerting is post-MVP NFR-06.]`

## 3. Glossary

*Downstream workflows and readers must use these terms exactly. Introducing a synonym anywhere is a discipline violation.*

- **User** — an authenticated account with exactly one **Role**: Student or Teacher (Admin is a limited operational role, §2.2).
- **Student** — a User who belongs to exactly one **Class**, takes **Exams**, and views a personal **Dashboard**.
- **Teacher** — a User responsible for one or more **Classes**; creates **Exams** from uploaded files and views class/student **Dashboards**.
- **Class** — a group of Students with one responsible Teacher. A Student belongs to exactly one Class; a Teacher may have many.
- **Exam** — a set of single-correct-answer multiple-choice **Questions** created from exactly one uploaded **Source File**, then **Assigned** to one or more Classes. Has a **Status**: Draft, Open, or Closed.
- **Source File** — the original PDF a Teacher uploaded; the single origin of an Exam, retained for re-parsing and reference.
- **Question** — one auto-gradable item in an Exam: a **Question Type**, content, a type-dependent answer payload, an optional **Correct Answer**, an optional figure image, an **AI Confidence**, and an **Answer Status**.
- **Question Type** — the *answer format* of a Question, matching the three parts of the current THPT exam paper (SRS v1.2 §3.6). One of: `mcq_single` (four Options, pick one), `true_false_group` (four Statements, each marked True or False independently), `short_answer` (no options; the Student enters a numeric value). Not a topic tag.
- **Option** — one of the four answer choices (A/B/C/D) of an `mcq_single` Question.
- **Statement** — one of the four sub-items a)/b)/c)/d) of a `true_false_group` Question, each independently True or False.
- **Correct Answer** — a Question's confirmed answer; **nullable** — empty until confirmed. Its shape follows the Question Type: an Option letter, four booleans (one per Statement), or a numeric value.
- **Partial Credit** — the score a `true_false_group` Question earns when only some of its four Statements are answered correctly, on the official **non-linear** scale (1 → 0,1 · 2 → 0,25 · 3 → 0,5 · 4 → 1,0). Unique to that type; the other two types are all-or-nothing.
- **Subject** — the exam's subject, an **enum** (`toan`, `vat_li`, `hoa_hoc`, `sinh_hoc`, `lich_su`, `dia_li`, `gdktpl`, `tieng_anh`), not free text. It is an enum because `short_answer` points depend on it (Toán 0,5 vs. 0,25 elsewhere) and a typed string cannot safely key a scoring lookup.
- **Answer Status** — a Question's answer state: `ai_extracted` (AI read an answer), `needs_confirmation` (no answer found — "missing answer"), or `manually_confirmed` (Teacher set it). Gates **Assignment**.
- **AI Confidence** — the AI model's self-reported reading confidence for a Question, used to flag low-confidence items for review.
- **Bounding Box** — AI-returned coordinates of a figure region on a page, used to auto-crop a Question's figure image.
- **AI Parsing** — the asynchronous step where the system sends Source File pages to Gemini and receives structured questions/answers/figure locations.
- **Assign** — the Teacher action that attaches an Exam to Classes with a due date and flips Status Draft → Open. Blocked while any Question is `needs_confirmation` or has an unresolved flag.
- **Submission** — one Student's graded attempt at one Exam. At most one Submission per Student per Exam (idempotent).
- **Answer Detail** — one answered Question within a Submission: the Student's answer (shape follows the Question Type), whether it was correct, and the points earned (which may be partial for `true_false_group`).
- **Dashboard** — a read-only statistics view (cards + charts) for a Student (personal) or a Teacher (class/exam/student).
- **Class Exam Stats** — a pre-computed statistics record per Class per Exam (average score, completion rate); a post-MVP optimization.

## 4. Features

*FRs are numbered globally (FR-1…FR-26) for stable downstream references. Each FR notes its SRS code. Priority (Cao=High / TB=Medium / Thấp=Low) is preserved per FR per the SRS; all listed FRs are in the MVP (§6).*

### 4.1 Authentication & Role-Based Access

**Description:** Users log in with email and password and are routed to a role-specific experience; a Student can never reach Teacher management screens or APIs and vice versa. Password reset is available via email. Realizes the entry state of all journeys.

**Functional Requirements:**

#### FR-1: Email/password login with role routing *(SRS AUTH-01, Cao)*
A User can authenticate with email and password and is directed to the Student or Teacher experience based on their Role.
**Consequences (testable):**
- Valid credentials return an auth token carrying the User's Role; invalid credentials are rejected without revealing which field was wrong.
- After login, the landing surface and navigation match the User's Role.
- Passwords are verified against a stored **hash**, never a plaintext value.

#### FR-2: Role-based access enforcement *(SRS AUTH-02, Cao)*
The system enforces Role on every protected route so Students cannot access Teacher functions/pages/APIs and vice versa.
**Consequences (testable):**
- A Student token calling any Teacher-only endpoint receives an authorization failure (403), not data.
- A Teacher token calling any Student-only endpoint receives an authorization failure (403).
- Role is taken from the verified token, never from a client-supplied field.

#### FR-3: Password reset via email *(SRS AUTH-03, TB)*
A User can reset a forgotten password through an email verification flow.
**Consequences (testable):**
- Requesting a reset for a registered email sends a time-limited reset link; requesting for an unknown email reveals nothing about account existence.
- A used or expired reset link cannot set a new password.
**Notes:** `[NOTE FOR PM]` email delivery provider/SMTP is unspecified — see Open Question 1.

### 4.2 Exam Creation via PDF Upload + AI Parsing (Teacher)

**Description:** The single, chained teacher flow: upload a PDF → AI extracts questions asynchronously → the results fill one review/edit screen → the teacher corrects misreads, confirms auto-cropped figures, and **must** resolve every flagged and missing-answer question → the teacher assigns to classes. There is no blank authoring screen. This whole feature is EXAM-01→09 and, per SRS §8, should be built as one seamless flow. Realizes UJ-1.

**Functional Requirements:**

#### FR-4: Create an exam by uploading a PDF *(SRS EXAM-01, Cao)*
A Teacher can create an Exam by uploading exactly one PDF (including scanned/image PDFs) and entering title, subject, and duration.
**Consequences (testable):**
- The uploaded PDF is retained as the Exam's Source File and remains available after parsing.
- A new Exam is created in Draft status tied to that Source File.
- No code path allows creating an Exam without an uploaded file.
**Out of Scope:** manual question authoring; non-PDF formats. `[ASSUMPTION: exactly one primary PDF per exam; a separate optional answer-key file is handled in FR-7.]`

#### FR-5: Asynchronous multimodal question extraction *(SRS EXAM-06, Cao)*
On upload, the system enqueues an AI Parsing job that sends Source File pages to a multimodal AI (Gemini) and returns structured questions (**Question Type**, content, the type's answer payload, Correct Answer if present, figure-present flag, AI Confidence) into the review screen.
**Consequences (testable):**
- Extraction runs **asynchronously**; the upload request returns without waiting for Gemini, and the Teacher can leave the page.
- Each extracted Question carries an AI Confidence and an Answer Status derived from whether an answer was found.
- **Each extracted Question is classified into one of the three Question Types** (SRS v1.2 §3.6 / QTYPE-04). A question matching none of them is skipped rather than coerced into a type it does not fit.
- The Gemini API key is read from backend environment only and is never sent to or exposed in the frontend.
**Feature-specific NFRs:** must degrade gracefully on Gemini error/timeout/quota — see FR-8's error path and NFR-11.

#### FR-6: Flag attention-needed questions in the review screen *(SRS EXAM-07, Cao)*
Questions that are low-confidence or contain a figure are visibly flagged in the review list so the Teacher prioritizes checking them before assigning.
**Consequences (testable):**
- Low-confidence questions render a **yellow** warning treatment distinct from the red "missing answer" treatment.
- An Exam cannot be Assigned while any flagged question remains unresolved and the Teacher has not explicitly acknowledged/dismissed the flag.

#### FR-7: Confirm correct answer when the file has no answer key *(SRS EXAM-09, Cao)*
When AI cannot extract a Question's Correct Answer, the Question is marked "missing answer" (`needs_confirmation`) and the Teacher **must** set the answer before the Exam can be Assigned; alternatively the Teacher may upload a separate answer-key file (image or short PDF) for the AI to match by question number.
**Consequences (testable):**
- A `needs_confirmation` Question renders in **red**, distinct from the yellow low-confidence flag.
- **The confirmation control follows the Question Type** (SRS v1.2 QTYPE-05): click A/B/C/D for `mcq_single`; mark True/False on each of the four Statements for `true_false_group`; enter a numeric value for `short_answer`. The gate itself is type-blind — any `needs_confirmation` Question of any type blocks Assignment.
- Setting an answer moves the Question to `manually_confirmed`; the AI never auto-fills a `needs_confirmation` answer.
- With any `needs_confirmation` Question present, the Assign action is disabled/blocked.
- Uploading an answer-key file matches answers by question order/number and moves matched Questions to a confirmed state, still subject to Teacher review.
**Out of Scope:** The v1 answer-key file is a simple ordered list mapping question number → letter (e.g. "1-A, 2-C, 3-B…") as a short PDF or image; the AI joins it to Questions by sequence/number. Complex layouts (multi-column tables, per-section keys) are out of MVP scope — the Teacher falls back to the always-available manual A/B/C/D path. *(Resolves the former answer-key-format open question.)*

#### FR-8: Auto-detect and crop question figures *(SRS EXAM-08, TB)*
For Questions with a figure/graph/table, the AI returns a Bounding Box; the system auto-crops the image from the source page (with padding) and attaches it to the Question, letting the Teacher confirm or re-crop manually.
**Consequences (testable):**
- Cropped images are generated with padding around the Bounding Box.
- A cropped figure is not final until the Teacher confirms it; the Teacher can manually re-crop.
- If AI Parsing fails/times out/exhausts quota, the Teacher sees a clear error, the Source File is preserved, and a retry is offered (no data loss). *(NFR-11)*
- **Retry policy:** the worker auto-retries *transient* failures (timeout, 5xx, 429/rate-limit) a small bounded number of times with backoff; on exhaustion or a non-retryable error (quota exhausted, unreadable file) it stops calling (circuit-breaker open) and surfaces the teacher-facing error with a manual "retry parsing" action — never an infinite retry loop. *(Resolves the former AI-retry-UX open question; mechanism in addendum §G.)*

#### FR-9: Edit/delete questions while Draft *(SRS EXAM-05, TB)*
A Teacher can edit extracted Question content/answers (to fix AI misreads) and delete Questions while the Exam is in Draft. An Exam that already has Student Submissions cannot be deleted — only Closed.
**Consequences (testable):**
- Edits to Questions are permitted only while Status is Draft.
- Delete is blocked for any Exam with ≥1 Submission; Close remains available.

#### FR-10: Assign an exam to classes *(SRS EXAM-02, Cao)*
A Teacher can assign an Exam to one or more Classes with a due date, flipping Status Draft → Open — but only when no Question is `needs_confirmation` and no flag is unresolved.
**Consequences (testable):**
- Assignment is rejected if any Question is `needs_confirmation` or has an unresolved flag (composes FR-6, FR-7).
- On successful Assign, Status becomes Open and the Exam appears to the assigned Classes' Students.
- Due date comparisons are timezone-correct (no UTC+7 off-by-one). *(see addendum / PROJECT-STANDARDS §9)*

#### FR-11: List created exams with submission rates *(SRS EXAM-03, Cao)*
A Teacher can view all Exams they created, filter by Status (Draft/Open/Closed), and see the share of Students who have submitted for each.
**Consequences (testable):**
- The list is filterable by Status.
- Each Exam shows a submission rate for its assigned Classes.

#### FR-12: Close an exam *(SRS EXAM-04, TB)*
A Teacher can close an Exam at or before its due date; after closing, no new Submissions are accepted.
**Consequences (testable):**
- After Close, any submit attempt is rejected.
- Exam content is not visible to Students once the Exam is no longer Open. *(NFR-03)*

### 4.3 Taking Exams & Auto-Grading (Student)

**Description:** Students see assigned exams, take them under a countdown in a distraction-free one-question-at-a-time interface with a question navigator, submit (or are auto-submitted at time-out), and are graded instantly and transactionally. Realizes UJ-2.

**Functional Requirements:**

#### FR-13: View assigned exams *(SRS TAKE-01, Cao)*
A Student can view Exams assigned to their Class, filtered by state (not-yet-done / done) and by subject, with not-yet-done exams highlighted.
**Consequences (testable):**
- Only Exams assigned to the Student's Class and currently Open are listed as takeable.
- Filters by done-state and subject work independently.

#### FR-14: Take a timed exam with auto-submit *(SRS TAKE-02, Cao)*
A Student answers multiple-choice Questions one at a time under a countdown set by the Exam's duration; the system auto-submits when time expires.
**Consequences (testable):**
- The countdown reflects the Exam's configured duration.
- At time zero, the system submits the current answers automatically and grades them (composes FR-16).
- The taking interface shows only exam content — no distracting secondary navigation. *(NFR-07)*

#### FR-15: Navigate between questions *(SRS TAKE-03, TB)*
A Student can see an overview of answered/unanswered Questions and move freely between them during the attempt.
**Consequences (testable):**
- The navigator distinguishes answered from unanswered Questions.
- The Student can jump to any Question without losing prior answers.

#### FR-16: Submit and auto-grade transactionally *(SRS TAKE-04, Cao — highest-risk)*
On submit (manual or auto), the system matches answers, computes the score immediately, and writes the Submission and its Answer Details in a single transaction — exactly one Submission per Student per Exam.
**Consequences (testable):**
- Grading uses each Question's confirmed Correct Answer; scoring completes without teacher involvement.
- **Grading branches on Question Type** (SRS v1.2 §3.6 / QTYPE-06): `mcq_single` is 0,25 in every subject; **`true_false_group` awards Partial Credit** on the non-linear scale, max 1,0 in every subject; `short_answer` is 0,5 for `toan` and 0,25 for `vat_li`/`hoa_hoc`/`sinh_hoc` — the only subject-dependent value.
- **`short_answer` is matched by numeric value, not string equality** — `1,5`, `1.5` and `1.50` are the same answer.
- **The raw score is normalized to 0–10 by the exam's actual maximum**, so a partial practice exam scores fairly; for a full official paper the maximum is already 10 and the official score is preserved exactly.
- The write is atomic: never a partially written Submission.
- Submitting twice yields exactly one Submission (idempotent) — enforced by a unique constraint on (student, exam); a second submit is rejected/no-ops rather than duplicating.
- Correctness/`is_correct` is computed server-side, never trusted from the client.
- **Concurrency target (NFR-01):** the write holds under ~40 concurrent submissions in one window with exactly-once results and no partial rows — validated for the capstone by a lightweight concurrency script (fire ~40 parallel submits, assert one row each, none partial), not a full load-test suite. *(Resolves the former concurrency-proof open question.)*

#### FR-17: Review detailed results *(SRS TAKE-05, Cao)*
After submitting, a Student sees the score, the count of correct/incorrect, and for each wrong Question both the chosen Option and the Correct Answer.
**Consequences (testable):**
- The results view shows total score and correct/incorrect counts.
- Every incorrect Question displays chosen vs. correct answer, in the shape of its Question Type.
- **A `true_false_group` Question is broken down per Statement** (which of a/b/c/d were right) plus the Partial Credit earned — "wrong" at the question level does not tell the Student which Statement they missed.

### 4.4 Student Dashboard

**Description:** A student's personal progress view: headline cards, score-over-time chart, subject filtering, class comparison, and a full history table. Realizes UJ-3. Reads pre-aggregated/cached stats, not the submission write path.

**Functional Requirements:**

#### FR-18: Personal student dashboard *(SRS DASH-01, Cao)*
A Student can view average score, number of Exams done, a study-streak count, a score-over-time chart, and a comparison of their average to the Class average.
**Consequences (testable):**
- Four headline cards render (average score, exams-done, study streak, vs-class), matching the SRS §5.1 student-home layout.
- The study-streak card shows the count of consecutive days the Student practiced (an exam attempt on a day counts toward the streak; a gap day resets it). `[ASSUMPTION: "practice day" = a day with ≥1 exam attempt in the Student's local day; timezone handled per addendum §D.]`
- The trend chart and metrics reflect the Student's Submissions.
- The class-comparison shows the Student's average against the Class average.

#### FR-19: Filter statistics by subject *(SRS DASH-02, Cao)*
A Student can select one subject to see average score, trend chart, and exam history scoped to that subject.
**Consequences (testable):**
- All dashboard figures recompute for the selected subject only.

#### FR-20: Full results history *(SRS DASH-03, TB)*
A Student can view their entire Exam history as a table, filter by subject, and sort by date or score.
**Consequences (testable):**
- The table lists all of the Student's Submissions with subject filter and date/score sort.

### 4.5 Teacher Dashboard

**Description:** Teacher analytics across classes, exams, and individual students, including an at-risk list and per-exam difficulty analysis. Realizes UJ-4. Reads pre-aggregated/cached stats.

**Functional Requirements:**

#### FR-21: Class-overview dashboard with at-risk list *(SRS DASH-04, Cao)*
A Teacher can view each responsible Class's average score, submission rate, and a list of at-risk Students (declining scores or long inactivity) ordered by severity.
**Consequences (testable):**
- Per-Class average and submission rate are shown for every responsible Class.
- The at-risk list is ordered by a severity heuristic.

#### FR-22: Per-exam statistics *(SRS DASH-05, Cao)*
A Teacher can select one Exam to see the Class's score distribution and the Questions with the highest wrong-answer rate.
**Consequences (testable):**
- A score-distribution view renders for the selected Exam.
- Questions are rankable by wrong-answer rate (most-missed surfaced).

#### FR-23: Individual student detail *(SRS DASH-06, TB)*
A Teacher can open one Student to see that Student's full score history, mirroring the Student's own personal dashboard.
**Consequences (testable):**
- The Teacher view of a Student shows the same history/metrics the Student sees for themselves.

### 4.6 Class Management

**Description:** Teacher-side class and roster views, plus a light student-side class info and leaderboard.

**Functional Requirements:**

#### FR-24: Teacher class list *(SRS CLASS-01, Cao)*
A Teacher can view their responsible Classes, each showing student count, average score, and most-recent submission rate.
**Consequences (testable):**
- Every responsible Class appears with student count, average, and recent submission rate.

#### FR-25: Class roster *(SRS CLASS-02, Cao)*
A Teacher can select a Class to view its Students in a table (average score, most-recent activity) and drill into any Student.
**Consequences (testable):**
- The roster lists each Student with average and last-activity, linking to the per-student detail (FR-23).

#### FR-26: Student class view with mini-leaderboard *(SRS CLASS-03, Thấp)*
A Student can view their Class info (homeroom teacher, class average) and a compact leaderboard (top 3 plus their own rank).
**Consequences (testable):**
- The view shows class info and a leaderboard of top 3 plus the Student's own position.

## 5. Non-Goals (Explicit)

- **No from-scratch manual authoring.** Every Exam must originate from an uploaded PDF; there is no blank question-entry screen. *(SRS §1.4)*
- **No AI-guessed answers.** When the file has no answer key, the Teacher must confirm manually; the system never infers a Correct Answer. *(the highest-risk failure the design forbids)*
- **No essay/free-text auto-grading** — single-correct multiple-choice only in v1.1.
- **No automatic topic/question-type tagging** — Questions carry no topic tag; the DB has no such column in v1.1.
- **No advanced anti-cheat** (face recognition, camera-based tab-switch detection).
- **No native mobile app** — responsive web only, tablet-friendly, desktop-first.
- **No payments / paid tiers.**
- **No fully-automatic, no-review grading of parsed exams** — teacher review (EXAM-07) is always mandatory and cannot be disabled.
- **No full admin console** in v1.1 — admin (teacher-account creation, class-list management) is minimal/limited scope, handled by a seed script / minimal internal endpoint (§2.2).

## 6. MVP Scope

### 6.1 In Scope

- All 26 FRs above (AUTH FR-1→3, EXAM FR-4→12, TAKE FR-13→17, DASH FR-18→23, CLASS FR-24→26), delivered across the SRS §8 five-week roadmap. Priority labels (Cao/TB/Thấp) are preserved per FR but every item is in the MVP.
- **Asynchronous AI Parsing via a message queue is MVP**, not deferred — it is the core mechanism of the exam-creation flow. `[ASSUMPTION: the SRS §9.2 "message queue" post-MVP item refers to *scaling/batching* the queue (multi-page batch calls), not to introducing async parsing itself, which project-context.md places in the core stack. Reconciled — see addendum.]`
- **Correctness guardrails are MVP**: transactional idempotent submission (FR-16), assignment blocking (FR-6/7/10), role guards (FR-2), password hashing (FR-1).
- Rate limiting on login and AI-Parsing calls — SRS §9.6 recommends doing this *with* the MVP.

### 6.2 Out of Scope for MVP

- **Pre-aggregated `Class Exam Stats` table + Redis caching for dashboards** — MVP computes dashboard stats by querying `submissions` directly. Deferred until dashboards exceed the 2s bar or a class passes ~30 exams. *(SRS §9.1)* `[NOTE FOR PM: dashboards are read-model-separated in design from day one (FR-18/21 read side), so adding the cache later is non-breaking.]`
- **Batch multi-page AI Parsing** (calling Gemini per-batch instead of per-page) — deferred until >5 teachers import concurrently cause slowness. *(SRS §9.2)*
- **Splitting Submission and Dashboard into independent deployed services** — modular monolith first; split when >3–4 classes take exams in the same window. *(SRS §9.3)*
- **Horizontal scaling + Postgres read replica** — deferred past 200 concurrent users / sustained >80% VPS load. *(SRS §9.4)*
- **Advanced at-risk alerting / predictive detection** — v1 at-risk is a simple heuristic. *(SRS §9, NFR-06)*
- **Full admin console** — deferred; minimal provisioning only in v1.1.
- **Prometheus/Grafana observability** — post-MVP, though SRS §9.5 recommends starting once real users exist.

## 7. Success Metrics

*Success spans four lenses the product owner selected: capstone-evaluation completeness, AI-parsing quality/effort-saved, pilot adoption, and system-design technique practice.*

**Primary**
- **SM-1 — End-to-end flow completeness (capstone).** The full chain (upload → AI parse → review → confirm answers → assign → take → auto-grade → dashboard) runs correctly end-to-end in the evaluation demo, with zero correctness-guardrail violations (no exam assigned with an unconfirmed answer; no lost/duplicate submission). Validates FR-4→FR-17 as a chain.
- **SM-2 — AI-parsing quality.** On representative sample exams, structure extraction ≈100% and text/formula content accuracy ≈90–100% (per SRS benchmark), measured as teacher edit-rate per parsed Question staying low. Validates FR-5. `[ASSUMPTION: concrete edit-rate threshold TBD — Open Question 2.]`
- **SM-3 — Teacher effort saved.** A Teacher publishes a typical multi-page exam predominantly by *reviewing*, not typing — time-to-publish well below manual re-entry. Validates FR-4, FR-5, FR-9. `[ASSUMPTION: target time TBD — Open Question 2.]`

**Secondary**
- **SM-4 — Pilot adoption.** At least one real Class uses the platform: ≥1 Teacher publishes exams and Students submit, exercising FR-10 and FR-16 under real (concurrent) conditions.
- **SM-5 — System-design techniques demonstrated (builder objective).** A checklist of SRS §9.8 techniques is actually implemented and demonstrable: async queue (FR-5), read/write separation (dashboards vs. submission), idempotent submission (FR-16), rate limiting, caching path, and circuit-breaker/graceful-degradation on Gemini (FR-8/NFR-11). Validates the architectural learning goal. `[ASSUMPTION: caching and pre-aggregation are "path demonstrated," not fully load-tested, given they are post-MVP §9.1.]`

**Counter-metrics (do not optimize)**
- **SM-C1 — Never trade answer-confirmation for speed.** The rate of `needs_confirmation` Questions bypassed without explicit teacher confirmation must stay **exactly zero**. Counterbalances SM-2/SM-3 — do not "speed up" exam creation by letting AI guess answers.
- **SM-C2 — Never trade submission integrity for dashboard freshness.** Lost or duplicated Submissions must stay **exactly zero** even at peak concurrency, regardless of dashboard staleness. Counterbalances SM-4/SM-1.
- **SM-C3 — Don't over-engineer ahead of thresholds.** Post-MVP optimizations (cache, service split, replicas) should not be built before their SRS §9.7 trigger fires. Counterbalances SM-5 — technique practice is a goal, but premature optimization is an explicit anti-goal.

## 8. Open Questions

*Architecture-affecting questions were resolved at finalize (folded into FR-7, FR-8, FR-16, §2.2). The two below are deferred with explicit revisit conditions — they touch secondary features and don't block UX/architecture/epics.*

1. **Password-reset email delivery (FR-3, priority TB).** Which SMTP/email provider backs the reset flow, and is it live or stubbed in the demo? *Revisit before implementing AUTH-03; a stub is acceptable for the evaluation.*
2. **Quantitative targets for SM-2/SM-3.** Concrete teacher edit-rate threshold and time-to-publish target. *Revisit after AI parsing has run on ≥3 representative sample exams — the data sets a defensible threshold rather than a guessed one.*

*Resolved at finalize (2026-07-15): admin/provisioning model → seed script/minimal endpoint (§2.2, §5); answer-key file format → ordered number→letter list, AI joins by index (FR-7); AI-parsing retry UX → bounded auto-retry on transient errors + circuit-breaker + manual retry (FR-8, addendum §G); concurrency proof → transactional+idempotent design validated by a ~40-parallel-submit script (FR-16).*

## 9. Assumptions Index

*Every `[ASSUMPTION]` surfaced for explicit confirmation:*
- §2.3 UJ-4 — v1 at-risk detection is a simple heuristic (declining scores / inactivity), not predictive.
- §4.2 FR-4 — Exactly one primary PDF per exam; a separate optional answer-key file is the only additional upload (FR-7).
- §4.4 FR-18 — "Practice day" for the study streak = a day with ≥1 exam attempt in the Student's local day (timezone per addendum §D).
- §6.1 — SRS §9.2's "message queue" post-MVP item means *scaling/batching* the queue, not introducing async parsing (which is MVP per project-context.md). Reconciled in addendum §B.
- §7 SM-2 / SM-3 — Concrete edit-rate and time-to-publish targets are TBD (Open Question 2).
- §7 SM-5 — Caching/pre-aggregation counts as "path demonstrated," not load-tested, per post-MVP §9.1.

---

## Cross-Cutting NFRs

*System-wide non-functional requirements (SRS §4), not tied to one feature.*

- **NFR-01 — Submission throughput/integrity.** Handle ≥40 Students submitting within the same 5-minute window with zero data loss.
- **NFR-02 — Dashboard latency.** Dashboards load in <2s for a Class of ≤40 Students with ≤30 Exams of history. *(post-MVP cache/pre-aggregate is the lever if this is violated.)*
- **NFR-03 — Security & content confidentiality.** Passwords are hashed before storage; Exam content is visible to Students only while the Exam is Open.
- **NFR-04 — Data integrity.** Submission is a transaction — never partially written, never duplicated (idempotent). *(The single highest-priority NFR; realized by FR-16.)*
- **NFR-05 — Availability.** Stable during real exam windows (typically weekday evenings 19:00–22:00).
- **NFR-06 — Scalability.** Architecture allows adding services/cache (Redis) without a rewrite as classes/students grow.
- **NFR-07 — Usability.** The exam-taking UI is minimal and distraction-free, usable quickly on desktop and tablet.
- **NFR-08 — Maintainability.** Code is organized by service module (auth, exam, submission, dashboard, ai-parsing, class) for independent testing/extension.
- **NFR-09 — AI operating cost.** At MVP scale, Gemini free tier (Flash/Flash-Lite) suffices; the API key lives in backend env only, never hard-coded, never exposed to the frontend; daily quota is monitored.
- **NFR-10 — Data privacy on external AI calls.** Only exam-page images (no student PII) are sent to the AI service; a real deployment with student data would require a paid tier that excludes third-party training use.
- **NFR-11 — AI-dependency reliability.** Because the entire creation flow depends on Gemini, the system must handle its error/timeout/quota exhaustion: clear teacher-facing message, Source File preserved for retry, no loss of the original file. *(Realized via FR-8 error path + circuit-breaker/graceful-degradation, SRS §9.8.)*

## Constraints & Guardrails

**Safety (correctness).** The product's central safety property: AI never sets a Correct Answer it didn't read; a Teacher must confirm every `needs_confirmation` Question; an Exam cannot be Assigned with any unconfirmed answer or unresolved flag. One wrong answer would corrupt the score of every Student who takes the Exam — this is the system's highest-severity risk.

**Privacy.** Only exam-page imagery is sent to the external AI (no student PII) — NFR-10. Student data stays within the platform's own database.

**Cost.** MVP runs on free tiers (Gemini Flash/Flash-Lite, Oracle Cloud Free Tier / small VPS); rate limiting on AI-Parsing protects the daily quota (SRS §9.6) — NFR-09.

## Risks & Mitigations

*From SRS §1 risk table — the product-level register.*

- **100% dependency on AI parsing for exam creation** *(High)* → separate AI-Parsing service, async via queue, keep Source File for retry, circuit breaker / graceful degradation. *(NFR-11)*
- **AI misreads/guesses a wrong answer, corrupting a whole class's scores** *(High)* → EXAM-09 forces manual confirmation when no answer key; AI never guesses (FR-7, SM-C1).
- **Bounding-box crop is off** *(Medium)* → crop with padding + mandatory teacher confirmation before saving (FR-8).
- **Lost/duplicate submissions when a class submits at once** *(High)* → submission is transactional and idempotent (FR-16, NFR-04).
- **Gemini quota exhaustion/failure** *(Medium)* → quota monitoring, rate limiting, clear error messaging, keep file for retry (NFR-09, NFR-11).

## Integration & Dependencies

- **Google Generative AI (Gemini Flash/Flash-Lite)** — the sole external dependency in the creation flow; backend-only key; the reliability contract is NFR-11. This is the only third-party runtime dependency in the critical path.
- **Message queue (RabbitMQ)** — decouples upload from parsing so the request returns immediately (async). MVP.
- **Redis** — cache/rate-limit; rate limiting is MVP-recommended, dashboard caching is post-MVP.
- **PostgreSQL** — system of record; JSON column for Options; strong transactions back NFR-04.

## Platform

Responsive web only (desktop-first, tablet-friendly); no native mobile app in v1.1. Requires a stable internet connection during exam-taking — no offline mode.

## Information Architecture (surfaces)

*Two role-scoped experiences sharing one sidebar shell (SRS §5); listed so UX/architecture inherit the surface map.*

- **Student:** Home (greeting, days-to-exam countdown, 4 metric cards, score-over-time chart, subjects-to-review, recent exams) · Exams (assigned list, filters) · Take-Exam (one question, countdown, navigator, submit) · Results (post-submit review) · History (full table) · Class (info + mini-leaderboard).
- **Teacher:** Home (classes/students overview, 4 cards, class list w/ averages, at-risk list by severity) · Exams (created list, status filter, submission rate) · Create-Exam (drag-drop upload → single review/edit screen; no blank authoring) · Classes (roster, drill-in) · Statistics (class comparison, score distribution, most-missed questions per exam).
- **Semantic colors (SRS §5.3):** green = good/high, yellow = mild warning (low-confidence, EXAM-07), **red = "missing answer" (EXAM-09)** — kept visually distinct.
