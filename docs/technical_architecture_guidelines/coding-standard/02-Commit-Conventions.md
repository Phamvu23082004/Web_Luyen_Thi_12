# 02 — Commit Conventions

## Principle

Commit messages are communication. A well-structured commit history tells the story of a project — what changed, why, and when. Consistent formatting enables automated tooling (changelogs, release notes, impact analysis).

## Default: Conventional Commits

Format:

```
<type>(<scope>): <subject>

<body>          ← optional
<footer>        ← optional
```

### Types

| Type | When to Use | Example |
|------|-------------|---------|
| `feat` | New feature or capability | `feat(auth): add two-step login flow` |
| `fix` | Bug fix | `fix(balance): correct race condition in concurrent reservations` |
| `refactor` | Code change that neither fixes a bug nor adds a feature | `refactor(leave): extract validation into separate service` |
| `perf` | Performance improvement | `perf(query): add index for leave request lookup` |
| `test` | Adding or updating tests | `test(policy): add entitlement bracket edge cases` |
| `docs` | Documentation changes | `docs(api): update endpoint reference for v1.2` |
| `chore` | Build process, tooling, dependencies | `chore(deps): update prisma to 6.20` |
| `ci` | CI/CD configuration changes | `ci: add PostgreSQL service to test workflow` |
| `style` | Formatting, whitespace (no logic change) | `style: apply prettier to shared package` |

### Scope

Optional but encouraged. Use the module or area name:
- `auth`, `leave`, `balance`, `employee`, `policy`, `notification`
- `db` for migrations, `ci` for pipeline, `docker` for container changes

### Subject Line Rules

1. **Imperative mood** — "add feature" not "added feature" or "adds feature"
2. **Lowercase** — no capital first letter
3. **No period** at the end
4. **Max 72 characters** — be concise; use the body for details
5. **What, not how** — "add two-step login" not "create identify and login endpoints with JWT"

### Body (Optional)

Use when the subject line isn't enough to explain *why* the change was made. Wrap at 72 characters.

```
fix(balance): correct race condition in concurrent reservations

Multiple simultaneous leave submissions could bypass the available
balance check because SELECT FOR UPDATE was not applied before
the balance validation step. Now the summary row is locked before
reading available balance.
```

### Footer (Optional)

For references and breaking changes:

```
feat(api): change error response format to use error codes

BREAKING CHANGE: Error responses now return {error: {code, details}}
instead of {error: {message, details}}. Frontend must update error
handling to use i18n lookup on error codes.

Refs: ESS-42
```

### AI-Generated Commits

When Claude Code or other AI tools generate commits:
- The human developer is responsible for reviewing the commit message before accepting
- AI should generate the commit message following these conventions
- If the AI-generated message doesn't adequately describe the change, the developer rewrites it

### What Makes a Good Commit

**One logical change per commit.** If you find yourself writing "and" in the subject line, consider splitting into two commits.

Good:
- `feat(auth): add password policy validation`
- `feat(auth): add account lockout after failed attempts`

Bad:
- `feat(auth): add password policy and account lockout and session management`

### Enforcement

- **Pre-commit hook** (recommended): Use `commitlint` with `@commitlint/config-conventional` to validate commit message format before allowing the commit.
- **CI check** (fallback): Validate commit messages in the CI pipeline for PRs.
- Each project documents in Tier 2 whether they use hooks, CI checks, or both.
