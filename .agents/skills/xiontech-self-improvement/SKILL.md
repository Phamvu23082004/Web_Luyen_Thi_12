---
name: xiontech-self-improvement
description: Automatically reads conversation history, extracts knowledge learnings, and updates the X-Tek Wiki Knowledge Base. Use after each sprint or whenever you want to capture learnings from recent working sessions.
allowed-tools: Read, Bash, Grep, Glob, Task, Write, Edit
---

# XionTech Self-Improvement — Learn from History

Analyze Claude Code conversation history to extract knowledge learnings, cross-reference against the X-Tek Wiki Knowledge Base, and write new entries directly into the wiki file for developer review.

**Principle**: The Knowledge Base complements Tier-1 Company Standards — it does not duplicate or override them. Tier-1 = fixed company rules. Knowledge Base = lessons from real project experience.

## Overview

This skill mines `.jsonl` conversation files from Claude Code's project history, extracts project-specific learnings the team encountered while working, and appends them into the correct sections of the wiki's Knowledge Base file. The wiki file is updated locally — no commit or push happens automatically. The developer reviews the diff and commits when satisfied.

Two hard constraints apply throughout: **do not fabricate** learnings (only extract what is genuinely present in the conversation), and **do not add** entries that duplicate content already in Tier-1 Company Standards.

## When to Use

- After each sprint to automatically capture learnings
- After running `/bmad-review-adversarial-general` and fixing issues
- After resolving a complex bug or technical problem
- Weekly to keep the Knowledge Base continuously up to date

---

## Instructions

### Phase 1: Sync Wiki

Pull the latest wiki before making any updates to avoid conflicts.

```bash
WIKI_PATH="$(git rev-parse --show-toplevel)/X-Tek-Project.wiki"

if [ ! -d "$WIKI_PATH" ]; then
  echo "ERROR: Wiki directory not found at $WIKI_PATH"
  echo "Expected: <project-root>/X-Tek-Project.wiki"
  exit 1
fi

# Pull latest wiki
git -C "$WIKI_PATH" pull origin main 2>/dev/null || \
git -C "$WIKI_PATH" pull origin master 2>/dev/null || \
echo "Pull skipped or already up to date"

# Verify Knowledge Base file exists
ls "$WIKI_PATH/X%2DTek-Wiki/Knowledge-Base.md"
```

If pull fails (network issue), continue with the local version — do not stop.

---

### Phase 2: Discover & Analyze Conversations

**Argument handling** — parse any argument passed to the skill before doing anything else:

- `"last N days"` — only process `.jsonl` files modified in the last N days (use `find -mtime -N`)
- `"last N weeks"` — convert to days, apply same filter
- `"<domain>"` — after extraction, discard entries whose `domain` ≠ this value; valid values: `security`, `cicd`, `git`, `code-quality`, `ai-development`, `architecture`, `testing`, `dev-environment`
- *(no argument)* — process the 20 newest `.jsonl` files

Find conversation files:

```bash
PROJECTS_DIR="$HOME/.claude/projects/C--XionTech-X-Tek"

# List all .jsonl files sorted by modification time (newest first)
ls -lt "$PROJECTS_DIR"/*.jsonl 2>/dev/null | head -20

# If a time filter was provided (e.g., "last 3 days"):
# find "$PROJECTS_DIR" -name "*.jsonl" -mtime -3 | sort
```

Spawn Task agents (subagent_type: general-purpose) to analyze conversations in parallel. Prioritize files larger than 500KB — they contain the most substantive sessions.

Each agent reads one `.jsonl` file and extracts learnings using these five questions:

1. What technical problems or bugs were discussed and resolved?
2. What best practices or anti-patterns were identified?
3. What rules or conventions were established?
4. What issues with tools, libraries, or frameworks were encountered and solved?
5. Any findings from bmad review sessions?

After identifying each learning, read `references/extraction-signals.md` to classify it into the correct `domain` and `stack` tag.

For each learning found, return a JSON array:

