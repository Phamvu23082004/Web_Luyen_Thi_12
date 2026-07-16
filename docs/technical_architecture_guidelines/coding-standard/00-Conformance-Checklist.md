# 00 — Tier 1 Conformance Checklist (Master Template)

## Purpose

Tier 1 defines the **principles and defaults**; this checklist makes a project's **alignment to them verifiable** — "which standards are met, which aren't yet, and which deliberately don't apply." It is the per-project adoption tracker that complements (does not replace) the recurring per-PR/per-release gates in [08 — Quality Gates](08-Quality-Gates).

The ten sections below map **1:1 to Tier 1 docs 01–10**. When a Tier 1 doc changes, exactly one section here changes.

## How to use

1. **Copy this file** into the project repo as `docs/TIER1-CONFORMANCE.md` (it is a per-project filled-in file, like `docs/PROJECT-STANDARDS.md` — see [09 — Project Structure](09-Project-Structure)).
2. Fill the **Status** and **Evidence** columns. Evidence should be a concrete pointer (a pipeline stage, a file, a `PROJECT-STANDARDS.md` section) — **a bare tick with no evidence is what rots; don't do it.**
3. Record every **🚫 N/A** with a one-line reason, and mirror MUST deviations in `PROJECT-STANDARDS.md` **§13 — Tier 1 Deviations** ("no silent exceptions", per [10 — Continuous Improvement](10-Continuous-Improvement)).
4. **When to revisit:** at project kickoff (initial alignment), and at each release (drift check). Keep it lightweight — this is an alignment snapshot, not an audit form.

## Legends

**Severity**
- **MUST** — mandatory. A gap is either fixed or justified as a documented deviation in `PROJECT-STANDARDS.md` §13.
- **SHOULD** — strongly recommended. If not done, note why in Evidence.

**Status** — `[x]` met · `[ ]` not yet · `[~]` planned (with target) · `[-]` N/A (with reason). Master template ships all `[ ]` (unfilled).

> Note: these render as literal text in table cells (GitHub / Azure DevOps wiki do not make task-list checkboxes interactive inside tables) — they're an editable, grep-able status convention, not click-to-toggle boxes.

---

## 01 — Git Workflow & Branching  ·  Source: [01](01-Git-Workflow)

| # | Requirement | Severity | Status | Evidence / Notes |
|---|-------------|----------|--------|------------------|
| 1.1 | Trunk-based with feature branches; **no direct commits to the primary branch** — all changes via PR | MUST | [ ] | _branch policy_ |
| 1.2 | Branch naming `{type}/{ticket-id}-{short-desc}` (`feature/`, `fix/`, `hotfix/`, `release/`) | MUST | [ ] | _sample branch names_ |
| 1.3 | Merge strategy decided + documented in Tier 2 (default: squash for features) | MUST | [ ] | _PROJECT-STANDARDS §4_ |
| 1.4 | `develop`-branch use (yes/no) decided + documented in Tier 2 | MUST | [ ] | _PROJECT-STANDARDS §4_ |
| 1.5 | Feature branches short-lived (merge within ~1–3 days); branches deleted after merge | SHOULD | [ ] | |
| 1.6 | One concern per branch; rebase before merge for linear history | SHOULD | [ ] | |

## 02 — Commit Conventions  ·  Source: [02](02-Commit-Conventions)

| # | Requirement | Severity | Status | Evidence / Notes |
|---|-------------|----------|--------|------------------|
| 2.1 | Conventional Commits format `type(scope): subject` | MUST | [ ] | _recent log_ |
| 2.2 | Subject: imperative, lowercase, no trailing period, ≤72 chars | MUST | [ ] | |
| 2.3 | AI-generated commit messages reviewed by the human before accepting | MUST | [ ] | |
| 2.4 | Enforcement mechanism (commitlint hook and/or CI check) chosen + documented in Tier 2 | SHOULD | [ ] | _hook / CI config_ |
| 2.5 | One logical change per commit (no "and" subjects) | SHOULD | [ ] | |

## 03 — Code Review  ·  Source: [03](03-Code-Review)

