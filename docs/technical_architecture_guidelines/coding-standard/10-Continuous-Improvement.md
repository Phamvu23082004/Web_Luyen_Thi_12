# 10 — Continuous Improvement

## Principle

Engineering standards are living documents. They must evolve based on real-world experience, not assumptions. Improvement is driven by measurement, retrospective, and cross-team knowledge sharing — not by top-down decree.

**Rule: No standard survives unchanged for more than two quarters.** If nothing has been updated, either the team isn't using the standards or isn't learning from their work.

## Improvement Cadence

| Frequency | Activity | Owner |
|-----------|----------|-------|
| Per sprint | Teams note friction points, workarounds, and surprises | Development teams |
| Monthly | Engineering review: share lessons learned across teams | Engineering leads |
| Quarterly | Standards review: evaluate and update Tier 1 documents | Process improvement team |
| Bi-annually | Tooling evaluation: assess AI tools, CI/CD platforms, BMad modules | Process improvement team + tech leads |

## How to Propose Changes

### Process

1. **Identify**: Any team member observes a gap, friction, or improvement opportunity
2. **Document**: Write a brief proposal (what, why, impact) — can be as short as a paragraph
3. **Discuss**: Raise in the monthly engineering review or directly with process improvement team
4. **Decide**: Process improvement team evaluates and either accepts, defers, or rejects with reasoning
5. **Update**: Accepted changes are merged into the standards documents with changelog entries
6. **Communicate**: Announce changes in the next monthly engineering review

### Proposal Format (lightweight)

```
**What**: [One sentence describing the change]
**Why**: [What problem did we observe? On which project?]
**Impact**: [Which Tier 1 doc(s) affected? Which stacks?]
**Proposal**: [Specific change — add/modify/remove what?]
```

Changes that affect fundamental principles (e.g., switching from trunk-based development to Gitflow as default) require broader discussion. Changes that refine existing guidance (e.g., adding a new "Do NOT" to CLAUDE.md examples) can be fast-tracked.

## Metrics to Track

These metrics help the process improvement team assess whether the standards are working. Not all need to be tracked from day one — start with the ones that are easy to collect and add more as the team matures.

### Tier 1 — Automatic (Azure DevOps built-in, no extra setup)

These are available immediately from Azure DevOps Pipelines and Repos analytics.

| Metric | How to Measure | Target | Purpose |
|--------|---------------|--------|---------|
| CI pipeline duration | Azure Pipelines → Analytics → Average run time per pipeline | < 8 min | Validates CI/CD standards (doc 04) |
| CI failure rate | Azure Pipelines → Analytics → Filter runs with non-code failures (infra, flaky tests) ÷ total runs | < 5% | Pipeline stability |
| PR review turnaround | Azure Repos → PR analytics → Time from PR created to first review vote | < 4 business hours | Validates code review process (doc 03) |
| PR cycle time | Azure Repos → PR analytics → Time from PR created to completed (merged) | < 1 business day | Overall development flow health |

**Action**: Process improvement team enables Azure DevOps Analytics dashboards per project. Review monthly.

### Tier 2 — Requires Setup (Azure Boards configuration)

These require adding fields or tags in Azure Boards work items. Set up once, then collection is low-effort.

| Metric | Setup Required | How to Measure | Target | Purpose |
|--------|---------------|---------------|--------|---------|
| Defect escape rate | Add a field `Found In Environment` (values: `Development`, `Code Review`, `Testing`, `Staging`, `Production`) to Bug work items | Monthly count: Bugs where `Found In Environment = Production` ÷ total bugs closed | Decreasing trend | Validates testing strategy + review process |
| Post-release incidents | Add tag `post-release` to bugs reported within 48h of a deployment. Track deployment dates via Release tags or wiki. | Monthly count of `post-release` tagged bugs per release | Decreasing trend | Validates quality gates (doc 08) |
| Onboarding time | Add an onboarding checklist template in Azure Boards (or shared doc) with timestamp fields: `Clone started`, `First successful run`, `First PR submitted` | `First successful run` minus `Clone started` | < 30 min (clone to running) | Validates dev environment standards (doc 06) |

