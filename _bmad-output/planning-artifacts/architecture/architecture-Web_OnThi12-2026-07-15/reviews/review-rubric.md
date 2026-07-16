# Spine Review — Good-Spine Checklist

**Target:** `_bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md`
**Reviewer role:** rubric reviewer (read-only). No edits made to the spine.
**Date:** 2026-07-15
**Verdict:** **Adequate** (strong bones, two real gaps that should be fixed before build: a deprecated AI SDK and an MVP capability — rate limiting — with no home).

---

## Verdict rationale

This is a well-built spine. The correctness backbone (AD-09 assignment gate, AD-12 atomic+idempotent submission, AD-04→AD-09 no-AI-guess), the module-split discipline (AD-05 single-writer, AD-06 interface-only + read-side carve-out, dependency DAG), and the trust boundary (AD-10, AD-17) are all enforceable and map cleanly onto the PRD's highest-risk requirements. Status vocabularies are pinned as literal string sets, which is exactly what stops independently-built modules from diverging. It is not "strong" only because two findings below are load-bearing for the build (deprecated SDK, missing rate-limit home) and a few cross-unit contracts (confidence threshold, score scale) and the ops envelope are under-decided.

---

## Checklist 1 — Does it fix the real divergence points for the level below (independently-built modules), and miss none?

**Mostly yes.** The classic monolith-to-modules divergence points are all pinned:

- Table ownership — AD-05 (one owning module per table, explicit assignment list).
- Cross-module calls — AD-06 (service interface only, one documented read-side exception).
- API envelope / errors / pagination — AD-16.
- Auth token shape and role source — AD-17, AD-10.
- Validation boundary — AD-10 + Consistency table.
- Dependency direction — the mermaid DAG (acyclic, `auth` cross-cutting).
- Status/en/ value vocabularies — **pinned as literal sets**: `status` (Draft|Open|Closed), `parse_status` (pending|parsing|parsed|failed), `answer_status` (ai_extracted|needs_confirmation|manually_confirmed), `role` (student|teacher). This is the single best divergence-prevention move in the doc.
- Blob URL abstraction — AD-15.

**Missed / under-specified divergence points:**

1. **Score representation and scale is undefined.** `submissions.score` is written by `submission` (AD-12/FR-16) and read by `dashboard` (FR-18–22), the results view (FR-17), and charts (Recharts). Nothing pins the scale — 0–10 (Vietnamese convention), 0–100, or raw correct-count. This is a genuine cross-unit contract between the write side and every read surface; if two units assume different scales, averages and distributions silently corrupt. **[medium]**

2. **The "low-confidence" flag boundary is undefined.** The assignment gate (AD-09) and the yellow FR-6 border both depend on which questions count as "flagged," which derives from an `ai_confidence` threshold that is never stated or given an owning location. The exam-service gate and the frontend rendering can diverge (backend allows assign while FE still shows yellow, or vice versa). **[medium]**

3. **No testing-infra convention.** PROJECT-STANDARDS §7 defines must-have test areas (grading/idempotency, role access, assignment blocking) and a Docker test-DB + factories. The spine is silent on any shared test contract. For independently-built modules this is a minor divergence surface. **[low]**

---

## Checklist 2 — Is every AD's Rule actually enforceable, and does it prevent its stated divergence?

Reviewed all 14 ADs (AD-05…AD-18). Enforceability is good; most are code-review-enforced conventions, with the two highest-risk ones backed by hard mechanisms:

