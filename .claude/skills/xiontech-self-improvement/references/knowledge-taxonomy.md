# Knowledge Taxonomy

Mapping table: domain → section in Knowledge-Base.md

| Domain | KB Section Slug | Wiki Anchor | Tier-1 Reference |
|---|---|---|---|
| Security | `security` | `## Security` | `05-Security-Baseline.md` |
| CI/CD | `cicd` | `## CI/CD` | `04-CICD-Standards.md` |
| Git & Branching | `git` | `## Git & Branching` | `01-Git-Workflow.md` |
| Code Quality | `code-quality` | `## Code Quality` | `03-Code-Review.md` |
| AI / Claude Development | `ai-development` | `## AI / Claude Development` | `07-AI-Assisted-Development.md` |
| Architecture | `architecture` | `## Architecture` | `Architecture-guideline-and-template/` |
| Testing | `testing` | `## Testing` | `08-Quality-Gates.md` |
| Development Environment | `dev-environment` | `## Development Environment` | `06-Dev-Environment.md` |

## Stack Tags

| Tag | When to Use |
|---|---|
| `Common` | Applies across all stacks |
| `FE` | Frontend — React, Next.js, browser APIs |
| `BE` | Backend — API, database, server-side |
| `AI` | LLM, prompt engineering, AI agents |
| `DevOps` | Pipeline, deployment, infrastructure |

## Standard Entry Format

Every entry in Knowledge-Base.md must follow this format:

```markdown
### [slug: unique-kebab-case-id-max-5-words]
**Date**: YYYY-MM-DD | **Stack**: Common/FE/BE/AI | **Domain**: Security/CI-CD/etc.
**Learning**: The specific rule or pattern learned, written as a concise actionable rule.
**Context**: The specific situation in the session that produced this learning.
**Source**: *"Short quote (<100 chars) from the conversation as evidence."*

```

## Deduplication Rules

When the skill cross-references against the existing KB:
1. Match on `slug` — if slug already exists → skip entirely
2. Match on `learning` content — if similarity > 80% → skip
3. If the new entry extends an existing one → update the existing `Learning` field, do not create a new entry
