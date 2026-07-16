# 07a — Workflow Quick-Reference

> **Companion to**: [07 — AI-Assisted Development](07-AI-Assisted-Development)
> This is the step-by-step checklist. Doc 07 has the principles and reasoning.

---

## The Delivery Workflow at a Glance

> One shared spec feeds every AI tool · a machine-enforced standards floor · 100% of PRs
> reviewed, scanned, and tested before merge (Azure DevOps + BMAD).

The flow is linear with one loop: **setup feeds the spec → spec feeds stories → a story is
built → every gate must go green → any gate fails ⟶ fix and re-push → all green ⟶ merge.**

| Phase | When | What happens | Hard gate |
|-------|------|-------------|-----------|
| **0 · Project Setup** | One-time foundation | Shared standard committed (`CLAUDE.md` / `AGENTS.md` / `.cursor/rules`); shared lint+format; TypeScript locked down; design tokens; BMAD installed + code graph built | Azure Repos branch policy — no direct push to the shared branch |
| **1 · BMAD Planning** | Per epic | Analyst → brief; PM → PRD + decision log; Architect → architecture + ADRs; Scrum Master → context-rich stories linked to Azure Boards | — (agents share the same docs, so they cannot drift) |
| **2 · AI-Assisted Development** | Per story | Dev agent (Claude Code / Cursor / Codex) reads the shared standard; CodeGraph supplies precise context; self-review on own diff; commit small | Pre-commit (Husky + lint-staged) — convenience only; **CI is the wall** |
| **3 · Azure DevOps Quality Gates** | Per PR | Merge locked until green: QA-agent review → AI PR reviewer (100% of PRs) → ≥1 human approver → pipeline checks → SonarQube quality gate | All five gates must pass |
| **4 · Merge & Deploy** | On green | Squash-merge with linked work item; release to staging; update decision log / ADRs; dependencies kept honest; SonarQube trend dashboard | — |

### What the client is assured of

| Assurance | Backed by |
|-----------|-----------|
| **Traceable** | Every line traces to a story and an ADR |
| **Consistent** | One spec feeds every AI tool — no drift |
| **Verifiable** | 100% of PRs reviewed, scanned, and tested |
| **Auditable** | Decision log, ADRs + SonarQube trend |
| **Cost-efficient** | Org AI licence + CodeGraph cut token burn |

---

## Greenfield Project — Full Workflow

### Phase 1: Ideation

| Step | Action | Output |
|------|--------|--------|
| 1.1 | Run `/bmad-brainstorming` | `_bmad-output/brainstorming/` |
| 1.2 | If session > 500 lines, run `/bmad-distillator` on it | Distillate file alongside source |
| 1.3 | Fill `docs/PROJECT-STANDARDS.md` Section 1 (Project Context) | Stakeholders, strategy, phases, risks |

**Gate**: Problem statement clear, stakeholders identified, development phases outlined.

---

### Phase 2: Requirements (PRD)

| Step | Action | Output |
|------|--------|--------|
| 2.1 | Draft PRD using Claude Code (reference brainstorming output) | `_bmad-output/prd.md` |
| 2.2 | Run `/bmad-review-adversarial-general` on PRD | Findings list |
| 2.3 | Run `/bmad-review-edge-case-hunter` on PRD | Edge case findings |
| 2.4 | Fix critical/high findings from both reviews | Updated PRD |
| 2.5 | Run `/bmad-distillator` on PRD | `_bmad-output/prd-distillate.md` |

**Gate**: PRD reviewed (adversarial + edge case), critical findings resolved, distillate created.

---

### Phase 3: Architecture & Design

| Step | Action | Output |
|------|--------|--------|
| 3.1 | Design architecture using Claude Code (reference PRD distillate) | `_bmad-output/architecture.md` |
| 3.2 | Run `/bmad-review-adversarial-general` on architecture | Findings list |
| 3.3 | Run `/bmad-review-edge-case-hunter` on architecture | Edge case findings |
| 3.4 | Fix critical/high findings from both reviews | Updated architecture doc |
| 3.5 | Run `/bmad-distillator` on architecture | `_bmad-output/architecture-distillate/` |
| 3.6 | Update `docs/PROJECT-STANDARDS.md` Sections 2, 3, 5, 6, 9 | Tech stack, architecture decisions, code org, API, database |

