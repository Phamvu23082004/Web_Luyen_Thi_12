# Coding Standards & Quality Assurance

Company-wide coding standards and quality gates from **XT-ESS (XionTech Engineering Standards)** — the **Tier 1** baseline that applies to **every** Xiontech project regardless of tech stack.

---

## Overview

This folder embeds the **XT-ESS Tier-1 Company Standards (00–10)**, copied from the [XT-ESS Wiki](https://dev.azure.com/XionTechs/X-Tek%20Project/_git/X-Tek-Project.wiki). Architecture document templates live under [`docs/templates/`](../../templates/). These are stack-agnostic — they define the principles (the "why") and opinionated defaults (the "how") for how we build software.

> **Why these live in the repo:** agents and developers must be able to read the full process locally for consistent execution, without depending on wiki access. The wiki remains the source of truth; these are synced copies. Any deviation is recorded in [`docs/PROJECT-STANDARDS.md` §13](../../PROJECT-STANDARDS.md).

> **Stack-specific standards are NOT in the skeleton.** When you choose a tech stack, pull its standards, `project-context`, and `PROJECT-STANDARDS` from the matching **Wiki Tier 2** example (e.g. .NET Web API, .NET + React, Python FastAPI, Node + React). The skeleton stays stack-agnostic on purpose.

## Documents (Tier 1 — all projects)

| Document | Description |
|----------|-------------|
| [00-Conformance-Checklist.md](00-Conformance-Checklist.md) | Master Tier 1 conformance checklist (the filled copy is [`docs/TIER1-CONFORMANCE.md`](../../TIER1-CONFORMANCE.md)) |
| [01-Git-Workflow.md](01-Git-Workflow.md) | Branching strategy, PR workflow, trunk-based development |
| [02-Commit-Conventions.md](02-Commit-Conventions.md) | Commit message format and discipline |
| [03-Code-Review.md](03-Code-Review.md) | How we review and approve code changes |
| [04-CICD-Standards.md](04-CICD-Standards.md) | Continuous integration and deployment pipeline |
| [05-Security-Baseline.md](05-Security-Baseline.md) | OWASP Top 10, auth, input validation, secrets |
| [06-Dev-Environment.md](06-Dev-Environment.md) | Tooling, onboarding, Docker, environment setup |
| [07-AI-Assisted-Development.md](07-AI-Assisted-Development.md) | Claude Code + BMad workflow and accountability |
| [07a-Workflow-Quick-Reference.md](07a-Workflow-Quick-Reference.md) | Step-by-step checklist for BMad workflows |
| [08-Quality-Gates.md](08-Quality-Gates.md) | Definition of done, release checklist, SonarQube |
| [09-Project-Structure.md](09-Project-Structure.md) | Standard layout, PROJECT-STANDARDS.md, project-context.md |
| [10-Continuous-Improvement.md](10-Continuous-Improvement.md) | Metrics, retrospectives, standards evolution |

## Architecture Templates

| Template | Purpose |
|----------|---------|
| [`architecture-template.md`](../../templates/architecture-template.md) | Main architecture document (21 sections, WAF-aligned) |
| [`tech-arch-req-template.md`](../../templates/tech-arch-req-template.md) | Capture technical requirements before architecture |
| [`tech-arch-req-example.md`](../../templates/tech-arch-req-example.md) | Filled example of the tech-requirements template |

**Workflow:** `tech-arch-req.md` → `architecture.md` → WAF validation → ADRs.

## Cross-References

- [XT-ESS Wiki](https://dev.azure.com/XionTechs/X-Tek%20Project/_git/X-Tek-Project.wiki)
- [Project-Specific Standards](../../PROJECT-STANDARDS.md) — filled from a Tier 2 example per stack

---

**Source:** XT-ESS Tier-1 Company Standards
**Maintained By:** Architecture Team
**Review Cycle:** Quarterly
