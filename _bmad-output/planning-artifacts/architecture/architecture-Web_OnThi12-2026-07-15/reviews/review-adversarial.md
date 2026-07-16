# Adversarial Review — ARCHITECTURE-SPINE.md (OnThi12)

**Reviewer stance:** construct two units one level down that each obey *every* AD to the letter, yet build incompatibly. Each finding below is such a pair. The spine is strong on ownership and lifecycle; the holes are almost all at **timing/ordering seams** the ADs describe as states but never as *concurrent* states, plus one seam (blob storage) where the AD-05 single-writer discipline simply isn't extended.

**Verdict:** The spine is coherent and unusually disciplined for its size, but it reasons about the system as a sequence of quiescent states, not as concurrent actors. Six seams let two AD-compliant units diverge; two of them (H1 close/cutoff-mid-attempt, H3 assign vs. edit TOCTOU) can violate the product's stated highest-severity invariants (lost submission / an Open exam with an unconfirmed answer). Close them by adding an **Attempt** entity + snapshot-cutoff rule, a **serialize-on-the-exam-row** rule for all lifecycle mutations, a **parse-generation fence**, an explicit **aggregation trigger edge**, a **reconciled logout semantics**, and by **extending AD-05 to the file volume**.

---

## H1 — `submission` vs `exam`: Close / due-date cutoff evaluated *mid-attempt* loses a legitimate attempt  **[critical]**

**Units:** `submission` (the write/grade path, AD-12) and `exam` (lifecycle owner, AD-09/AD-11).

**Both obey the ADs:**
- AD-09 permits `Open → Closed` by the teacher at any time ("Manual Close is an *early* stop").
- AD-11 says the submission path **rejects a submit when `now > due_date` OR `status ≠ Open`**, and there is deliberately **no attempt entity and no scheduler**.
- FR-14 requires auto-submit at time-zero to **grade** the attempt.

**How they diverge:** There is no `attempt` / `started_at` record anywhere in the entity model (the ER diagram jumps straight from `exams` to `submissions`). So "the attempt" exists only in the browser. Two legitimate timelines break:
1. Student starts an Open exam at 19:50 with a 30-minute duration; teacher clicks **Close** at 20:00 (AD-09-legal). At 20:20 the client auto-submits (FR-14-mandated) → AD-11 rejects because `status ≠ Open`. The student's whole attempt is silently destroyed — a *lost submission*, which SM-C2/NFR-04 say must stay **exactly zero**.
2. Teacher sets `due_date = today 20:00`; student starts at 19:55 with a 30-min duration. Auto-submit at 20:25 is `now > due_date` → rejected. Same loss. Nothing in the spine forbids `start_time + duration > due_date`; duration and due_date are set by unrelated actions.

Both modules are individually correct: `exam` closed an exam it's allowed to close; `submission` enforced the cutoff exactly as written. The spine never decides **when** the cutoff is evaluated (attempt-start vs. submit-time) or **what protects an in-flight attempt**.

**Secondary (same seam):** near-simultaneous manual submit + auto-submit both hit the unique constraint (AD-12) — one no-ops, but *which answer set wins is nondeterministic*, and the spine never says.

**Tightening (new/extended AD):**
- Add an **`attempt` entity** (`id, student_id, exam_id, started_at, deadline_at, status`) owned by `submission`, created on "start exam." Compute `deadline_at = min(started_at + duration, exam_class.due_date)` at start; the countdown and auto-submit derive from it.
- **Reframe AD-11:** eligibility to *start* is gated on `status = Open AND now ≤ due_date`; once an attempt exists, a submit for that attempt is accepted as long as `now ≤ attempt.deadline_at`, **independent of a subsequent Close** — Close stops *new* starts, it does not invalidate a running attempt. State explicitly: "a legitimate in-flight attempt is never lost by a Close or a due-date flip."
- Define the tie-break: first committed submit wins (AD-12 unique constraint); a losing concurrent submit returns the winning result rather than an error.

---

## H2 — `ai-parsing` worker vs `exam`: re-parse `replace-all` clobbers teacher edits, and a stale worker result clobbers a superseded parse  **[critical]**

**Units:** `ai-parsing` worker (produces DTO, calls back per AD-13) and `exam` (sole writer of `questions`, AD-07/AD-05).

