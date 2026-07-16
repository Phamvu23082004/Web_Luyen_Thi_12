---
name: code-review-and-quality
description: Conducts multi-axis code review. Use before merging any change. Use when reviewing code written by yourself, another agent, or a human. Use when you need to assess code quality across multiple dimensions before it enters the main branch.
---

# Code Review and Quality

## Overview

Multi-dimensional code review with quality gates. Every change gets reviewed before merge — no exceptions. Review covers five axes: correctness, readability, architecture, security, and performance.

**The approval standard:** Approve a change when it definitely improves overall code health, even if it isn't perfect. Perfect code doesn't exist — the goal is continuous improvement. Don't block a change because it isn't exactly how you would have written it. If it improves the codebase and follows the project's conventions, approve it.

## When to Use

- Before merging any PR or change
- After completing a feature implementation
- When another agent or model produced code you need to evaluate
- When refactoring existing code
- After any bug fix (review both the fix and the regression test)

## The Five-Axis Review

Every review evaluates code across these dimensions:

### 1. Correctness

Does the code do what it claims to do?

- Does it match the spec or task requirements?
- Are edge cases handled (null, empty, boundary values)?
- Are error paths handled (not just the happy path)?
- Does it pass all tests? Are the tests actually testing the right things?
- Are there off-by-one errors, race conditions, or state inconsistencies?

### 2. Readability & Simplicity

Can another engineer (or agent) understand this code without the author explaining it?

**Required: conform to the project's coding conventions.** Before judging readability, load the conventions the project actually holds to — the `coding-standards` skill, a `coding-style.md` / style guide, or `CLAUDE.md` — and check the change against them (naming, immutability, error handling, file/function size, no hardcoded user-facing strings, etc.). Code that works but violates the agreed conventions is not done: flag each deviation as a required Readability finding, and when the fix is mechanical, hand it to `code-simplification`. Conventions are the floor, not a nice-to-have — consistency is what keeps the codebase reviewable at all.