**Gate**: Architecture reviewed, distillate created, PROJECT-STANDARDS.md updated.

---

### Phase 4: Implementation Planning & Tier 2 Setup

| Step | Action | Output |
|------|--------|--------|
| 4.1 | Create implementation plan (break architecture into sprints/tasks) | `_bmad-output/implementation-plan.md` |
| 4.2 | Fill remaining `docs/PROJECT-STANDARDS.md` sections (7, 8, 10, 11, 12, 13) | Testing, environment, deployment, docs index, AI dev, deviations |
| 4.3 | Create `project-context.md` from tech stack example in `_xiontech-standards/tier-2/examples/project-context/` | AI implementation rules |
| 4.4 | Create thin `CLAUDE.md` referencing `@project-context.md` and `@docs/PROJECT-STANDARDS.md` | Claude Code entry point |
| 4.5 | Verify: all 13 sections of PROJECT-STANDARDS.md filled, project-context.md under 150 lines, all referenced files exist | Tier 2 complete |

**Gate**: Implementation plan exists, PROJECT-STANDARDS.md fully filled, project-context.md created, CLAUDE.md references both.

---

### Phase 5: Development Sprints

Repeat per sprint:

| Step | Action | Notes |
|------|--------|-------|
| 5.1 | Read implementation plan, select sprint tasks | |
| 5.2 | Use `/plan` mode for non-trivial tasks | Skip for simple CRUD |
| 5.3 | Implement code with AI assistance | Follow project-context.md rules |
| 5.4 | Write and run tests | Must-have tests block merge |
| 5.5 | Run lint + typecheck + tests | All must pass |
| 5.6 | **If quality gate sprint**: run scheduled review (see table below) | |
| 5.7 | **If review has findings**: fix findings, update docs if architecture decisions changed | |
| 5.8 | Update `docs/PROJECT-STANDARDS.md` if any decisions changed | Section 3 (ADs), Section 13 (deviations) |
| 5.9 | Commit with descriptive message | |

#### Quality Review Schedule

Define in `docs/PROJECT-STANDARDS.md` Section 12. Typical schedule:

| Trigger | Review Skill | Required? |
|---------|-------------|-----------|
| Auth/security module complete | `/bmad-review-adversarial-general` | Yes |
| Core business logic complete | `/bmad-review-edge-case-hunter` | Yes |
| Each sprint (optional) | `/bmad-review-adversarial-general` on sprint diff | No |
| Before release | `/bmad-review-adversarial-general` on full system | Yes |

#### Post-Review Cycle

When a review produces findings:

```
Review findings → Analyze each finding → Fix or accept with justification
    → If architecture decisions changed → Update PROJECT-STANDARDS.md Section 3
    → If new Tier 1 deviation → Update PROJECT-STANDARDS.md Section 13
    → Update architecture distillate if schema/API changed
    → Re-run tests → Commit
```

---

### Phase 6: Release

| Step | Action | Notes |
|------|--------|-------|
| 6.1 | Run full test suite + E2E smoke tests | |
| 6.2 | Run `/bmad-review-adversarial-general` on full system | Pre-release security review |
| 6.3 | Fix critical findings | |
| 6.4 | Deploy following `docs/PROJECT-STANDARDS.md` Section 10 | |
| 6.5 | Post-release verification | |

**Gate**: See [08 — Quality Gates](08-Quality-Gates) Release Done checklist.

---

## Brownfield Project — Joining an Existing Codebase

### Phase B1: Codebase Onboarding

| Step | Action | Output |
|------|--------|--------|
| B1.1 | Explore codebase structure, read existing docs | Understanding |
| B1.2 | If large docs exist, run `/bmad-distillator` on them | Distillates for context |
| B1.3 | Document current state in `docs/PROJECT-STANDARDS.md` (create if missing) | Tier 2 established |
| B1.4 | Create `project-context.md` reflecting actual codebase conventions, create thin `CLAUDE.md` | AI rules for existing code |

