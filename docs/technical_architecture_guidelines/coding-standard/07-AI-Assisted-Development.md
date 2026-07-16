# 07 — AI-Assisted Development (Claude Code + BMad)

> **Quick-reference checklist**: See [07a — Workflow Quick-Reference](07a-Workflow-Quick-Reference) for a step-by-step guide. This document explains the principles and reasoning.

## Principle

AI is a powerful collaborator, not an autonomous agent. The human developer remains accountable for every line of code that reaches production. AI accelerates work; it does not replace judgment, review, or understanding.

## Toolchain

| Tool | Role | When to Use |
|------|------|-------------|
| **Claude Code** | AI coding assistant (CLI + IDE extension) | Writing code, debugging, refactoring, code review assistance |
| **Cursor / Codex / other AI tools** | Alternate AI coding surfaces | Same standard, different editor — see single-source note below |
| **BMad Framework** | Structured workflow skills for planning, review, and documentation | Product planning, architecture design, quality reviews, brainstorming |
| **CodeGraph** | Local code knowledge graph (context + token efficiency) | Before writing/editing — supplies precise context, reuse over re-solve |

**One shared spec, every tool.** The project standard is committed once and read by every AI tool: `CLAUDE.md` (Claude Code), `AGENTS.md` (Codex and others), `.cursor/rules` (Cursor). They are thin entry points to the same `project-context.md` + `docs/PROJECT-STANDARDS.md` — so agents on different tools cannot drift from one another, because they share the same source of truth.

## The Human-AI Development Cycle

```
Human thinks → AI drafts → Human reviews → AI refines → Human commits
```

This cycle applies to every unit of work. The key principle: **never commit code you don't understand.**

## Product Development Workflow

This is Xiontech's standard workflow for building products with AI assistance. It was proven on the ESS project and is now the company default. The workflow uses BMad Core skills (utility tools) at specific points — the sequence and gates are enforced by process, not by tooling.

**Apply this workflow for**: New products, new major features, new project phases.
**Scale down for**: Small features, bug fixes, maintenance (skip to Phase 5 directly).

### Overview

```
Phase 1        Phase 2      Phase 3         Phase 4          Phase 5         Phase 6
Ideation  →  Requirements  →  Design  →  Implementation  →  Development  →  Release
                                           Planning          Sprints
   ▼             ▼             ▼               ▼                ▼              ▼
Brainstorm      PRD        Architecture    Backlog +        Code + Test    Integration
Session       Document      Document       Sprint Plan      + Review       + Deploy
```

### Phase 1: Ideation

**Purpose**: Explore the problem space, generate ideas, define scope.

| Step | How | Tool | Output |
|------|-----|------|--------|
| 1a. Brainstorm | Interactive session with AI | `/bmad-brainstorming` | Brainstorming session document |
| 1b. Distill (if session is large) | Compress for future context | `/bmad-distillator` | Distillate file |
| 1c. Create project context | Fill in Section 1 of project standards | Manual | `docs/PROJECT-STANDARDS.md` Section 1 |

**Gate**: Brainstorming complete. Project context documented. Proceed when you have a clear problem statement and feature scope.

**Session tip**: Start a fresh Claude Code session for brainstorming. Don't carry code context into ideation.

### Phase 2: Requirements (PRD)

**Purpose**: Define what to build, for whom, and why. Capture business rules, user stories, acceptance criteria.

| Step | How | Tool | Output |
|------|-----|------|--------|
| 2a. Draft PRD | Collaborative writing with AI, using brainstorming output as context | Claude Code | PRD document in `_bmad-output/` |
| 2b. Review PRD | Adversarial review for gaps, contradictions, missing requirements | `/bmad-review-adversarial-general` | Findings report |
| 2c. Review edge cases | Systematic edge case analysis | `/bmad-review-edge-case-hunter` | Edge case report |
| 2d. Fix findings | Address critical/high findings from both reviews | Claude Code | Updated PRD |
| 2e. Distill PRD | Compress for architecture phase context | `/bmad-distillator` | PRD distillate |

**Gate**: PRD reviewed (adversarial + edge case). All critical findings resolved. Distillate created. Proceed when requirements are stable enough to design against.

**Session tip**: Run each review in a fresh session. Reviews should be independent — the reviewer shouldn't have context from the drafting session.

### Phase 3: Architecture & Design