- Are names descriptive and consistent with project conventions? (No `temp`, `data`, `result` without context — match the casing/prefix rules in the project's coding standards)
- Is the control flow straightforward (avoid nested ternaries, deep callbacks)?
- Is the code organized logically (related code grouped, clear module boundaries)?
- Are there any "clever" tricks that should be simplified?
- **Could this be done in fewer lines?** (1000 lines where 100 suffice is a failure)
- **Are abstractions earning their complexity?** (Don't generalize until the third use case)
- Would comments help clarify non-obvious intent? (But don't comment obvious code.)
- Are there dead code artifacts: no-op variables (`_unused`), backwards-compat shims, or `// removed` comments?

**Clean-code red flags (flag each as a required Readability finding; hand mechanical fixes to `code-simplification`):**

- **KISS** — simplest thing that works; no cleverness that needs a comment to decode.
- **DRY** — copy-pasted logic (rule of three) belongs in a shared function/component. But don't over-abstract a one-off — see YAGNI.
- **YAGNI** — no speculative generality, unused config knobs, or "we might need it" parameters. Build for the requirement in front of you.
- **Function length** — a function past ~50 lines or doing >1 job should be split.
- **Nesting depth** — 3+ levels of `if` nesting → use guard clauses / early returns.
- **Magic numbers/strings** — unexplained literals (`> 3`, `500`, `"active"`) → named constants or enums/unions.
- **Mutation** — defaults to immutable updates (spread, not in-place `push`/assignment); call out deliberate mutation with a why-comment.
- **Naming** — verb-noun functions (`fetchMarketData`), `is`/`has`/`should` booleans, no 1–2 letter identifiers in production code.
- **Error handling** — no swallowed errors, no happy-path-only async; failures surface or are handled, not ignored.

### 3. Architecture

Does the change fit the system's design?

- Does it follow existing patterns or introduce a new one? If new, is it justified?
- Does it maintain clean module boundaries?
- Is there code duplication that should be shared?
- Are dependencies flowing in the right direction (no circular dependencies)?
- Is the abstraction level appropriate (not over-engineered, not too coupled)?

**SOLID (apply pragmatically — a violation is a finding only when it hurts change-cost, not for purity):**

- **S — Single responsibility** — a module/function/component has one reason to change. A file mixing fetch + transform + render + persist is a split candidate.
- **O — Open/closed** — adding a case shouldn't mean editing a growing `switch`/`if-else` ladder in N places; prefer a table/registry/polymorphism the new case plugs into.
- **L — Liskov** — a subtype/implementation honors its interface's contract (no throwing on a method the base promises, no narrowing accepted inputs).
- **I — Interface segregation** — callers don't depend on props/methods they don't use; split fat interfaces (also catches passed-but-ignored props — dead plumbing).
- **D — Dependency inversion** — high-level logic depends on abstractions (injected client/repo), not concrete singletons; eases testing + swapping.

**Scalability (does it hold up as data, traffic, and the team grow?):**

- **Data growth** — list/query paths bounded (pagination, LIMIT, indexes)? No load-all-into-memory that breaks at 10×/100× rows.
- **Concurrency/throughput** — shared resources (DB pools, rate-limited APIs) not exhausted by per-request fan-out; expensive work is async/batched/cached.
- **Extensibility** — adding the next variant is a small additive change, not a cross-file edit storm (ties to Open/closed).
- **Statelessness** — no in-process state that breaks under multiple instances; deploy-able horizontally.
- **Boundaries** — clear seams between layers so modules can be changed/replaced in isolation as the codebase grows.

### 4. Security

For detailed security guidance, see `security-and-hardening`. Does the change introduce vulnerabilities?

- Is user input validated and sanitized?
- Are secrets kept out of code, logs, and version control — sourced from env vars / a secret manager, not hardcoded?
- Is authentication/authorization checked where needed?
- Are SQL queries parameterized (no string concatenation)?
- Are outputs encoded to prevent XSS?
- Are state-changing, cookie-authenticated requests CSRF-protected?
- Are public, expensive, or auth endpoints rate-limited (not just login)?
- Do error responses stay generic — no stack traces, SQL, or internal details leaked to the client?
- Are dependencies from trusted sources with no known vulnerabilities?
- Is data from external sources (APIs, logs, user content, config files) treated as untrusted?
- Are external data flows validated at system boundaries before use in logic or rendering?

**When you find a *live* vulnerability** (exposed secret, exploitable injection, missing auth on a real endpoint), don't just file it as another finding — follow the **Security Response Protocol** in `references/security-checklist.md`: stop, escalate to a focused security review, fix CRITICAL before continuing, rotate exposed secrets, and grep for the same vulnerability class elsewhere (one usually means several).

### 5. Performance

For detailed profiling and optimization, see `performance-optimization`. Does the change introduce performance problems?

- Any N+1 query patterns?
- Any unbounded loops or unconstrained data fetching?
- Any synchronous operations that should be async?
- Any unnecessary re-renders in UI components?
- Any missing pagination on list endpoints?
- Any large objects created in hot paths?

## Change Sizing

Small, focused changes are easier to review, faster to merge, and safer to deploy. Target these sizes:

```
~100 lines changed   → Good. Reviewable in one sitting.
~300 lines changed   → Acceptable if it's a single logical change.
~1000 lines changed  → Too large. Split it.
```

**What counts as "one change":** A single self-contained modification that addresses one thing, includes related tests, and keeps the system functional after submission. One part of a feature — not the whole feature.

**Splitting strategies when a change is too large:**

| Strategy | How | When |
|----------|-----|------|
| **Stack** | Submit a small change, start the next one based on it | Sequential dependencies |
| **By file group** | Separate changes for groups needing different reviewers | Cross-cutting concerns |
| **Horizontal** | Create shared code/stubs first, then consumers | Layered architecture |
| **Vertical** | Break into smaller full-stack slices of the feature | Feature work |

**When large changes are acceptable:** Complete file deletions and automated refactoring where the reviewer only needs to verify intent, not every line.

**Separate refactoring from feature work.** A change that refactors existing code and adds new behavior is two changes — submit them separately. Small cleanups (variable renaming) can be included at reviewer discretion.

## Change Descriptions

Every change needs a description that stands alone in version control history.

**First line:** Short, imperative, standalone. "Delete the FizzBuzz RPC" not "Deleting the FizzBuzz RPC." Must be informative enough that someone searching history can understand the change without reading the diff.

**Body:** What is changing and why. Include context, decisions, and reasoning not visible in the code itself. Link to bug numbers, benchmark results, or design docs where relevant. Acknowledge approach shortcomings when they exist.

**Anti-patterns:** "Fix bug," "Fix build," "Add patch," "Moving code from A to B," "Phase 1," "Add convenience functions."

## Review Process

### Step 1: Understand the Context

Before looking at code, understand the intent:

```
- What is this change trying to accomplish?
- What spec or task does it implement?
- What is the expected behavior change?
```

**Pin down the review target before reviewing.** Reviewing the wrong diff wastes the whole pass. Resolve what to review in this order, stopping at the first hit: (1) an explicit target the requester named — a PR, commit SHA, branch, or file list; (2) the target implied by the recent conversation; (3) the current branch's changes vs the base branch. If none of these is clear, ask rather than guess.

Then construct the diff to match the intended scope:

| Scope | Diff |
|-------|------|
| Staged changes only | `git diff --cached` |
| Uncommitted (staged + unstaged) | `git diff HEAD` |
| Branch vs base | `git diff <base>...HEAD` (verify `<base>` exists first) |
| Commit range | `git diff <from>..<to>` |
| Specific files | `git diff HEAD -- <paths>` (use `--no-index /dev/null <path>` for untracked files) |

Two guards before you start: if the diff is **empty**, there is nothing to review — say so instead of inventing findings. If it's **very large** (roughly 1000+ lines, or many unrelated files), the change should have been split (see Change Sizing) — review it in coherent file groups rather than one undifferentiated pass, and note which groups remain.

### Step 2: Review the Tests First

Tests reveal intent and coverage:

```
- Do tests exist for the change?
- Do they test behavior (not implementation details)?
- Are edge cases covered?
- Do tests have descriptive names?
- Would the tests catch a regression if the code changed?
```

### Step 3: Review the Implementation

Walk through the code with the five axes in mind:

```
For each file changed:
1. Correctness: Does this code do what the test says it should?
2. Readability: Can I understand this without help, and does it follow the project's coding conventions?
3. Architecture: Does this fit the system?
4. Security: Any vulnerabilities?
5. Performance: Any bottlenecks?
```

### Step 4: Categorize Findings

Label every comment with its severity so the author knows what's required vs optional:

| Prefix | Meaning | Author Action |
|--------|---------|---------------|
| *(no prefix)* | Required change | Must address before merge |
| **Critical:** | Blocks merge | Security vulnerability, data loss, broken functionality |
| **Nit:** | Minor, optional | Author may ignore — formatting, style preferences |
| **Optional:** / **Consider:** | Suggestion | Worth considering but not required |
| **FYI** | Informational only | No action needed — context for future reference |

This prevents authors from treating all feedback as mandatory and wasting time on optional suggestions.

**Severity says how serious; triage says what happens next.** Especially when you've collected findings from several reviewers, sort each one into exactly one action bucket so the path to resolution is unambiguous:

| Bucket | Meaning | Next action |
|--------|---------|-------------|
| **Patch** | Clear code issue with an unambiguous fix | Fix it — no human decision required |
| **Decision needed** | A real issue, but the right fix depends on intent the reviewer can't infer | Surface the options; the author/owner chooses before any patch lands |
| **Defer** | Genuine but pre-existing — not caused by this change | Record it (file a tracked item); don't block this change on it |
| **Dismiss** | Noise, false positive, or already handled elsewhere | Drop it — but keep a count, so a flood of dismissals signals a noisy reviewer |

Resolve **decision-needed** items before applying patches — a patch built on the wrong assumption is wasted work. Don't silently expand scope to fix **defer** items inside this change; that's how a focused review balloons into an unreviewable one.

### Step 5: Verify the Verification

Check the author's verification story:

```
- What tests were run?
- Did the build pass?
- Was the change tested manually?
- Are there screenshots for UI changes?
- Is there a before/after comparison?
```

## Multi-Model Review Pattern

Use different models for different review perspectives:

```
Model A writes the code
    │
    ▼
Model B reviews for correctness and architecture
    │
    ▼
Model A addresses the feedback
    │
    ▼
Human makes the final call
```

This catches issues that a single model might miss — different models have different blind spots.

**Example prompt for a review agent:**
```
Review this code change for correctness, security, and adherence to
our project conventions. The spec says [X]. The change should [Y].
Flag any issues as Critical, Important, or Suggestion.
```

### Adversarial Parallel Review

For high-stakes changes, run several reviewers **in parallel**, each given a deliberately *different* amount of context. The point is to engineer different blind spots — a reviewer who knows the author's intent tends to rationalize the code into matching it, so you also want one who has never seen the intent. Launch them concurrently and merge the results.

| Layer | What it sees | What it catches |
|-------|--------------|-----------------|
| **Blind reviewer** | The diff *only* — no spec, no context, no repo access | Code that's confusing or wrong on its own terms. With no intent to anchor to, it can't excuse a problem as "probably fine because the goal is X." |
| **Edge-case reviewer** | The diff + read access to the repo | Boundary and trigger conditions: nulls, empties, concurrency, the input that makes a guard fail. Needs the surrounding code to reason about call sites. |
| **Acceptance auditor** | The diff + the spec / acceptance criteria + design docs | Spec violations: criteria not met, behavior that contradicts the spec, specified work that's missing. Skip this layer when there is no spec. |

**Merging the results:**

- **Deduplicate.** When two reviewers flag the same issue, merge into one finding — keep the most specific version (the one with a file:line), fold in any extra reasoning, and note that multiple reviewers raised it (independent agreement raises confidence).
- **Don't declare "clean" on partial coverage.** If a reviewer errored, timed out, or returned nothing, say which one and that the review is *incomplete* — an empty result is not the same as "no issues found." A clean verdict requires every layer to have actually run.

## Dead Code Hygiene

After any refactoring or implementation change, check for orphaned code:

1. Identify code that is now unreachable or unused
2. List it explicitly
3. **Ask before deleting:** "Should I remove these now-unused elements: [list]?"

Don't leave dead code lying around — it confuses future readers and agents. But don't silently delete things you're not sure about. When in doubt, ask.

```
DEAD CODE IDENTIFIED:
- formatLegacyDate() in src/utils/date.ts — replaced by formatDate()
- OldTaskCard component in src/components/ — replaced by TaskCard
- LEGACY_API_URL constant in src/config.ts — no remaining references
→ Safe to remove these?
```

## Review Speed

Slow reviews block entire teams. The cost of context-switching to review is less than the waiting cost imposed on others.

- **Respond within one business day** — this is the maximum, not the target
- **Ideal cadence:** Respond shortly after a review request arrives, unless deep in focused coding. A typical change should complete multiple review rounds in a single day
- **Prioritize fast individual responses** over quick final approval. Quick feedback reduces frustration even if multiple rounds are needed
- **Large changes:** Ask the author to split them rather than reviewing one massive changeset

## Handling Disagreements

When resolving review disputes, apply this hierarchy:

1. **Technical facts and data** override opinions and preferences
2. **Style guides** are the absolute authority on style matters
3. **Software design** must be evaluated on engineering principles, not personal preference
4. **Codebase consistency** is acceptable if it doesn't degrade overall health

**Don't accept "I'll clean it up later."** Experience shows deferred cleanup rarely happens. Require cleanup before submission unless it's a genuine emergency. If surrounding issues can't be addressed in this change, require filing a bug with self-assignment.

## Honesty in Review

When reviewing code — whether written by you, another agent, or a human:

- **Don't rubber-stamp.** "LGTM" without evidence of review helps no one.
- **Don't soften real issues.** "This might be a minor concern" when it's a bug that will hit production is dishonest.
- **Quantify problems when possible.** "This N+1 query will add ~50ms per item in the list" is better than "this could be slow."
- **Push back on approaches with clear problems.** Sycophancy is a failure mode in reviews. If the implementation has issues, say so directly and propose alternatives.
- **Accept override gracefully.** If the author has full context and disagrees, defer to their judgment. Comment on code, not people — reframe personal critiques to focus on the code itself.

## Dependency Discipline

Part of code review is dependency review:

**Before adding any dependency:**
1. Does the existing stack solve this? (Often it does.)
2. How large is the dependency? (Check bundle impact.)
3. Is it actively maintained? (Check last commit, open issues.)
4. Does it have known vulnerabilities? (`npm audit`)
5. What's the license? (Must be compatible with the project.)

**Rule:** Prefer standard library and existing utilities over new dependencies. Every dependency is a liability.

## The Review Checklist

```markdown
## Review: [PR/Change title]

### Context
- [ ] I understand what this change does and why

### Correctness
- [ ] Change matches spec/task requirements
- [ ] Edge cases handled
- [ ] Error paths handled
- [ ] Tests cover the change adequately

### Readability
- [ ] Conforms to the project's coding conventions (coding-standards / coding-style.md / CLAUDE.md) — deviations flagged
- [ ] Names are clear and consistent (verb-noun fns, `is`/`has` bools, no 1–2 letter ids)
- [ ] Logic is straightforward (guard clauses over deep nesting; no magic numbers)
- [ ] No unnecessary complexity (KISS / DRY / YAGNI; functions ≤ ~50 lines)
- [ ] Immutable updates by default; errors handled, not swallowed

### Architecture
- [ ] Follows existing patterns
- [ ] No unnecessary coupling or dependencies
- [ ] Appropriate abstraction level
- [ ] SOLID respected where it affects change-cost (esp. single-responsibility, open/closed, dependency inversion)
- [ ] Scalable — bounded queries/pagination, no shared-pool exhaustion, extensible without cross-file edits

### Security
- [ ] No secrets in code (env vars / secret manager; exposed secrets rotated)
- [ ] Input validated at boundaries
- [ ] No injection vulnerabilities (parameterized queries, encoded output)
- [ ] Auth checks in place; CSRF protection on state-changing requests
- [ ] Rate limiting on public/expensive/auth endpoints
- [ ] Error responses don't leak internals
- [ ] External data sources treated as untrusted

### Performance
- [ ] No N+1 patterns
- [ ] No unbounded operations
- [ ] Pagination on list endpoints

### Verification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Manual verification done (if applicable)

### Verdict
- [ ] **Approve** — Ready to merge
- [ ] **Request changes** — Issues must be addressed
```
## See Also

- For detailed security review guidance, see `references/security-checklist.md`
- For performance review checks, see `references/performance-checklist.md`

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "It works, that's good enough" | Working code that's unreadable, insecure, or architecturally wrong creates debt that compounds. |
| "I wrote it, so I know it's correct" | Authors are blind to their own assumptions. Every change benefits from another set of eyes. |
| "We'll clean it up later" | Later never comes. The review is the quality gate — use it. Require cleanup before merge, not after. |
| "AI-generated code is probably fine" | AI code needs more scrutiny, not less. It's confident and plausible, even when wrong. |
| "The tests pass, so it's good" | Tests are necessary but not sufficient. They don't catch architecture problems, security issues, or readability concerns. |

## Red Flags

- PRs merged without any review
- Review that only checks if tests pass (ignoring other axes)
- "LGTM" without evidence of actual review
- Security-sensitive changes without security-focused review
- Large PRs that are "too big to review properly" (split them)
- No regression tests with bug fix PRs
- Review comments without severity labels — makes it unclear what's required vs optional
- Accepting "I'll fix it later" — it never happens
- Declaring a "clean review" when a reviewer (or review layer) errored or returned nothing — incomplete coverage is not the same as no issues
- Reviewing without ever loading the project's coding conventions — you can't enforce a standard you haven't read

## Verification

After review is complete:

- [ ] All Critical issues are resolved
- [ ] All Important issues are resolved or explicitly deferred with justification
- [ ] Tests pass
- [ ] Build succeeds
- [ ] The verification story is documented (what changed, how it was verified)