**Action**: Process improvement team creates the Azure Boards field/tag configuration. Include in project kickoff checklist.

### Tier 3 — Qualitative (lightweight, review-based)

These cannot be automatically counted. Instead, collect them through periodic reviews — quarterly is sufficient.

| Metric | How to Collect | Format | Purpose |
|--------|---------------|--------|---------|
| AI tooling value | During quarterly standards review, ask each team: "Did BMad reviews or Claude Code PR Toolkit catch anything meaningful this quarter? Give 1-2 examples." | Short written examples, not numbers | Validates AI-assisted development process (doc 07) |
| CLAUDE.md gaps | During code reviews, reviewers note when AI-generated code violates project conventions. Collect these as comments tagged `[claude-md-gap]` in PRs. Review quarterly: are there patterns? | List of recurring violations | Identifies missing CLAUDE.md rules to add |
| Standards friction | During monthly engineering reviews, teams report: "What standard got in the way this month?" and "What standard saved us?" | Lessons learned log entries (see below) | Identifies standards to simplify or strengthen |

**Action**: Add these 3 questions to the quarterly standards review agenda. No dashboards needed — just conversation and documentation.

## Improvement Backlog

Items below are known gaps and future improvements identified during the initial creation of these standards. The process improvement team should prioritize and schedule these.

### Priority 1 — Address within Q1-Q2

| # | Item | Affects | Description |
|---|------|---------|-------------|
| IMP-01 | Standards retrospective process | All Tier 1 | Define who reviews standards quarterly, how proposals are submitted, how changes are approved. Currently the "How to Propose Changes" section above is the starting point — validate it works after first quarter. |
| IMP-02 | Onboarding measurement setup | Doc 06 | Create the onboarding checklist template in Azure Boards with timestamp fields (as defined in Tier 2 metrics above). Test on next 2 hires. If consistently > 30 min, investigate root causes per stack. |
| IMP-03 | Cross-project knowledge sharing | All | Structure the monthly engineering review: each team shares 1 lesson learned, 1 thing that worked, 1 thing that didn't. Capture in a shared log accessible to all teams. |
| IMP-04 | Azure DevOps pipeline templates | Doc 04 | After 2-3 projects per stack, extract shared pipeline templates that projects can extend. Reduces per-project CI setup from writing a full YAML to a few lines of configuration. |

### Priority 2 — Address within Q3-Q4

| # | Item | Affects | Description |
|---|------|---------|-------------|
| IMP-05 | Custom BMad module | Doc 07 | Build a custom BMad module with proper phase gates, dependencies, and automated skill recommendations. The 6-phase workflow has been validated on the ESS project (Sprint 1-2). The workflow quick-reference guide ([07a](07a-Workflow-Quick-Reference)) serves as the interim executable checklist until this module is built. Turns documented process into tooling-enforced process. **Validated on**: ESS project, 2026-04-05. **Interim solution**: [07a — Workflow Quick-Reference](07a-Workflow-Quick-Reference). |
| IMP-06 | CLAUDE.md effectiveness review | Doc 09 + examples | After 3+ projects use the CLAUDE.md examples, review the `[claude-md-gap]` tagged PR comments collected via Tier 3 metrics. Which "Do NOT" rules are missing? Which existing rules never trigger? Feed findings back into the examples. |
| IMP-07 | Security baseline automation | Doc 05 | Add automated security scanning to CI pipeline (OWASP ZAP, Snyk, or Azure DevOps security extensions). Currently doc 05 is policy-only — automation enforces it. |
| IMP-08 | OpenAPI client generation standardization | Tier 2 fullstack examples | Standardize which generator tool to use (orval vs openapi-typescript-codegen) and add CI validation that generated client is not stale. |

### Priority 3 — Address within 6-12 months

