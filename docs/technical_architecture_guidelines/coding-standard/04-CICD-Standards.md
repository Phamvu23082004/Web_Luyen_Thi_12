# 04 — CI/CD Standards

## Principle

Every project has automated checks that run on every push and PR. No code reaches the primary branch without passing these checks. The pipeline should be fast enough that developers don't context-switch while waiting.

## Default Pipeline

### Minimum CI (every project, no exceptions)

```
Push/PR → Install → Lint → Typecheck/Compile → Test → [Build]
```

| Stage | What It Does | Max Duration |
|-------|-------------|-------------|
| Install | Install dependencies from lockfile | 60s |
| Lint | Code style and static analysis | 30s |
| Typecheck/Compile | Type validation or compilation check | 30s |
| Test | Run test suite (unit + integration) | 5 min |
| Code Quality gate keeper (SonarQube) | Clean-as-You-Code scan on new code: security, duplication, coverage; decorates the PR | 2 min |
| Build | Compile/bundle (optional on PRs, required on main) | 2 min |
| E2E / visual regression | Playwright E2E (+ visual-regression snapshots) on critical flows | 5 min |

**Target total pipeline time: under 17 minutes.** If it's slower, investigate and optimize. Slow pipelines kill developer productivity.

For dynamically-typed languages without a compile step (e.g., Python, Ruby), replace Typecheck/Compile with additional static analysis (e.g., mypy, type hints).

> The merge button stays **locked until every required check is green** (Azure Repos branch policy). A failed check ⟶ fix and re-push; there is no manual override of a red gate.

### Pipeline Design Rules

1. **Fail fast** — Run lint and type checks before tests. No point running a 5-minute test suite if there's a syntax error.
2. **Parallel when possible** — Lint and type checks can run in parallel. Tests that don't share state can run in parallel.
3. **Deterministic** — Same code, same result. No flaky tests. A test that fails intermittently is a bug — fix it or remove it.
4. **Lockfile required** — Always install from a lockfile or equivalent. Never let CI resolve different dependency versions than development. Each ecosystem has its own mechanism:
   - .NET: `dotnet restore --locked-mode`
   - Python: `pip install -r requirements.txt` (pinned), `poetry install --no-update`
   - Node.js: `pnpm install --frozen-lockfile`, `npm ci`
5. **The pipeline is the wall, not the hook.** Local pre-commit hooks are developer convenience. Enforcement lives in CI: branch policy blocks merge until all required checks pass.

### Merge Blocking

**These block merge to the primary branch:**
- Lint failures
- Type/compilation errors
- Must-have test failures (as defined in the project's Tier 2 testing strategy)

**These warn but don't block:**
- Nice-to-have test failures (project decides threshold)
- Coverage decreases (if coverage tracking is enabled)

### CD (Deployment)

CD is project-specific — document in Tier 2. The Tier 1 principles:

1. **Deployment is automated** — No manual SSH, no manual file copying. Every deployment is triggered by a script, pipeline, or container build.
2. **Deployments are reproducible** — The same commit always produces the same artifact.
3. **Rollback is possible** — Every deployment strategy must have a documented rollback procedure.

### Environment Strategy

| Environment | Purpose | Deployed From | Who Uses |
|------------|---------|---------------|----------|
| Local | Developer machine | Working copy | Individual developer |
| Test/Staging | Integration testing, QA | `main` or `develop` (auto) | Team, QA |
| Production | Live users | Tagged release or `main` (manual trigger) | End users |

**Minimum**: Local + Production.
**Recommended**: Local + Staging + Production.

### CI/CD Platform

**Default**: Azure DevOps (Azure Pipelines) — this is Xiontech's primary development workspace.

Projects may use other platforms when required (GitHub Actions for open-source, GitLab CI for specific clients). Document the chosen platform in the project's Tier 2 standards.

| Platform | Pipeline Config | Secrets | Branch Policies |
|----------|----------------|---------|----------------|
| Azure DevOps | `azure-pipelines.yml` at repo root | Pipeline Variables / Variable Groups / Azure Key Vault | Branch policies on PR (build validation, required reviewers) |
| GitHub | `.github/workflows/*.yml` | Repository / Environment Secrets | Branch protection rules |
| GitLab | `.gitlab-ci.yml` | CI/CD Variables | Protected branches + merge request approvals |

Regardless of platform, the pipeline stages and design rules above apply.

### Secrets Management

- **Never** commit secrets to the repository (API keys, passwords, tokens)
- Use CI/CD platform secrets (Azure DevOps Variable Groups, GitHub Secrets, GitLab CI Variables)
- For production, prefer a secret manager (Azure Key Vault, AWS Secrets Manager, HashiCorp Vault) over platform variables
- Provide a template file (e.g., `.env.example`, `config.example.yaml`) with placeholder values to document required variables
- Production secrets should be managed through the deployment platform (environment variables, secret managers)

### AI-Assisted Review in CI/CD

Claude Code's `/code-review` plugin can automatically review PRs and post comments — but currently **only supports GitHub** (requires `gh` CLI). It is not yet compatible with Azure DevOps or GitLab.

**Current approach for Azure DevOps projects:**
- AI code review is a **local developer workflow** (pre-PR), not a CI pipeline step
- Developers run Claude Code's PR Review Toolkit agents locally before creating PRs
- BMad adversarial review is used at quality gates for critical modules
- See [03-code-review.md](03-Code-Review) for the full AI-assisted review workflow

**For GitHub-hosted projects** (open-source, specific clients):
- `/code-review --comment` can be added as a CI step to auto-post review comments on PRs
- This supplements — does not replace — human peer review

**Future**: When Claude Code adds Azure DevOps support, integrate `/code-review` into Azure Pipelines as a PR build validation step. Update this document and [03-code-review.md](03-Code-Review) accordingly.

### Monitoring CI Health

- If the primary branch CI is red, fixing it is the **top priority** — above all feature work
- Track CI failure rate monthly. If >5% of runs fail for non-code reasons (infra, flaky tests), invest in pipeline stability