```json
[
  {
    "slug": "unique-kebab-case-id-max-5-words",
    "domain": "security|cicd|git|code-quality|ai-development|architecture|testing|dev-environment",
    "stack": "Common|FE|BE|AI|DevOps",
    "learning": "The specific rule or pattern, written as a concise actionable rule",
    "context": "The specific situation in the conversation that produced this learning",
    "source": "Short quote (<100 chars) from the conversation as evidence"
  }
]
```

Return `[]` if no valuable learnings are found. Do NOT fabricate learnings — only extract what is genuinely present. Do NOT include general knowledge already covered in Tier-1 Company Standards.

---

### Phase 3: Synthesize

After all agents complete, combine findings:

- **Deduplicate within batch**: same or similar slug across agents → keep one (prefer better `source` quote)
- **Group by domain**: organize entries by domain for Phase 4 processing
- **Filter quality**: remove entries where `learning` is under 20 characters or not actionable
- **Generalize aggressively**: look for the meta-pattern behind specific instances
- **Apply domain filter**: if a domain argument was passed, discard entries with a different domain now

---

### Phase 4: Cross-Reference with Knowledge Base

Read current Knowledge Base:

```bash
cat "$WIKI_PATH/X%2DTek-Wiki/Knowledge-Base.md"
```

For each entry from Phase 3, classify:

- **Already documented** — `### [slug: {slug}]` found in KB, or `learning` very similar to existing entry → note location, skip
- **New entry** — not found → add to `new_entries` list under the correct domain section

---

### Phase 5: Write to Wiki (Local Only)

Append new entries into the correct section of Knowledge-Base.md, between the comment markers:

```
<!-- entries-start:{domain} -->
[existing entries remain untouched]
[new entries appended here]
<!-- entries-end:{domain} -->
```

Format for each new entry:

```markdown
### [slug: {slug}]
**Date**: {YYYY-MM-DD} | **Stack**: {stack} | **Domain**: {domain}
**Learning**: {learning}
**Context**: {context}
**Source**: *"{source}"*

```

Use the `Edit` tool to insert content between the correct markers — do not modify any existing entries. Do not run `git add`, `git commit`, or `git push`.

For each domain section, use this exact insertion pattern:
- `old_string`: `<!-- entries-end:{domain} -->`
- `new_string`: the new entry block followed by a real newline, then `<!-- entries-end:{domain} -->`

This appends new entries immediately before the closing marker while leaving all existing entries untouched.

After writing, output a summary report:

```markdown
## Self-Improvement Complete

Conversations analyzed: N
New entries added: M (Security: X | CI/CD: X | Code Quality: X | ...)
Already documented (skipped): K
Wiki file updated locally: X-Tek-Project.wiki/X%2DTek-Wiki/Knowledge-Base.md

## Next Step — Review & Commit

Wiki file updated locally. To review and commit:

  cd X-Tek-Project.wiki
  git diff "X%2DTek-Wiki/Knowledge-Base.md"
  git add "X%2DTek-Wiki/Knowledge-Base.md"
  git commit -m "knowledge: add M learnings [{DATE}]"
  git push origin HEAD
```

---

## Usage Examples

```
/xiontech-self-improvement
/xiontech-self-improvement last 3 days
/xiontech-self-improvement last 7 days
/xiontech-self-improvement security
```

## Red Flags

- The `source` quote in an entry does not appear in the actual conversation — sign of fabrication
- All entries from diverse conversations land in the same domain
- Entries read like generic textbook best practices, not project-specific learnings
- KB file has markers moved or modified instead of content inserted between them
- Summary count does not match the number of new entries actually written to the file

## Verification

After the skill completes:

- [ ] KB file has new entries inside the correct `<!-- entries-start:{domain} -->` markers
- [ ] No duplicate slugs in the KB file (`grep "\[slug:" Knowledge-Base.md | sort | uniq -d`)
- [ ] `git diff` on the wiki shows only additions, no modifications to existing entries
- [ ] Summary report count matches the number of new `### [slug:` lines added
- [ ] No `git push` was executed

## See Also

- `references/knowledge-taxonomy.md` — Domain mapping and standard entry format
- `references/extraction-signals.md` — Domain classification guide and stack tags
- `X-Tek-Project.wiki/X%2DTek-Wiki/Knowledge-Base.md` — Target wiki file