| # | Item | Affects | Description |
|---|------|---------|-------------|
| IMP-09 | AI tool evaluation cadence | Doc 07 | Evaluate every 6 months: Is Claude Code still the best default? Has Azure DevOps support been added for `/code-review`? Are there new BMad modules worth adopting? Has GitHub Copilot or other tools caught up? |
| IMP-10 | Outsourcing-specific standards | All | After 2-3 outsourcing projects under this framework, create dedicated guidance: client handoff checklist, code ownership transfer, how to handle clients who reject Xiontech standards, SLA alignment with quality gates. |
| IMP-11 | Standards versioning | All Tier 1 | Version the standards (v1.0, v1.1, v2.0). Let each project's Tier 2 declare which standards version it follows. Prevents confusion when standards evolve but existing projects don't update immediately. |
| IMP-12 | Tier 2 template evolution | Tier 2 | After 5+ projects use the Tier 2 template, review which sections are always filled in vs. always skipped. Simplify the template based on actual usage. Remove sections nobody uses, expand sections that are always customized heavily. |

## Lessons Learned Log

Teams should capture lessons learned during monthly engineering reviews. Format:

```
**Date**: YYYY-MM-DD
**Project**: [Project name]
**Category**: [Process | Tooling | Architecture | Testing | Security | AI]
**Lesson**: [What happened and what we learned]
**Action**: [What we changed or should change as a result]
```

Maintain this log in a shared location accessible to all teams (Azure DevOps Wiki, shared document, or internal knowledge base). The process improvement team reviews this log quarterly when evaluating standards updates.

### Entries

```
**Date**: 2026-04-05
**Project**: ESS (Employee Self Services)
**Category**: Process
**Lesson**: The 6-phase workflow (doc 07) works well but is hard to follow as
prose. Tier 2 setup was forgotten until Sprint 2 was done because the checklist
was buried in doc 09. Adversarial review on Sprint 2 auth code found 13 issues
(5 security-impactful), all fixable — proving the review gate has real value.
**Action**: Created 07a-workflow-quick-reference.md as a step-by-step checklist.
Updated doc 09 init checklist with phase-to-section mapping for Tier 2 setup.
Added post-review cycle and Tier 2 maintenance steps to doc 07 Phase 5.
```

```
**Date**: 2026-04-07
**Project**: ESS (Employee Self Services)
**Category**: AI | Process
**Lesson**: Sprint 6 (Frontend) had a systematic bug: all raw SQL queries
using $queryRawUnsafe returned snake_case column names, but the React
frontend expected camelCase. The bug existed in 5 repository files but was
fixed one at a time as the user discovered each broken page — causing
frustration and rework. Root causes: (1) no documented convention for raw SQL
aliasing, (2) AI fixed individual instances without auditing the full
codebase for the same pattern, (3) Docker on Windows masked code changes
because tsx watch didn't detect file modifications through bind mounts.
**Action**: Added raw SQL aliasing rule to PROJECT-STANDARDS.md Section 9
and CLAUDE.md. Added two AI anti-patterns to doc 07: "fixing one instance
without auditing the codebase" and "fixing code without updating conventions."
Added "convention capture" guidance to doc 07 Tier 2 maintenance checklist.
```

## Anti-Patterns in Process Improvement

Avoid these common mistakes:

1. **Standards hoarding** — Adding rules for every problem without removing outdated ones. Standards should stay lean. If a rule hasn't prevented a real issue in 6 months, consider removing it.

2. **Retroactive enforcement** — Changing a standard and then demanding all existing projects comply immediately. New standards apply to new work. Existing projects adopt gradually during natural refactoring.

3. **Measurement theater** — Tracking metrics nobody looks at or acts on. Only track what you'll actually use to make decisions. Start with 2-3 metrics, not 12.

4. **Process without pain** — Adding process steps that solve problems nobody has. Every new standard should trace to a real incident, recurring friction, or validated risk — not a hypothetical "what if."

5. **Ignoring the team** — Standards imposed without team input create resentment and workarounds. The monthly engineering review is where teams have a voice. Listen first, standardize second.