**Both obey the ADs:**
- AD-07: re-parse is allowed **only while Draft** and **replaces all** of the exam's questions atomically in one transaction. `exam` is the only writer.
- AD-13: the worker consumes → `markParsing()` → Gemini → `persistParsedQuestions()`; `parse_status` moves `pending|parsing|parsed|failed` through the `exam` interface only.
- FR-9: the teacher may **edit question content and set answers while Draft**.
- AD-14: exposes a **manual "retry parsing" action**.

**How they diverge:**
1. **Edit-vs-persist clobber.** Teacher triggers re-parse (`parse_status = pending`); the job queues. While it waits, the teacher (still in Draft, FR-9-legal) fixes a misread formula and clicks A/B/C/D on three `needs_confirmation` questions → `manually_confirmed`. The worker then runs `persistParsedQuestions`, which by AD-07 **replaces all questions** — wiping every manual edit and confirmation, and re-introducing `needs_confirmation` rows. Both units are compliant: AD-07 never says edits must be blocked while a parse is in flight, and `parse_status` is described as visibility, not a lock.
2. **Stale-generation clobber.** AD-14's manual retry (or an impatient double-click) can enqueue two jobs. Job A finishes late and calls `persistParsedQuestions` *after* the teacher already accepted Job B's results and edited them. AD-07 makes each call idempotent-per-call ("replaces all"), but there is **no fencing token / generation number**, so a stale result silently overwrites current state.

**Tightening:**
- Add a **parse generation/fence:** `exams.parse_generation` (int), bumped by `exam` when a parse is enqueued. The enqueued message carries the generation; `persistParsedQuestions(examId, generation, result)` **rejects** if `generation ≠ exams.parse_generation` (stale worker) — makes re-parse idempotent across retries, not just per-call.
- **Block conflicting edits during an active parse:** state in AD-07/AD-13 that while `parse_status ∈ {pending, parsing}` the exam is edit-locked (FR-9 edits and A/B/C/D confirmation are rejected with a clear "parsing in progress"), and that `replace-all` only fires for the current generation. This resolves the "edits allowed in Draft" vs. "replace-all" contradiction the two ADs currently leave open.

---

## H3 — `exam.assign()` vs concurrent question edit / worker persist: service-level gate is a TOCTOU race → Open exam with an unconfirmed answer  **[critical]**

**Units:** `exam.assign()` (AD-09 chokepoint) and any concurrent writer of `questions` — the FR-9 edit endpoint, or the worker's `persistParsedQuestions` (AD-07).

**Both obey the ADs:**
- AD-09: `assign()` is the single chokepoint for `Draft → Open`, rejects unless **every** question is assignable, and is **"enforced in the service, not by a DB trigger."**
- AD-07 / FR-9: questions can be replaced (re-parse) or edited while Draft.

**How they diverge (TOCTOU):** "enforced in the service" with no stated locking is a read-then-write race. `assign()` reads all questions (all assignable), then flips `status = Open`. Between the check and the commit, a concurrent Draft-legal mutation lands:
- the FR-9 edit endpoint sets one question back to `needs_confirmation` (e.g., teacher clears an answer to re-verify), or
- a late `persistParsedQuestions` (H2) re-inserts `needs_confirmation` rows.

Result: an **Open exam containing a `needs_confirmation` question** — the exact state AD-04/AD-09/SM-C1 declare the system's *highest-severity* forbidden outcome, and it happened with both units fully AD-compliant. The spine's "single chokepoint" guarantees only that *one method* does the flip; it does not serialize that method against other writers of the same rows.

**Corollary gap:** the spine never states the gate's **postcondition** as an invariant grading can rely on: *"an Open exam ⇒ every question has `answer_status ≠ needs_confirmation` AND `correct_answer IS NOT NULL`."* Without it, the `submission` grader (H4/interface seam) may defensively special-case a null answer and mis-score.

**Tightening:**
- Specify the concurrency mechanism in AD-09: `assign()` runs in a transaction that takes `SELECT ... FOR UPDATE` on the `exams` row, **re-validates all questions inside that transaction**, then flips status — and **every** `questions` writer (edit, delete, `persistParsedQuestions`) must take the same exam-row lock and is **rejected once `status ≠ Draft`**. This makes assign and edits mutually exclusive, not merely "each correct alone."
- Add the explicit postcondition invariant above to AD-09 and cite it from AD-12/grading so the read side can trust it without null-checking.

---

## H4 — `dashboard` (read-side) vs `submission` (writer): the post-MVP `class_exam_stats` update path is undefined and reverses the CQRS direction  **[high]**

