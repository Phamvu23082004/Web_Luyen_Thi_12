# Domain Classification Guide

Use this file **after extracting learnings** — to assign the correct `domain` and `stack` tag to each entry.

The LLM does not need a keyword list to find learnings; it understands context. This file only helps classify findings into the right domain after they have already been identified.

---

## Domains and How to Recognize Them

### `security` — Application Security
Assign this domain when the learning relates to: protecting user data, authentication/authorization, OWASP vulnerabilities, secrets management, or securing LLM output.

**Example entries:**
```
Learning: Never pass LLM output directly to innerHTML — use textContent or DOMPurify first.
Stack: FE | Domain: security
```
```
Learning: API keys must not be hardcoded in SKILL.md or any committed file — always read from env vars.
Stack: Common | Domain: security
```

---

### `cicd` — CI/CD and Deployment
Assign this domain when the learning relates to: pipelines, build failures, deployment, Docker, lockfiles, quality gates, or test flakiness in CI.

**Example entries:**
```
Learning: Use npm ci instead of npm install in CI to ensure the lockfile is respected.
Stack: Common | Domain: cicd
```
```
Learning: Azure pipeline fails without DOTNET_SKIP_FIRST_TIME_EXPERIENCE=1 in env — add to yaml.
Stack: BE | Domain: cicd
```

---

### `git` — Git Workflow and Branching
Assign this domain when the learning relates to: merge conflicts, commit message conventions, branch naming, PR workflow, or rebase strategy.

**Example entries:**
```
Learning: Commit messages must follow Conventional Commits — "feat:", "fix:", "chore:" — no freeform abbreviations.
Stack: Common | Domain: git
```
```
Learning: Never push directly to main — always create a feature branch, even for small hotfixes.
Stack: Common | Domain: git
```

---

### `code-quality` — Code Quality
Assign this domain when the learning relates to: readability, refactoring, naming conventions, dead code, over-engineering, or SOLID/DRY/YAGNI violations.

**Example entries:**
```
Learning: A function over 50 lines is a split candidate — especially when it contains more than one nested loop.
Stack: Common | Domain: code-quality
```
```
Learning: Do not create an abstraction until the pattern appears a third time — YAGNI is enforced strictly at X-Tek.
Stack: Common | Domain: code-quality
```

---

### `ai-development` — LLM and Claude/BMad
Assign this domain when the learning relates to: Claude Code behavior, BMad skills, prompt engineering, context window management, AI anti-patterns, or LLM output handling.

**Example entries:**
```
Learning: Claude tends to add "what" comments instead of "why" comments — add a reminder in CLAUDE.md to suppress this.
Stack: AI | Domain: ai-development
```
```
Learning: project-context.md over 500 lines causes Claude to lose focus — distillate down to ~200 lines.
Stack: AI | Domain: ai-development
```

---

### `architecture` — System Design
Assign this domain when the learning relates to: architecture decisions, data models, API design, module boundaries, service layers, or database schema.

**Example entries:**
```
Learning: Repository pattern requires a separate interface — never inject a concrete class directly into the service layer.
Stack: BE | Domain: architecture
```
```
Learning: Circular dependencies between modules typically appear when shared types are not extracted into their own module.
Stack: Common | Domain: architecture
```

---

### `testing` — Testing
Assign this domain when the learning relates to: unit tests, integration tests, E2E, coverage, mock/stub strategy, or test data management.

**Example entries:**
```
Learning: Tests must verify behavior, not implementation — if renaming a function breaks a test, the test is wrong.
Stack: Common | Domain: testing
```
```
Learning: Seed data must reset before each test suite — do not share state between test cases.
Stack: BE | Domain: testing
```

---

### `dev-environment` — Development Environment
Assign this domain when the learning relates to: local setup, Docker Compose, env variable management, port conflicts, onboarding, or dependency installation.

**Example entries:**
```
Learning: .env.example must stay in sync with .env — add a pre-commit hook to warn when a new key is missing from the example.
Stack: Common | Domain: dev-environment
```
```
Learning: docker compose up fails when port 5432 is taken by a local Postgres — document port mapping clearly in README.
Stack: DevOps | Domain: dev-environment
```

---

## Decision Rules for Ambiguous Cases

| Situation | Choose |
|---|---|
| Learning spans security + AI/LLM | `ai-development` if root cause is LLM-specific (prompt injection, unsafe model output); `security` if it is a standard app vulnerability (XSS, missing auth) |
| Learning spans cicd + testing | `cicd` if the issue is in the pipeline or build; `testing` if the issue is in how tests are written |
| Learning spans git + code-quality | `git` if it relates to workflow or process; `code-quality` if it relates to code content |
| Learning is very generic, applies everywhere | `code-quality` with `Stack: Common` |
| Does not clearly belong to any domain | Skip — do not fabricate a domain |

## Stack Tags

| Tag | When to Use |
|---|---|
| `Common` | Applies across both FE and BE |
| `FE` | React, Next.js, browser APIs, CSS |
| `BE` | API, database, server-side .NET |
| `AI` | LLM, prompt engineering, Claude/BMad agents |
| `DevOps` | Pipeline, deployment, infrastructure |
