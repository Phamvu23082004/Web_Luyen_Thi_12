# 01 — Git Workflow & Branching Strategy

## Principle

Every project uses a consistent, predictable git workflow so that any developer can move between projects without relearning how branches work, how code gets to production, or where to find stable code.

## Default: Trunk-Based Development with Feature Branches

```
main (always deployable)
  ├── feature/ABC-123-add-login
  ├── feature/ABC-456-leave-balance
  ├── fix/ABC-789-date-calculation
  └── release/v1.2.0 (optional, only for staged rollouts)
```

### Branches

| Branch | Purpose | Who Creates | Lifetime |
|--------|---------|------------|----------|
| `main` | Production-ready code. Always deployable. | Exists from project start | Permanent |
| `develop` | Integration branch (optional — use only if the project requires staged releases) | Tech lead at project kickoff | Permanent |
| `feature/*` | New functionality | Any developer | Days (merge within 1 sprint) |
| `fix/*` | Bug fixes | Any developer | Hours to days |
| `release/*` | Release stabilization | Tech lead | Days (delete after release) |
| `hotfix/*` | Critical production fix | Senior dev / tech lead | Hours |

### Branch Naming

Format: `{type}/{ticket-id}-{short-description}`

- `feature/ESS-42-two-step-auth`
- `fix/ESS-108-balance-race-condition`
- `hotfix/ESS-200-csrf-token-stale`
- `release/v1.0.0`

If the project has no ticket system yet, omit the ticket ID: `feature/two-step-auth`.

### Rules

1. **Never commit directly to `main`** — all changes go through feature branches + pull requests.
2. **Keep feature branches short-lived** — ideally merge within 1-3 days. If a feature takes longer, break it into smaller branches.
3. **Rebase before merging** — keep the commit history linear. Use `git rebase main` on your feature branch before creating a PR.
4. **Delete branches after merge** — no stale branches cluttering the repo.
5. **One concern per branch** — don't mix a feature with an unrelated refactor. Separate branches for separate concerns.

### Merge Strategy

**Default: Squash merge** for feature branches into `main`.
- Keeps main history clean — one commit per feature/fix.
- The full branch history is preserved in the PR for reference.

**Exception: Merge commit** for release branches (preserves the release boundary in history).

### When to Use `develop` Branch

Only when the project requires staged releases where multiple features must be tested together before going to production. Most projects should merge directly to `main` with feature flags or release tags.

**Decision**: Each project documents this choice in their Tier 2 standards.

## Adaptation for Outsourcing

If a client mandates a specific git workflow (e.g., Gitflow, GitHub Flow), follow the client's process. Document the deviation in the project's Tier 2 standards. The Tier 1 principles still apply:
- No direct commits to the primary branch
- PRs for all changes
- Short-lived feature branches
- Clean branch naming