| # | Requirement | Severity | Status | Evidence / Notes |
|---|-------------|----------|--------|------------------|
| 3.1 | Review requirement set by team size (≥1 peer for 2–3 devs; solo = self + BMad on critical modules) + documented in Tier 2 | MUST | [ ] | _PROJECT-STANDARDS / branch policy_ |
| 3.2 | PR passes CI (lint, typecheck, tests) **before** review | MUST | [ ] | |
| 3.3 | PR description explains **what and why** | MUST | [ ] | |
| 3.4 | Comments categorized (`[blocking]`/`[suggestion]`/`[question]`/`[nit]`); only blocking prevents merge; all blocking resolved before merge | MUST | [ ] | |
| 3.5 | Security-sensitive changes get a security-focused review (see §05 triggers) | MUST | [ ] | |
| 3.6 | PRs kept to ≤ ~400 lines of meaningful change (split otherwise); review turnaround ≤ 4 business hrs (max 1 day) | SHOULD | [ ] | |
| 3.7 | AI review (PR Toolkit / BMad) used pre-PR and at critical-module gates | SHOULD | [ ] | |

## 04 — CI/CD  ·  Source: [04](04-CICD-Standards)

| # | Requirement | Severity | Status | Evidence / Notes |
|---|-------------|----------|--------|------------------|
| 4.1 | Pipeline runs **Install → Lint → Typecheck/Compile → Test** on every push/PR | MUST | [ ] | _pipeline file_ |
| 4.2 | Dependencies installed **from a lockfile** (`--frozen-lockfile`/`npm ci`/`--locked-mode`/pinned) | MUST | [ ] | |
| 4.3 | Merge **blocked** on lint, type/compile, and must-have test failures | MUST | [ ] | _branch policy_ |
| 4.4 | Deployment automated + reproducible; **rollback procedure documented** (CD) | MUST | [ ] | _PROJECT-STANDARDS §10_ |
| 4.5 | Secrets via CI secrets / secret manager — **never committed**; `.env.example` template present | MUST | [ ] | |
| 4.6 | Tests deterministic — no flaky tests tolerated | MUST | [ ] | |
| 4.7 | Pipeline < ~8 min; fail-fast ordering + parallel where possible | SHOULD | [ ] | _avg run time_ |
| 4.8 | Build stage runs on main (optional on PRs) | SHOULD | [ ] | |

## 05 — Security Baseline  ·  Source: [05](05-Security-Baseline)

| # | Requirement | Severity | Status | Evidence / Notes |
|---|-------------|----------|--------|------------------|
| 5.1 | Parameterized queries via ORM/prepared statements — no queries built from raw user-input strings | MUST | [ ] | |
| 5.2 | Passwords hashed with bcrypt/argon2/scrypt/PBKDF2 (never MD5/SHA-1/plain SHA-256) | MUST | [ ] | |
| 5.3 | Default-deny authorization; RBAC enforced at middleware/interceptor level, not scattered in business logic | MUST | [ ] | |
| 5.4 | Secrets never in source; secret files gitignored; **different DB credentials per environment** | MUST | [ ] | |
| 5.5 | HTTPS/TLS everywhere (incl. internal services) | MUST | [ ] | |
| 5.6 | All external input validated at the boundary with schemas/typed validators | MUST | [ ] | |
| 5.7 | Web security headers set (HSTS, X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy) | MUST | [ ] | _middleware / proxy config_ |
| 5.8 | No wildcard CORS with credentials; origins whitelisted | MUST | [ ] | |
| 5.9 | Rate limiting on public APIs (global + stricter on auth endpoints) | MUST | [ ] | |
| 5.10 | Dependency audit scans run (≥ monthly / in CI); critical & high fixed within 1 week | MUST | [ ] | _audit step_ |
| 5.11 | Security events logged (login, failed auth, permission denied); secrets/PII never logged | MUST | [ ] | |

## 06 — Development Environment  ·  Source: [06](06-Dev-Environment)

| # | Requirement | Severity | Status | Evidence / Notes |
|---|-------------|----------|--------|------------------|
| 6.1 | Documented setup flow in README/CONTRIBUTING; fresh clone → running with **no manual intervention** beyond documented steps | MUST | [ ] | _README quick-start_ |
| 6.2 | `.env.example` (config template) committed with comments + safe defaults; real `.env` gitignored | MUST | [ ] | |
| 6.3 | One-command dependency install | MUST | [ ] | |
| 6.4 | Config parsed into a **typed/validated** object at startup; fail-fast on missing required vars | MUST | [ ] | |
| 6.5 | `docker-compose.yml` (if external services) has explicit `name:`, health checks, named volumes | MUST | [ ] | |
| 6.6 | DB standard commands exist (migrate / seed / reset / GUI); seeds idempotent | MUST | [ ] | |
| 6.7 | Zero-to-running < 30 min; unique ports per project documented in `.env.example` | SHOULD | [ ] | |