**Purpose**: Define how to build it. Tech stack, data model, API design, system architecture.

| Step | How | Tool | Output |
|------|-----|------|--------|
| 3a. Design architecture | Collaborative design with AI, using PRD distillate as context | Claude Code | Architecture document in `_bmad-output/` |
| 3b. Review architecture | Adversarial review for design flaws, security gaps | `/bmad-review-adversarial-general` | Findings report |
| 3c. Review edge cases | Systematic edge case analysis on the design | `/bmad-review-edge-case-hunter` | Edge case report |
| 3d. Fix findings | Address critical/high findings | Claude Code | Updated architecture document |
| 3e. Distill architecture | Compress for implementation context | `/bmad-distillator` | Architecture distillate |
| 3f. Update project standards | Summarize key decisions into PROJECT-STANDARDS.md | Manual | Sections 2, 3, 5, 6, 9 updated |

**Gate**: Architecture reviewed (adversarial + edge case). All critical findings resolved. Distillate created. PROJECT-STANDARDS.md updated with architecture decisions. Proceed when the design is stable enough to plan implementation.

### Phase 4: Implementation Planning

**Purpose**: Break the architecture into a development backlog. Define sprints, dependencies, build order.

| Step | How | Tool | Output |
|------|-----|------|--------|
| 4a. Create implementation plan | Break architecture into tasks with dependencies and sprint allocation | Claude Code (using architecture distillate) | Implementation plan in `_bmad-output/` |
| 4b. Complete Tier 2 standards | Fill remaining PROJECT-STANDARDS.md sections (7, 8, 10, 11, 12) from architecture + plan | Claude Code / Manual (see [Tier 2 Setup Guide](../Tier-2-Project-Standards)) | `docs/PROJECT-STANDARDS.md` fully filled |
| 4c. Set up project-context.md | Write AI implementation rules based on architecture decisions, using tech-stack example | Claude Code (see [Tier 2 Setup Guide](../Tier-2-Project-Standards)) | `project-context.md` |
| 4d. Set up CLAUDE.md | Create thin Claude Code entry point referencing project-context.md and PROJECT-STANDARDS.md | Manual | `CLAUDE.md` |

**Gate**: Implementation plan exists. PROJECT-STANDARDS.md fully filled in (all 13 sections). project-context.md created. CLAUDE.md references both. Proceed to coding. See [07a — Workflow Quick-Reference](07a-Workflow-Quick-Reference) — Tier 2 Setup section for the verification checklist.

### Phase 5: Development Sprints

**Purpose**: Build it. Each sprint follows a cycle of plan → code → test → review.

| Step | How | Tool | Output |
|------|-----|------|--------|
| 5a. Sprint planning | Select tasks from backlog for this sprint | Manual | Sprint scope |
| 5b. Plan non-trivial tasks | Use plan mode before coding complex features | Claude Code `/plan` | Approved plan |
| 5c. Implement | Write code with AI assistance | Claude Code | Source code |
| 5d. Test | Write and run tests | Claude Code + test runner | Passing tests |
| 5e. AI-assisted self-review | Run PR Review Toolkit agents locally: "review my changes", "check test coverage", "check error handling" | Claude Code (PR Review Toolkit agents) | Issues found and fixed |
| 5f. Self-review | Developer reads the diff — understand every line before PR | Manual | Reviewed diff |
| 5g. PR + peer review | See [03-code-review.md](03-Code-Review) for full process including AI review tools | Git + team | Approved PR |

**Repeat 5a–5g for each sprint.**

**Quality gates during development** (run in fresh sessions):

| After | Run | Why |
|-------|-----|-----|
| Auth/security module complete | `/bmad-review-adversarial-general` on code | Security defects are expensive to fix late |
| Core business logic complete | `/bmad-review-edge-case-hunter` on code | Business logic edge cases cause production bugs |
| Each sprint (optional) | `/bmad-review-adversarial-general` on sprint diff | Catch drift from architecture |

**Post-review cycle**: When a review produces findings, follow this process:

1. Analyze each finding — fix, accept with justification, or defer with reasoning
2. If fixes change architecture decisions → update `docs/PROJECT-STANDARDS.md` Section 3
3. If fixes introduce new Tier 1 deviations → update Section 13
4. If fixes change the database schema or API → update the architecture distillate
5. Re-run lint + typecheck + tests after all fixes
6. Commit the fixes with the review context in the commit message