### Phase B2: Gap Analysis & Planning

| Step | Action | Output |
|------|--------|--------|
| B2.1 | Assess current state against requirements | Gap list |
| B2.2 | Run `/bmad-review-adversarial-general` on critical areas | Findings |
| B2.3 | Create implementation plan for remaining work | `_bmad-output/implementation-plan.md` |

Then proceed to **Phase 5** (Development Sprints).

---

## Tier 2 Setup — Step by Step

Use this when setting up `docs/PROJECT-STANDARDS.md` for a new project. Can be done incrementally following the phases above.

### Quick Setup

```
Prompt: "Copy the Tier 2 template from _xiontech-standards/tier-2/ and fill it 
for this project. Use the [tech stack] pre-filled example as a starting point."
```

Available pre-filled examples: `.NET Web API`, `Python FastAPI`, `.NET + React`, `Python + React`, `Node.js + React`

### Section-to-Phase Mapping

| When | Sections to Fill |
|------|-----------------|
| Phase 1 (Ideation) | 1 — Project Context |
| Phase 3 (Architecture) | 2 — Tech Stack, 3 — Architecture Decisions, 5 — Code Organization, 6 — API Conventions, 9 — Database |
| Phase 4 (Planning) | 4 — Git Workflow, 7 — Testing, 8 — Environment, 10 — Deployment, 11 — Documentation Index, 12 — AI Development, 13 — Tier 1 Deviations |
| Ongoing | Update any section when decisions change |

### project-context.md Setup

```
Prompt: "Create project-context.md from the [tech stack] example in 
_xiontech-standards/tier-2/examples/project-context/, customized for this project."
```

Keep under 150 lines. Standard sections: Tech Stack (brief), Architecture Rules, Code Generation Rules, Naming, Do NOT.

### CLAUDE.md Setup

Create a thin `CLAUDE.md` at project root:

```markdown
# [Project Name]
Read @project-context.md for AI implementation rules.
Read @docs/PROJECT-STANDARDS.md for project context and decisions.
```

### Verification Checklist

- [ ] All 13 sections of PROJECT-STANDARDS.md have content (not placeholders)
- [ ] `project-context.md` exists at project root and is under 150 lines
- [ ] `CLAUDE.md` references `@project-context.md` and `@docs/PROJECT-STANDARDS.md`
- [ ] All file paths referenced in PROJECT-STANDARDS.md Section 11 exist
- [ ] Tier 1 deviations documented in Section 13 with reasoning

---

## BMad Skills Reference

### Phase-Specific Skills

| Skill | Command | When to Use |
|-------|---------|-------------|
| Brainstorming | `/bmad-brainstorming` | Phase 1 — ideation |
| Adversarial Review | `/bmad-review-adversarial-general` | Phase 2, 3, 5 (gates), 6 |
| Edge Case Hunter | `/bmad-review-edge-case-hunter` | Phase 2, 3, 5 (gates) |
| Distillator | `/bmad-distillator [path]` | After any large document is finalized |

### Anytime Skills

| Skill | Command | When to Use |
|-------|---------|-------------|
| Editorial Review (Prose) | `/bmad-editorial-review-prose [path]` | Polish written content |
| Editorial Review (Structure) | `/bmad-editorial-review-structure [path]` | Reorganize documents |
| Shard Document | `/bmad-shard-doc [path]` | Split docs > 500 lines |
| Index Docs | `/bmad-index-docs` | Create navigation index |
| Party Mode | `/bmad-party-mode` | Multi-agent discussion |
| Advanced Elicitation | `/bmad-advanced-elicitation` | Deeper critique (Socratic, pre-mortem) |
| BMad Help | `/bmad-help` | What to do next |

---

## Changelog

| Date | What Changed | Who |
|------|-------------|-----|
| 2026-04-05 | Initial version — extracted from doc 07 + ESS Sprint 1-2 lessons | Phuc Ngo |