## 07 — AI-Assisted Development  ·  Source: [07](07-AI-Assisted-Development) · [07a](07a-Workflow-Quick-Reference)

| # | Requirement | Severity | Status | Evidence / Notes |
|---|-------------|----------|--------|------------------|
| 7.1 | `project-context.md` present (BMad-native AI implementation rules) | MUST | [ ] | _repo root_ |
| 7.2 | AI-generated code reviewed + tested to the **same** standard as hand-written code | MUST | [ ] | |
| 7.3 | Human defines what to test; human verifies AI-written test assertions (no "code tests that code does what code does") | MUST | [ ] | |
| 7.4 | New products follow the 6-phase BMad workflow (use 07a quick-reference) | SHOULD | [ ] | _bmad-output artifacts_ |
| 7.5 | Critical modules (auth, state machine, calculations) get BMad adversarial + edge-case review at gates | SHOULD | [ ] | _review reports_ |

## 08 — Quality Gates & Coverage  ·  Source: [08](08-Quality-Gates)

| # | Requirement | Severity | Status | Evidence / Notes |
|---|-------------|----------|--------|------------------|
| 8.1 | Definition of Done (Task / Sprint / Release) applied | MUST | [ ] | |
| 8.2 | Pre-PR self-check (lint + typecheck + test) performed | MUST | [ ] | |
| 8.3 | Must-have test areas defined in Tier 2 **and** covered (business logic, authn/authz, data integrity) | MUST | [ ] | _PROJECT-STANDARDS §7_ |
| 8.4 | **SonarQube scan wired with coverage import — dashboard is NOT 0%**: report generated before the scan, `sonar.<lang>.*.reportPaths` set, key/host/token not committed | MUST | [ ] | _sonar-project.properties + coverage step_ |
| 8.5 | Release DoD met: integration tests pass, migration tested on staging data, **rollback verified**, release notes written | MUST | [ ] | |
| 8.6 | Monorepo coverage paths verified resolving (non-zero coverage confirmed empirically after first scan) | SHOULD | [ ] | _path-fix step_ |
| 8.7 | Project's SonarQube quality-gate posture chosen (company default vs stricter) + recorded in Tier 2 | SHOULD | [ ] | _PROJECT-STANDARDS §7_ |

## 09 — Project Structure  ·  Source: [09](09-Project-Structure)

| # | Requirement | Severity | Status | Evidence / Notes |
|---|-------------|----------|--------|------------------|
| 9.1 | `docs/PROJECT-STANDARDS.md` present + is the **single source of truth** (filled from a Tier 2 template/example) | MUST | [ ] | |
| 9.2 | `project-context.md` + thin `CLAUDE.md` (references only) present | MUST | [ ] | |
| 9.3 | `README.md` with quick-start present | MUST | [ ] | |
| 9.4 | `.gitignore` covers deps / env / build / coverage / IDE / OS | MUST | [ ] | |
| 9.5 | Agent skills committed under `.agents/skills/` (installed into a skills dir Claude Code scans) | MUST | [ ] | |
| 9.6 | CI pipeline config at the platform-standard location | MUST | [ ] | |
| 9.7 | SSOT discipline — facts live in PROJECT-STANDARDS.md; other files reference, never duplicate | SHOULD | [ ] | |

## 10 — Continuous Improvement  ·  Source: [10](10-Continuous-Improvement)

> Most cadence items here are owned by the **process-improvement team**, not the project. The project-facing requirements:

| # | Requirement | Severity | Status | Evidence / Notes |
|---|-------------|----------|--------|------------------|
| 10.1 | Tier 1 deviations documented in `PROJECT-STANDARDS.md` §13 — **no silent exceptions** | MUST | [ ] | _PROJECT-STANDARDS §13_ |
| 10.2 | Per-sprint friction / surprises noted; lessons-learned entries captured | SHOULD | [ ] | _lessons log_ |
| 10.3 | Tier 1 metrics surfaced where the platform provides them (CI duration, CI failure rate, PR turnaround, cycle time) | SHOULD | [ ] | _DevOps analytics_ |
| 10.4 | Team participates in the quarterly standards review (proposes refinements observed in this project) | SHOULD | [ ] | |

---

## Summary roll-up (optional)

Projects may keep a one-line tally at the top of their filled-in copy:

```
MUST:   __/__ met   ·   __ deviations (see PROJECT-STANDARDS §13)
SHOULD: __/__ met
Last reviewed: YYYY-MM-DD (kickoff | release vX.Y)
```