**Tier 2 maintenance per sprint**: After completing each sprint, check:

- Did any architecture decisions change? → Update Section 3
- Did you add new conventions or patterns? → Update Sections 5–6
- Did bug fixes reveal undocumented rules? → Add to Section 9 (Database), Section 6 (API), or CLAUDE.md as appropriate
- Did you deviate from Tier 1? → Document in Section 13
- Did you create new docs? → Update Section 11
- Does CLAUDE.md still match reality? → Update if needed

**Convention capture**: When a series of bug fixes reveals a systematic pattern (e.g., "all raw SQL must do X", "this library requires workaround Y"), the fix is incomplete until the convention is documented. Add it to PROJECT-STANDARDS.md if it applies to all developers, or CLAUDE.md if it's an AI-specific coding rule. A bug fixed without a documented convention will recur in the next module.

### Phase 6: Release

**Purpose**: Integrate, test end-to-end, deploy.

| Step | How | Tool | Output |
|------|-----|------|--------|
| 6a. Integration testing | Run full test suite, E2E smoke tests | Test runner | Passing tests |
| 6b. Security audit | Verify OWASP baseline, review auth flows | Manual + `/bmad-review-adversarial-general` | Audit results |
| 6c. Pre-release review | Final adversarial review on full system | `/bmad-review-adversarial-general` | Findings report |
| 6d. Deploy | Follow deployment procedure in PROJECT-STANDARDS.md | CI/CD | Production deployment |
| 6e. Post-release verification | Health check, smoke test, monitor error rates | Manual | Verified release |

**Gate**: See [08-quality-gates.md](08-Quality-Gates) — Release Done checklist.

### Workflow Summary — BMad Skills by Phase

**Greenfield phases:**

| Phase | BMad Skills Used | Purpose |
|-------|-----------------|---------|
| 1. Ideation | `bmad-brainstorming`, `bmad-distillator` | Generate and compress ideas |
| 2. Requirements | `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`, `bmad-distillator` | Validate and compress PRD |
| 3. Design | `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter`, `bmad-distillator` | Validate and compress architecture |
| 4. Planning | — (Claude Code only) | Break design into backlog |
| 5. Development | `bmad-review-adversarial-general`, `bmad-review-edge-case-hunter` (at gates) | Validate critical code |
| 6. Release | `bmad-review-adversarial-general` | Final quality check |

**Brownfield phases:**

| Phase | BMad Skills Used | Purpose |
|-------|-----------------|---------|
| B1. Onboarding | `bmad-distillator` | Compress existing docs for AI context |
| B2. Gap Analysis | `bmad-review-adversarial-general` | Assess current codebase quality |
| → then Phase 5–6 | Same as greenfield | Development and release |

### Additional BMad Skills (Use Anytime)

These skills are not tied to a specific phase — use them when the need arises:

| Skill | When to Use |
|-------|-------------|
| `bmad-editorial-review-prose` | When documentation quality matters (user guides, API docs) |
| `bmad-editorial-review-structure` | When a document needs reorganization |
| `bmad-shard-doc` | When a document exceeds ~500 lines |
| `bmad-index-docs` | When `_bmad-output/` needs a navigation index |
| `bmad-party-mode` | When you want multiple AI perspectives on a decision |
| `bmad-advanced-elicitation` | When you want deeper critique (Socratic, first principles, pre-mortem) |

### Greenfield vs. Brownfield

The 6-phase workflow above is the **greenfield** track — building something new from scratch. Brownfield projects (joining or extending an existing codebase) follow a different entry path.

#### How to Choose

| Situation | Track | Start At |
|-----------|-------|----------|
| New product from scratch | Greenfield | Phase 1 |
| New major feature for existing product | Greenfield (abbreviated) | Phase 2 or 3 |
| Joining an existing codebase (outsourcing, takeover, inherited project) | Brownfield | Phase B1 |
| Bug fixes, small features, maintenance | Either — minimal | Phase 5 directly |

#### Brownfield Track

When joining an existing codebase, Phases 1–3 are replaced by an **onboarding and assessment** sequence. The goal: understand what exists before changing anything.

**Phase B1: Codebase Onboarding**

