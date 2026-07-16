# PRD Quality Review — OnThi12

## Overall verdict
A strong, decision-ready PRD that faithfully distills SRS v1.1 into a capability-first shape with clean downstream traceability (contiguous FR/UJ/SM/NFR IDs, a Glossary that holds, an FR↔SRS map in the addendum). The thesis — remove the teacher's data-entry burden with AI while making correctness the non-negotiable spine — is coherent and drives features, metrics, and counter-metrics. Two real gaps to close before "final": a dropped student-dashboard metric (study streak) and several intentionally-TBD quantitative targets that are logged as open questions rather than hidden.

## Decision-readiness — strong
Trade-offs are named with what's given up, not smoothed to neutral. The MVP-vs-post-MVP queue tension is surfaced explicitly (§6.1 + addendum §B) rather than papered over; counter-metrics SM-C1/C2/C3 encode real "do not optimize" decisions (don't trade answer-confirmation for speed; don't trade submission integrity for dashboard freshness; don't pre-optimize before §9.7 triggers). Open Questions are genuinely open, not rhetorical.

### Findings
- **low** Open-items density (§8 + §9) — 6 Open Questions + 6 indexed assumptions for a PRD about to feed architecture is moderate but acceptable at capstone stakes; none are phase-blockers. *Fix:* none required; confirm OQ1 (admin provisioning) and OQ4 (answer-key format) before the exam-creation epic is written.

## Substance over theater — strong
No persona theater: two grounded personas (Minh, Cô Lan) carry four journeys — under the four-persona ceiling, each driving real FRs. NFRs are product-specific with thresholds (≥40 submits/5 min, dashboard <2s, evening 19–22h availability), not boilerplate. Vision is OnThi12-specific and would not swap into another PRD. The "builder" JTBD (§2.1) is unusual but honest — this is a capstone whose success genuinely includes demonstrating system-design technique, and SM-5 makes that measurable rather than decorative.

## Strategic coherence — strong
Clear thesis with a stated bet (AI removes the retyping barrier; correctness discipline prevents the one-wrong-answer-corrupts-the-class failure). Feature order follows the thesis (the whole EXAM-01→09 chain is treated as one seamless flow per SRS §8, not scattered). Success Metrics validate the thesis (SM-2 AI quality, SM-3 effort saved) rather than measuring raw activity. MVP scope kind is coherently "problem-solving + platform-learning."

## Done-ness clarity — strong
Every FR carries at least one testable consequence; adjectives-as-requirements are rare. Standouts: FR-16 (atomic, idempotent, server-side scoring — all testable), FR-7 (red flag, block-assign, no auto-fill — all testable). Softest spot is FR-21's "at-risk by severity heuristic," but it's honestly tagged as a v1 heuristic assumption rather than dressed up as precise.

### Findings
- **low** FR-21 (§4.5) at-risk severity heuristic is unspecified — acceptable for v1 but the ordering rule isn't testable as written. *Fix:* leave as assumption; pin the concrete heuristic (e.g. "≥2 consecutive score drops OR >N days inactive") when the teacher-dashboard epic is written.

## Scope honesty — strong
Non-Goals section does real work (no manual authoring, no AI-guessed answers, no essay grading, no admin console in v1.1) and prevents downstream scope creep. Assumptions are tagged inline and round-trip cleanly to §9. De-scoping (post-MVP cache, service split, replicas) is proposed explicitly with SRS §9.7 triggers, never done silently.

## Downstream usability — strong (this is a chain-top PRD — weighted heavily)
Glossary present and used consistently; domain nouns (Answer Status, Source File, Assign, Submission) appear identically across FRs/UJs/SMs. FR-1…26, UJ-1…4, SM-1…5 + SM-C1…C3, NFR-01…11 are contiguous and unique. Cross-references resolve (SM validates FR-X; UJ referenced inline; addendum carries the FR↔SRS + UJ↔FR maps). UX and architecture workflows can source-extract cleanly.

### Findings
- **medium** Study-streak metric dropped (§4.4 FR-18) — SRS §5.1 lists "chuỗi ngày ôn tập" (study streak) as one of the four student-home cards, but FR-18 (from DASH-01) omits it. Because DASH-01's own text also omits it and it only appears in the UI mockup, the FR structure silently lost it. *Fix:* either add a study-streak consequence to FR-18 or add an explicit `[NON-GOAL for MVP]` note if it's intentionally cut. (Surfaced to user at triage.)

## Shape fit — strong
Two-role product with meaningful UX → named-protagonist UJs are load-bearing and present; not over-formalized (no UJ bloat for trivial flows). Cross-cutting NFRs live in their own section; feature-specific NFRs nest where they belong (FR-5). Information Architecture is included because two role-scoped surfaces feed UX — appropriate, not furniture.

## Mechanical notes
- **Glossary drift:** none material. "Assign/Assigned/Assignment" all trace to the Glossary "Assign" entry; Answer Status enum values used verbatim.
- **ID continuity:** FR 1–26 contiguous, no gaps/dupes; UJ 1–4; SM 1–5 + C1–C3; NFR 01–11. Clean.
- **Assumptions Index roundtrip:** all inline `[ASSUMPTION]` tags appear in §9 (SM-2/SM-3 collapsed to one index line — acceptable). No orphan index entries.
- **UJ protagonists:** each UJ has a named protagonist (Cô Lan ×2, Minh ×2) carrying context inline. No floating UJs.
- **Required sections:** all Essential Spine sections present; Adapt-In clusters (NFRs, Constraints, Risks, Integration, Platform, IA) justified by product concerns.