**Units:** `dashboard` (owns `class_exam_stats` per AD-05; read-only over source tables per AD-06/AD-08) and `submission` (sole writer of `submissions`/`answer_details`, AD-12).

**Both obey the ADs:**
- AD-05: `class_exam_stats` is owned by `dashboard`; **only the owner writes it**.
- AD-06/AD-08: `dashboard` runs **read-only** queries over `submissions`/`answer_details`/`exams`/`questions` and **"writes nothing on MVP"**; swapping in `class_exam_stats` + Redis "must touch **only** `dashboard`."
- The dependency graph draws exactly one edge here: `dashboard ⇢ submission` (read-only). There is **no** `submission → dashboard` edge.

**How they diverge:** AD-08 claims the pre-aggregation is a **non-breaking** future change local to `dashboard`. But `class_exam_stats` must be *updated when a submission is written*. Who triggers that?
- `submission` can't write `class_exam_stats` (AD-05 single-writer = `dashboard`).
- `dashboard` is the read side and (per AD-06) writes nothing and has no reason to be invoked on the submission path.
- So the update requires **either** a new `submission → dashboard` call (a *write-causing* edge that reverses the CQRS read-only direction the whole model is built on and adds the acyclic-breaking dependency AD-03 exists to prevent) **or** a background job / queue consumer that is nowhere in the spine.

Thus AD-08's "non-breaking, touches only `dashboard`" is **unfounded**: landing the optimization forces a new cross-module trigger edge that does not exist today. Two builders diverge cleanly — the dashboard builder assumes a self-contained swap; the submission builder assumes it is never called for analytics.

**Secondary (read-consistency, low):** MVP computes "student avg vs. class avg" (FR-18) live from `submissions`. During a submission window two dashboards see different class averages (non-repeatable read across concurrent writers). Acceptable staleness, but the spine never states that dashboards are *eventually-consistent by design* — worth one sentence so it isn't read as a bug.

**Tightening:**
- In AD-08, name the update mechanism now (even though the table is deferred): a **background aggregation worker** (same worker process family as AD-18, or a scheduled job) is the writer-side of `class_exam_stats`, consuming a `submission.recorded` event off RabbitMQ. Add the edge to the dependency graph as `submission —event→ (queue) → dashboard-aggregator`, keeping HTTP-path CQRS read-only. Then "non-breaking" is true because the edge is designed in from day one.
- Add one line: "MVP dashboards are eventually consistent; a submission may not be reflected until its transaction commits — never partially."

---

## H5 — `auth`: "access token verified statelessly per request" vs "logout invalidates" (and stale role in token)  **[medium]**

**Units:** two `auth` builders reading AD-17 — one implements the access path, one implements logout/authorization.

**The contradiction is inside one AD:** AD-17 says both "**Access token is verified statelessly per request**" *and* "logout invalidates it," while "a longer-lived **refresh token is stored server-side hashed in Redis** … only the `/refresh` endpoint touches the store." The Consistency-Conventions row repeats only "JWT verified per request." These can't both hold as written:
- If protected routes verify the access token **statelessly** (no store lookup), then **logout cannot invalidate the access token** — it stays valid until expiry. Logout only kills the *refresh* token. A logged-out user (or a student whose content should vanish when an exam closes, NFR-03) keeps access for the full access-token TTL.
- Making logout actually effective requires a **denylist checked on every request** — which *breaks* the "stateless per request" claim and re-introduces the store lookup AD-17 says only `/refresh` performs.

The spine also never states the **access-token TTL**, so the size of the post-logout window is undefined. And because `role` is a token claim (AD-17 minimal claims), an admin changing a user's role leaves a **stale role** in circulation until the next refresh — undefined against FR-2.

**Tightening:** Pick one and write it:
- **Recommended:** short access-token TTL (e.g., 10–15 min) + refresh rotation; state explicitly "**logout revokes the refresh token only; the access token remains valid until its (short) TTL — there is no per-request denylist.**" Then "stateless per request" is true and the exposure is bounded and named. Add: role/authorization changes take effect at next refresh (≤ TTL).
- If stronger revocation is required (immediate logout / instant role change), say so and accept a per-request Redis denylist check — but then delete the "stateless per request" wording, since it would be false.

---

## H6 — `exam` (HTTP) vs `ai-parsing` worker: two writers of the local file volume with no path/ownership rule → collisions on re-parse  **[medium]**