| Step | How | Tool | Output |
|------|-----|------|--------|
| B1a. Explore codebase | AI reads and explains the codebase structure, patterns, dependencies | Claude Code (explore agent) | Mental model of the system |
| B1b. Distill existing docs | Compress any existing documentation for AI context | `/bmad-distillator` | Distillates of existing docs |
| B1c. Document what exists | Fill in PROJECT-STANDARDS.md based on what you observe | Claude Code + manual | `docs/PROJECT-STANDARDS.md` (reverse-engineered) |
| B1d. Write CLAUDE.md | Encode the existing patterns so AI follows them consistently | Manual / Claude Code | `CLAUDE.md` reflecting existing conventions |

**Gate**: Team can explain the architecture, data model, and key business flows. PROJECT-STANDARDS.md and CLAUDE.md exist.

**Phase B2: Gap Analysis & Planning**

| Step | How | Tool | Output |
|------|-----|------|--------|
| B2a. Assess current state | Review code quality, test coverage, security posture, tech debt | Claude Code + `/bmad-review-adversarial-general` | Assessment report |
| B2b. Define scope of work | What needs to change? New features, bug fixes, refactoring, modernization? | Manual (with client if outsourcing) | Scope document |
| B2c. Create implementation plan | Break work into tasks with dependencies and sprint allocation | Claude Code | Implementation plan |

**Gate**: Scope defined, plan exists. Proceed to Phase 5 (Development Sprints).

**Then continue with**: Phase 5 (Development Sprints) → Phase 6 (Release) from the greenfield track.

#### Brownfield-Specific Risks

| Risk | Mitigation |
|------|-----------|
| Undocumented business rules hidden in code | Use AI to trace logic paths; document as you discover them |
| No existing tests — afraid to change anything | Write characterization tests (tests that capture current behavior) before making changes |
| Inconsistent patterns across the codebase | Pick the best existing pattern as reference; document it in CLAUDE.md; gradually migrate toward consistency |
| Client says "just fix this one thing" but the codebase is fragile | Assess blast radius before changing. Be transparent about risks. Propose safe approach in implementation plan. |

### Scaling the Workflow

**Full greenfield** (Phases 1–6): New product, new major feature, new project phase.

**Abbreviated greenfield** (Phases 3–6): Adding a significant feature to an existing product where requirements are already clear.

**Full brownfield** (Phases B1–B2 → 5–6): Joining or taking over an existing codebase.

**Minimal** (Phase 5 only): Bug fixes, small features, maintenance on a project already onboarded. Still use adversarial review on security-sensitive changes.

**Outsourcing adaptation**: The client may own some phases. For greenfield outsourcing, the client typically provides Phases 1–2 (requirements); Xiontech starts at Phase 3 (design). For brownfield outsourcing, always start with Phase B1 (onboarding) regardless of what the client says about the codebase — verify before trusting.

## Claude Code — Development Guidelines

### When to Use Plan Mode

Use Claude Code's plan mode (`/plan`) for:
- New feature implementation (more than a simple CRUD)
- Changes that affect multiple files
- Architectural decisions with multiple valid approaches
- Any task where you'd want to discuss the approach before coding

**Don't use plan mode for**: Single-file fixes, typo corrections, simple additions.

### Context Management

1. **Start fresh sessions** for each major task. Don't let context from Task A pollute Task B.
2. **Provide architecture context** at the start of implementation sessions — use distillates, not raw 26K-token docs.
3. **Use project-context.md** in the project repo for AI implementation rules. BMad agents load this file on activation. `CLAUDE.md` is a thin entry point that references it — see [09-project-structure.md](09-Project-Structure) for the single-source-of-truth principle.
4. **Use memory** for cross-session information: user preferences, project status, team decisions. Don't store code patterns in memory — they belong in project-context.md or the code itself.

### CodeGraph — Context & Token Efficiency

Where available, build a local **code knowledge graph** (CodeGraph) and let the AI query it for context instead of re-reading files each turn. It supplies precise, symbol-level context, cuts token burn substantially (reuse over re-solve), and keeps answers grounded in the actual code.

- Build the index at setup (`npx bmad-method install` + CodeGraph index) and let it auto-refresh on merge.
- Reference it from `CLAUDE.md` so every session benefits. **CodeGraph is a context aid, not a quality gate** — it speeds the work; it does not replace review, tests, or the CI wall.

### Code Generation Rules

