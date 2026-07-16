# 08 — Quality Gates & Release Process

## Principle

Quality is built in, not inspected in. Every phase of development has a "definition of done" that must be met before moving forward. Releases are deliberate, tested, and reversible.

## Definition of Done — Per Level

### Task Done (individual work item)

A task is done when:
- [ ] Code compiles and passes lint + typecheck
- [ ] Code follows the project's module/architecture conventions
- [ ] Business logic has test coverage for happy path + key edge cases
- [ ] No security warnings introduced (no raw SQL, no exposed secrets, auth checks in place)
- [ ] PR created with clear description

### Sprint Done (iteration milestone)

A sprint is done when:
- [ ] All committed tasks meet "Task Done" criteria
- [ ] CI pipeline is green on the primary branch
- [ ] No critical or high-severity bugs remain open
- [ ] New features are demo-able (even if behind feature flags)
- [ ] Sprint retrospective notes captured (what worked, what didn't)

### Release Done (production deployment)

A release is done when:
- [ ] All sprint-done criteria met
- [ ] Integration tests pass end-to-end
- [ ] Security-sensitive modules have been reviewed (human + optionally BMad adversarial)
- [ ] Database migrations tested against a copy of production data (or realistic seed data)
- [ ] Release notes documented (what changed, any breaking changes)
- [ ] Rollback procedure verified
- [ ] Deployment to staging/pre-production verified
- [ ] Stakeholder sign-off (product owner or client)

## Quality Gates by Phase

### Gate 1: Pre-PR (Developer Self-Check)

Before creating a PR, the developer verifies:
1. `pnpm lint` — passes
2. `pnpm typecheck` — passes
3. `pnpm test` — passes (at minimum, tests related to changed code)
4. Self-review of diff — no debug code, no commented-out code, no TODOs without ticket references

**Automation**: Pre-commit hooks can enforce lint and typecheck. Pre-push hooks can run tests.

**Pre-commit is convenience; CI is the wall.** A pre-commit hook (Husky + lint-staged → formatter/linter `--write`) exists to catch the obvious locally and keep diffs clean. It is a convenience, not the enforcement boundary. The authoritative gate is CI — it runs on every PR, cannot be bypassed with `--no-verify`, and blocks merge until green.

### Gate 2: PR Review (Peer Check)

See [03-code-review.md](03-Code-Review) for full process. Summary:
1. CI passes
2. At least 1 peer approval
3. All blocking comments resolved
4. Security review for auth/data changes

### Gate 2.5: AI Review Layers (before human review)

On top of human peer review, two automated layers run on **100% of PRs** so nothing reaches a human reviewer unscreened:

| Layer | What it does | Blocking? |
|-------|-------------|-----------|
| **QA-agent review** | BMAD adversarial pass over the diff — hunts defects, edge cases, missing tests | Findings triaged; criticals block |
| **AI PR reviewer** | Spins up a sandbox, reviews the full PR, posts inline findings | Advisory → human resolves |

These do not replace the human approver (Gate 2 still requires **≥1 human approval, non-negotiable**). They raise the floor: every PR is machine-reviewed before a human spends time on it.

### Gate 3: Pre-Release (Integration Check)

Before deploying to production:
1. Full test suite passes on the release candidate
2. Database migration runs cleanly against staging data
3. Manual smoke test of critical user flows (login, core business operations)
4. Performance sanity check (no obvious regressions in response times)

### Gate 4: Post-Release (Production Verification)

After deploying to production:
1. Health check endpoint returns OK
2. Smoke test critical flows in production
3. Monitor error rates for 30 minutes post-deploy
4. Confirm rollback procedure is ready if needed

## Testing Standards (Company-Wide)

### Philosophy: Test What Breaks You

Not everything needs 100% coverage. Focus testing effort where failures are most costly:

| Priority | What to Test | Why |
|----------|-------------|-----|
| **Must-have** | Business logic (calculations, state machines, validations) | Bugs here = wrong data, wrong money, wrong state |
| **Must-have** | Authentication and authorization | Bugs here = security breach |
| **Must-have** | Data integrity (transactions, concurrent access) | Bugs here = corrupted data |
| **Should-have** | API endpoints (request/response contracts) | Bugs here = broken integrations |
| **Nice-to-have** | CRUD operations, UI components | Usually low-risk, caught by manual testing |

### Test Types

| Type | Scope | Speed | When to Write |
|------|-------|-------|--------------|
| Unit | Single function/module | <1s | For business logic, utilities, pure functions |
| Integration | Multiple modules + database | 1-10s | For services that coordinate across layers |
| API/E2E | Full HTTP request lifecycle | 1-30s | For critical user flows |

### Naming Convention

```
describe('LeaveBalanceService', () => {
  describe('reserveBalance', () => {
    it('should deduct from available balance when sufficient', () => ...);
    it('should throw INSUFFICIENT_BALANCE when days exceed available', () => ...);
    it('should handle concurrent reservations with row locking', () => ...);
  });
});
```

Pattern: `describe(Unit) > describe(Method) > it(should behavior when condition)`

## Release Process

### Versioning: Semantic Versioning

```
MAJOR.MINOR.PATCH
```

- **MAJOR**: Breaking changes (API contracts changed, migration required)
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible

### Release Flow

```
1. Create release branch:  release/v1.2.0
2. Final testing on release branch
3. Fix any issues found (on release branch)
4. Tag:  git tag v1.2.0
5. Merge release branch → main
6. Deploy from tag
7. Delete release branch
```

For small projects or continuous deployment: skip the release branch, deploy from tagged commits on main.

### Hotfix Flow

```
1. Create hotfix branch from main:  hotfix/v1.2.1
2. Fix the issue
3. Test thoroughly
4. Tag:  git tag v1.2.1
5. Merge → main
6. Deploy immediately
7. Cherry-pick to develop (if develop branch exists)
```

### Release Notes Template

```markdown
## v1.2.0 — 2026-04-15

### Added
- Two-step authentication with SSO support
- Leave approval delegation

### Changed
- Improved balance calculation performance

### Fixed
- Race condition in concurrent leave submissions

### Security
- Added rate limiting on auth endpoints

### Breaking Changes
- Error response format changed from {message} to {code}
  Migration: Update frontend error handlers to use i18n lookup
```

## Continuous Improvement

After each release:
1. **What bugs escaped?** — Should we add a test or gate for this?
2. **What was manual that could be automated?** — Improve the pipeline
3. **What took too long?** — Streamline the process
4. **What review caught a real issue?** — Reinforce that pattern

Document learnings and update these standards quarterly.
