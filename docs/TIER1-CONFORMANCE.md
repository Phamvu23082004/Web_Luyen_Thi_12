# Tier 1 Conformance — X-Tek Skeleton

Per-project alignment tracker for the XT-ESS Tier-1 Company Standards. Source checklist: [00-Conformance-Checklist](technical_architecture_guidelines/coding-standard/index.md). Mirror MUST deviations in [`PROJECT-STANDARDS.md §13`](PROJECT-STANDARDS.md#13-tier-1-deviations).

**Status legend:** `[x]` met · `[ ]` not yet · `[~]` planned (filled per stack) · `[-]` N/A.

> **This is the stack-agnostic skeleton snapshot.** Only the **structure + embedded process** items are met here. Everything that depends on a tech stack or runtime (CI, branch policy, tests, SonarQube, security middleware, docker) is `[~]` — it gets wired when a stack is pulled from **Wiki Tier 2** and the project is set up.

```
Met at skeleton level: project structure + embedded Tier 1 process + BMad scaffolding
Wired per stack:       git policy, commit enforcement, CI/CD, security runtime, quality gates, dev environment
Last reviewed: 2026-06-26 (skeleton)
```

---

| # | Requirement (abridged) | Sev | Status | Evidence / Note |
|---|------------------------|-----|--------|-----------------|
| 01 | Git workflow + branch naming documented | MUST | [~] | Branch policy set on Azure Repos per project; convention in Tier 1 doc 01 |
| 02 | Conventional Commits + enforcement | MUST | [~] | Documented (doc 02); commitlint/husky added with the stack |
| 03 | Code review process | MUST | [~] | Doc 03 present; reviewer policy set per project |
| 04 | CI: install→lint→typecheck→test, lockfile, merge-block | MUST | [~] | Pipeline added with the stack from Tier 2 |
| 05 | Security baseline (input validation, secrets, headers) | MUST | [~] | Doc 05 present; runtime controls wired in stack code |
| 06 | Dev environment: README, `.env.example`, one-command install | MUST | [~] | README skeleton present; `.env.example` + compose added with the stack |
| 07 | `project-context.md` present (AI rules) | MUST | [x] | Placeholder present at root; replaced from Tier 2 per stack |
| 08 | Quality gates, must-have tests, SonarQube coverage | MUST | [~] | Doc 08 present; gates wired with the stack |
| 09 | Project structure: PROJECT-STANDARDS + thin CLAUDE + README + BMad scaffolding | MUST | [x] | `docs/PROJECT-STANDARDS.md` (template), `CLAUDE.md`, `README.md`, `.claude/` + `_bmad/` + `_bmad-output/` present |
| 09 | Embedded company process (Tier 1 01–10) | MUST | [x] | `docs/technical_architecture_guidelines/coding-standard/` |
| 10 | Tier 1 deviations documented — no silent exceptions | MUST | [x] | `PROJECT-STANDARDS.md §13` (embedded-standards deviation) |