1. **Understand before generating**: Read existing code before asking AI to write new code. AI needs context about existing patterns.
2. **One concern at a time**: Don't ask AI to "build the entire auth module." Break it into smaller units: "create the auth endpoints," then "implement the login service," etc.
3. **Review every generation**: Read the generated code. If you can't explain what it does, don't commit it.
4. **Test AI-generated code**: AI code needs the same test coverage as hand-written code. AI can also write tests, but review the assertions — AI tests sometimes test that code does what code does, not that code does what it *should*.
5. **Watch for AI anti-patterns**:
   - Over-abstraction (creating helpers for one-time operations)
   - Unnecessary error handling (try/catch around code that can't throw)
   - Phantom imports (importing things that don't exist)
   - Verbose comments that restate the code
   - Adding features that weren't requested
   - Fixing one instance of a bug without auditing the full codebase for the same pattern
   - Fixing code without updating project conventions (the bug will recur in the next module)

**Self-review commands (run on your own diff before requesting peer review):**

| Command | Purpose |
|---------|---------|
| `/code-review` | Correctness + reuse/simplification pass on your own diff first |
| `/simplify` | Quality-only cleanup (reuse, dead code, altitude) |
| `/security-review` | Security pass on the pending changes |
| `/bmad-code-review` | BMAD adversarial review layer |
| (stack-specific doctors, e.g. `/react-doctor`) | Framework-specific lint beyond generic rules |

These augment — never replace — the developer reading every line of their own diff.

### What AI Does Well

- **Scaffolding**: Project setup, boilerplate, module structure, configuration files
- **Pattern replication**: "Create a module that follows the same pattern as the existing [reference module]"
- **Refactoring**: Renaming, extracting functions, reorganizing code
- **Test generation**: Writing test cases from specifications
- **Documentation**: API docs, README files, inline documentation
- **Bug investigation**: Reading code, tracing logic, identifying potential issues

### What AI Does Poorly

- **Business rule interpretation**: AI can implement rules you specify, but can't decide what the rules should be
- **Trade-off decisions**: Choosing between approaches requires understanding your constraints — tell the AI, don't let it guess
- **Performance optimization**: AI doesn't know your data volume, access patterns, or latency requirements
- **Security review**: AI can follow security patterns, but shouldn't be the sole security reviewer

## Accountability Model

| Responsibility | Owner |
|---------------|-------|
| What to build | Human (product owner / tech lead) |
| How to build it | Human decides approach; AI helps implement |
| Code correctness | Human reviewer (AI-generated code is treated same as human code) |
| Security | Human reviewer + AI adversarial review as supplementary check |
| Test coverage | Human defines what to test; AI can write tests; human verifies assertions |
| Commit quality | Human reviews and approves every commit message and diff |
| Production issues | Human who approved the merge — not "the AI wrote it" |

**There is no "AI wrote it" defense.** If you merged it, you own it.

## AI-Assisted Code Review

AI can augment human code review but not replace it:

1. **Human reviews first** — form your own opinion before asking AI
2. **AI as second reviewer** — use BMad adversarial review for critical modules
3. **AI for tedious checks** — "are all endpoints covered by auth middleware?" is a good AI question
4. **Human makes final decision** — AI review findings are input, not verdicts

## Project Setup for AI-Assisted Development

Every project should include (see [09-project-structure.md](09-Project-Structure) for full details):

1. **`docs/PROJECT-STANDARDS.md`** — single source of truth for all project decisions, context, and conventions.
2. **`project-context.md`** at project root — lean AI implementation rules. BMad agents load this on activation. Any AI tool can read it.
3. **`CLAUDE.md`** at project root — thin Claude Code entry point. References project-context.md and PROJECT-STANDARDS.md (no unique content).
4. **Architecture distillates** in `_bmad-output/` — compressed context documents for AI sessions (use `bmad-distillator` to create these from large docs)
5. **Reference implementation** — at least one fully-implemented module/feature that AI can use as a pattern for new work
5. **`.claude/` directory** — Claude Code skills and configuration (committed to repo)

## Evolving These Guidelines

This is a living document. As the team gains experience with AI-assisted development:
- Document patterns that work (e.g., "when generating database schemas, always provide the full table spec with all columns and constraints")
- Document anti-patterns (e.g., "don't ask AI to generate entire modules in one shot — break into smaller units")
- Share learnings across teams in monthly engineering reviews