**Units:** `exam` HTTP (writes the source PDF on upload, AD-13) and the `ai-parsing` worker (writes cropped figure images, AD-15/FR-8). The container diagram draws **both** `api → vol` and `worker → vol`.

**Both obey the ADs:**
- AD-13: the controller "stores the file."
- AD-15: source PDF and cropped figures live on a **local Docker volume**; `source_file_url` / `image_url` stay a **URL abstraction** so a swap to S3/MinIO touches only the adapter.
- AD-05 governs single-writer ownership **of database tables** — and is *silent on the file volume*.

**How they diverge:** AD-05 solved exactly this problem ("two modules writing one thing quietly kills the split") for tables, but the file volume has **two writers and no ownership/namespace rule at all**. Consequences, all AD-compliant:
- **Re-parse orphans/overwrites figures.** AD-07 `replace-all` regenerates questions; the worker writes new figure images. With no defined path scheme, new crops either overwrite paths still referenced by the (about-to-be-replaced) `image_url`s or orphan the old files. A teacher viewing the review screen mid-re-parse sees images swap under them, or 404.
- **Concurrent parse jobs (H2 double-retry) write the same figure paths** → interleaved/torn image files.
- **`image_url` flip is not atomic with the file write:** the DB row (owned by `exam`) and the file (written by `worker`) are updated by different processes with no ordering rule — a URL can point at a half-written or not-yet-written file.

**Tightening (extend AD-05 to blobs — the cleanest fix):**
- Add a rule: the file volume is namespaced and single-writer-per-prefix. Define the scheme, e.g. `exams/{examId}/source.pdf` written **only** by `exam`; figures under a **generation prefix** `exams/{examId}/figures/{parse_generation}/{questionId}.png` written **only** by the worker (ties to H2's generation fence).
- Require **write-temp-then-rename** for atomic publish, and require that `image_url` is set by `persistParsedQuestions` (in `exam`) **after** the worker has finished writing the generation's files — so the URL never precedes the bytes. Old generation prefixes are GC'd after the flip.
- One sentence in AD-15 stating the volume is subject to the same single-writer/namespace discipline as AD-05 tables.

---

## Cross-cutting note — the missing interface: `submission → exam` grading read

The graph shows `submission → exam` ("read exam, questions, status, due_date") and AD-06 mandates cross-module access via the owner's **service interface**, but that interface is never named. Grading (FR-16) needs `correct_answer` per question at submit time. Two risks already covered above converge here: (a) without H3's explicit postcondition invariant, the grader can't assume `correct_answer` is non-null on an Open exam; (b) the read must reflect a *stable* snapshot (H1) — if questions could change after Open there'd be a snapshot problem, but AD-09's Draft-only edit rule already prevents that *provided* H3's lock closes the assign race. **Tightening:** name the method (e.g., `exam.getGradingSheet(examId): { questionId, correctAnswer }[]`), and state that it is only callable for `status ∈ {Open, Closed}` and returns non-null answers by the H3 postcondition.

---

## Summary table

| # | Seam | Severity | One-line tightening |
| --- | --- | --- | --- |
| H1 | submission ↔ exam: Close/cutoff mid-attempt | **critical** | Add `attempt` entity + snapshot `deadline_at`; a running attempt is never invalidated by a later Close/due-date flip. |
| H2 | ai-parsing worker ↔ exam: replace-all clobber / stale result | **critical** | Add `parse_generation` fence + edit-lock while `parse_status ∈ {pending,parsing}`. |
| H3 | assign() ↔ concurrent edit/persist: TOCTOU | **critical** | `assign()` locks the exam row and re-validates in-txn; all question writers take that lock and are rejected once `status ≠ Draft`; state the Open⇒no-`needs_confirmation`/non-null-answer postcondition. |
| H4 | dashboard ↔ submission: class_exam_stats trigger undefined | **high** | Add a `submission.recorded` event → aggregation worker as the sole `class_exam_stats` writer; draw the edge now so AD-08 is truly non-breaking. |
| H5 | auth: stateless access vs "logout invalidates" | **medium** | Short access-TTL + refresh rotation; logout revokes refresh only, no per-request denylist — or delete the "stateless" claim. |
| H6 | exam ↔ worker: two writers of the file volume | **medium** | Extend AD-05 to blobs: per-prefix single writer, generation-namespaced figure paths, write-temp-rename, URL set after bytes land. |