- **AD-12** — idempotency by DB **unique constraint** on `(student_id, exam_id)` + single transaction: hard-enforced, prevents duplicate/partial writes. Strong.
- **AD-09** — single `exam.assign()` chokepoint, service-enforced state machine, no reopen: enforceable and prevents the stated highest-severity divergence (live exam with unconfirmed answer). One soft spot: the gate condition `reviewed_at set OR never-flagged` relies on the undefined "flagged" boundary (see Checklist 1 #2), and `reviewed_at` appears overloaded to mean both low-confidence acknowledgement (FR-6) and figure-crop confirmation (FR-8) — workable but the overload is implicit.
- **AD-05 / AD-06** — convention-enforced (no DB-level guard). Acceptable for a monolith, but note AD-06's read-side exception (dashboard querying `submissions`/`answer_details`/`questions`/`exams` directly) deliberately couples `dashboard` to other modules' physical schemas. That is legitimate CQRS, but it is the one place where a schema change in `submission`/`exam` can silently break `dashboard`; the "adding cache touches only dashboard" guarantee (AD-08) does not protect against upstream table changes. Worth an explicit note that the read side tracks source-table schema. **[low]**
- **AD-14 / AD-13 / AD-18** — reliability + async contract are concrete and enforceable (bounded retry, circuit open, status columns on `exams`, separate worker process).
- **AD-17** — minimal-claim JWT + Redis-hashed refresh token: enforceable and prevents role-spoof / stale-auth divergence.

No AD has an unenforceable rule that fails to prevent its stated divergence.

---

## Checklist 3 — Could anything under Deferred let two units diverge?

Deferred items are mostly well-guarded (each names the invariant that keeps the deferral non-breaking): cache/`class_exam_stats` behind AD-08, object storage behind AD-15, batch-Gemini behind the async contract, service-split behind clean boundaries. Those are safe.

Two soft spots:

- **Password-reset email provider (FR-3) is left *open*, not merely deferred** ("SMTP/provider choice open; a stub is acceptable"). Low risk because a stub satisfies the evaluation, but it is the one FR whose realization is genuinely undecided. **[low]**
- **At-risk heuristic (FR-21) is deferred to "a simple heuristic" with no definition** (what counts as declining / long-inactive / how severity orders). Because it lives in a single module (`dashboard`) it is an under-specification rather than a cross-unit divergence, so low impact — but a downstream story author has nothing to build against. **[low]**
- **Per-service `/health` is deferred** with observability. Fine now; if the service-split deferral is later taken, health-check convention will need defining then.

No deferred item can currently let two *independently-built* units diverge in a breaking way.

---

## Checklist 4 — Is named tech verified-current (versions pinned)?

Most of the stack is pinned and current for mid-2026: NestJS 11.x, Prisma 7.x (rust-free), PostgreSQL 18.x, RabbitMQ 4.x, React 19.x, Vite 7.x, Tailwind 4.x, TanStack Query 5.x, Node 24.x LTS — all plausible-current.

**Findings:**

1. **`@google/generative-ai` is deprecated / end-of-life.** Google replaced the legacy `@google/generative-ai` package with the unified **`@google/genai`** SDK; support for the old package wound down in 2025. A greenfield 2026 build should not adopt the deprecated SDK. This flows through from `TechStack.md`, but the spine is where the version contract is set, so it should correct it. This is the sharpest Checklist-4 miss. **[high]**

2. **Redis pinned at 7.x while 8.x is GA** (Redis 8.0 shipped May 2025 and returned to an OSI-approved license). A fresh project would pick 8.x; 7.x trails current. **[low]**

3. **Several rows say "current" instead of a pinned version** — Recharts, `@google/generative-ai`/Gemini, Nginx, Docker Compose, GitHub Actions. The checklist wants versions pinned; "current" defers the pin to code, which the header explicitly allows ("the code owns this once it exists"), so this is minor but worth tightening for at least Recharts and the AI SDK. **[low]**

---

## Checklist 5 — Does it cover the driving spec's capabilities (all 26 FRs, all 11 NFRs)? Any FR/NFR with no home?

**FRs:** All 26 have a home via the Capability → Architecture Map (FR-1–3 auth; FR-4/9–12 exam; FR-5/8 parsing; FR-6/7 gating; FR-13–17 submission; FR-18–23 dashboard; FR-24–26 class; cross-cutting in `common/`). No orphan FR.

**NFRs — one MVP gap and a few implicit-only mappings:**

1. **NFR-09 rate limiting has no home — and it is MVP.** PRD §6.1 ("Rate limiting on login and AI-Parsing calls — SRS §9.6 recommends doing this *with* the MVP") and SRS §9.6 both place rate limiting in the MVP. The spine names Redis and mentions quota, but **no AD or Consistency rule governs rate limiting** on the login or parse-enqueue endpoints. An MVP capability with no invariant is a real gap (also a Checklist-1 miss, since rate-limit placement is a cross-cutting decision multiple controllers must share). **[high]**

2. **NFR-05 (availability) has no strategy** — no home beyond the implicit "it's a monolith on a VPS." Soft NFR, but see Checklist 6 (ops envelope). **[low]**

3. **NFR-03 password hashing is only implicit.** AD-17 covers JWT/refresh-token hashing and reset tokens but never states the password-at-rest hashing rule (bcrypt/argon2). The Consistency "Secrets" row omits it too. NFR-03's other half (content visible only while Open) is covered by AD-09/AD-11. **[low]**

4. **NFR-10 (no student PII to Gemini) is implicit.** AD-13/AD-14 describe the parse contract but never state "only page images, no PII." Naturally low-exposure (parsing precedes student data), but not an explicit rule. **[low]**

NFR-01→AD-12, NFR-02→AD-08, NFR-04→AD-12, NFR-06→paradigm+Deferred, NFR-07→UI conventions, NFR-08→AD-18, NFR-11→AD-14 are all cleanly homed.

---

## Checklist 6 — Is every dimension the initiative altitude owns decided/deferred/open — especially the operational/environmental envelope?

**Partially. The operational/environmental dimension is the weakest-covered.**

Decided/present: deployment topology (container/deployment mermaid: Nginx → api/worker → PG/Redis/RabbitMQ, local file volume), 12-factor config with `.env.example`, secrets backend-only, source-tree scaffold with `docker-compose.yml`.

**Silent or under-decided (this is the dimension-level finding):**

- **CI/CD process** — GitHub Actions is named in the Stack table but no rule governs the pipeline: test gates, what blocks a merge, deploy trigger. PROJECT-STANDARDS §10 says "auto-deploy on push to main"; the spine doesn't carry that as a decision or a deferral.
- **Environments** — Local/Production (staging optional) per PROJECT-STANDARDS §10 is never stated in the spine; environment promotion is silent.
- **Production migration discipline & rollback** — Prisma migrations are mentioned structurally, but the "reversible migrations, back up before prod migrate, rollback by image tag" decision (PROJECT-STANDARDS §10) has no home here.
- **Backup / data durability** and **availability posture** (NFR-05) — not addressed.

None of these need heavy design at initiative altitude, but a whole dimension left implicit is a finding: add a short "Ops / delivery" decision block (CI gates, deploy trigger, migration+rollback discipline, backup) or explicitly defer each. **[medium]**

Observability (`/health`, Prometheus/Grafana) *is* correctly handled under Deferred.

---

## Checklist 7 — Are the two inherited-invariant relationships (AD-01..04) respected without contradiction?

**Yes — no contradictions found.** The Inherited Invariants table cites AD-01..04 read-only and maps each to realizing ADs:

- **AD-01** (PDF-only creation) — upheld by FR-4 "no path without upload" + AD-13 (controller receives PDF → Draft). Consistent.
- **AD-02** (async queue) — realized by AD-13/AD-14/AD-18. The known SRS §9.2-vs-core-stack tension (queue listed post-MVP in SRS, core in project-context) is resolved correctly: async parsing is MVP, and only *batching/fan-out* is deferred (matching addendum §B). No contradiction.
- **AD-03** (CQRS write/read split) — realized by AD-12 (write) and AD-08 (read). The AD-06 read-side direct-query exception is consistent with, not contradictory to, AD-03 (it *is* the CQRS read side) — see Checklist 2 for the coupling caveat.
- **AD-04** (AI never infers answers) — realized by AD-09 gate + AD-05 write ownership; reinforced by SM-C1. Consistent.

The four inherited ADs are cited by original ID, never re-decided, and nothing downstream contradicts them.

---

## Findings summary (by severity)

| # | Sev | Finding | Fix |
|---|-----|---------|-----|
| 1 | **high** | `@google/generative-ai` (Stack) is a deprecated/EOL SDK; Google's supported package is `@google/genai`. | Repin the AI SDK to `@google/genai`; update TechStack.md reference at build time. |
| 2 | **high** | Rate limiting (login + AI-parsing) is MVP per PRD §6.1 / SRS §9.6 but has no AD or rule — an MVP NFR-09 capability with no home. | Add an AD: Redis-backed rate limit on auth + parse-enqueue endpoints, cross-cutting in `common/`. |
| 3 | **medium** | Two cross-unit contracts unpinned: `submissions.score` scale/representation, and the `ai_confidence` low-confidence threshold that drives both the AD-09 gate and the FR-6 flag. | Pin the score scale (e.g., 0–10) and pin the confidence threshold's owning location as invariants. |
| 4 | **medium** | Operational/environmental envelope largely silent — CI/CD gates, environments/promotion, prod migration + rollback discipline, backup, availability. | Add a short Ops/delivery decision block or explicitly defer each item. |
| 5 | **low** | Redis pinned 7.x (8.x is GA); several rows "current" not pinned; NFR-03 password hashing and NFR-10 no-PII-to-Gemini only implicit; AD-06 read-side couples dashboard to upstream table schemas; FR-3 email provider and FR-21 at-risk heuristic left open/undefined. | Bump Redis to 8.x; add an explicit password-hash + PII rule; note read-side tracks source schema; define/defer the heuristic. |
