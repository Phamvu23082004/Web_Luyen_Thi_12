# Claude Code Skills — Install Checklist

Every project from this skeleton ships the X-Tek company skills under `.agents/skills/`.
Claude Code does **not** read `.agents/skills/` directly — each skill must be linked into a
skills directory Claude Code scans (`~/.claude/skills/` global, or `<repo>/.claude/skills/`
project-local). Use this file to confirm a teammate has all skills installed.

## 1. Install (one command)

Run from the repo root. Symlinks every company skill into the **project** skills dir
(`.claude/skills/`) so the whole team gets the same set:

```bash
mkdir -p .claude/skills
for s in .agents/skills/*/; do
  name=$(basename "$s")
  [ -f "$s/SKILL.md" ] || continue
  ln -sfn "../../.agents/skills/$name" ".claude/skills/$name"
done
```

> Prefer global install instead? Swap target dir for `~/.claude/skills/` and the
> link target for an absolute path to this repo's `.agents/skills/<name>`.

## 2. Verify (one command)

Prints `OK` / `MISSING` per skill. All must be `OK`:

```bash
for name in code-review-and-quality code-simplification coding-standards \
            modern-css performance-optimization security-and-hardening \
            xiontech-self-improvement; do
  if [ -f ".claude/skills/$name/SKILL.md" ] || [ -f "$HOME/.claude/skills/$name/SKILL.md" ]; then
    echo "OK       $name"
  else
    echo "MISSING  $name"
  fi
done
```

Then in Claude Code, run `/help` or check the skills list — each name below should appear.

## 3. Manual checklist

Source of truth: `.agents/skills/<name>/SKILL.md`. Tick when the skill is installed
(present in `.claude/skills/` **or** `~/.claude/skills/`) **and** shows up in Claude Code.

| ✓ | Skill | Purpose |
|---|-------|---------|
| [ ] | `code-review-and-quality` | Multi-axis code review before merging any change. |
| [ ] | `code-simplification` | Refactor for clarity without changing behavior. |
| [ ] | `coding-standards` | Baseline naming, readability, immutability conventions. |
| [ ] | `modern-css` | Modern CSS: container queries, OKLCH, theming, animations. |
| [ ] | `performance-optimization` | Find and fix performance regressions / Core Web Vitals. |
| [ ] | `security-and-hardening` | Harden against vulnerabilities; untrusted input, auth, storage. |
| [ ] | `xiontech-self-improvement` | Capture sprint learnings into the X-Tek Wiki KB. |

## 3b. Third-party skills (plugin / CLI install)

These are external upstreams — **not** vendored into `.agents/skills/`. They ship their own
runtimes (CLI, hooks) and update cadence, so install via their own installers, not the symlink
loop in §1. Run from the **project root**; choose project or global scope when prompted.

| ✓ | Skill | Install | Verify |
|---|-------|---------|--------|
| [ ] | `impeccable` — design fluency (audit/critique/polish, 23 `/impeccable …` commands + hooks) | `npx impeccable install` then `/impeccable init` inside Claude Code | `/impeccable` commands appear; `/help` lists `impeccable` |
| [ ] | `dev-browser` — browser automation CLI (navigate, screenshot, scrape, e2e) | `npm install -g dev-browser` then `dev-browser install` (installs Playwright + Chromium) | `dev-browser --help` runs |
| [ ] | `design-taste-frontend` — anti-slop frontend taste (landing/portfolio/redesign) | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` | `/help` lists `design-taste-frontend` |
| [ ] | `frontend-design` — Anthropic's distinctive-UI design guidance (typography, aesthetic direction) | `npx skills add anthropics/skills --skill "frontend-design"` | `/help` lists `frontend-design` |
| [ ] | `vercel-react-best-practices` — React/Next.js performance patterns from Vercel Eng | `npx skills add vercel-labs/agent-skills --skill "vercel-react-best-practices"` | `/help` lists `vercel-react-best-practices` |
| [ ] | `ui-ux-pro-max` — UI/UX design intelligence (styles, palettes, font pairings, charts, per-stack) | `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` | `/help` lists `ui-ux-pro-max` |

Notes:
- **impeccable** also supports a vendored git-submodule install (`npx impeccable link …`) if a
  project must keep it offline/pinned — see its README Option 2.
- **dev-browser** needs no skill/plugin file — the global CLI is the whole integration; the agent
  self-documents via `dev-browser --help`. Optionally pre-approve it in Claude Code settings
  `allow` to skip permission prompts.
- **taste-skill** repo bundles 13 skills; install only `design-taste-frontend` (the `--skill`
  flag). Re-run the same command to upgrade.
- **anthropics/skills** and **vercel-labs/agent-skills** are multi-skill repos — the `--skill`
  flag pulls just the named one. Drop the flag to install the whole set (not recommended here).
- **ui-ux-pro-max** alt: CLI install `npm install -g ui-ux-pro-max-cli` then
  `uipro init --ai claude --global` (writes to `~/.claude/skills/`); `uipro update` to refresh.
  The marketplace `/plugin` route above is simpler for Claude Code.

## 3c. Agent MCP tools

Not skills — MCP servers that give the agent extra capability. Wired into Claude Code via
its MCP config, then indexed/configured per project.

| ✓ | Tool | Install | Verify |
|---|------|---------|--------|
| [ ] | `codegraph` — code-intelligence knowledge graph (symbols, callers/callees, impact) | 1. CLI: `npm i -g @colbymchenry/codegraph` (or `curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh \| sh`)  2. Wire agents (global): `codegraph install`  3. Per project: `codegraph init` | `codegraph status` in the repo; MCP `codegraph_*` tools appear in Claude Code |

Notes:
- One `codegraph install` covers every project; run `codegraph init` **once per repo** to build
  that repo's graph. A file watcher keeps it fresh as you code.
- Shortcut: `npx @colbymchenry/codegraph` runs the agent-wiring installer in one go.
- The installer adds a marker-fenced CodeGraph block to `CLAUDE.md`/`AGENTS.md` — leave it; it
  teaches subagents the `codegraph explore` command. Removed cleanly by `codegraph uninstall`.
- **Gitignore the index**: add `.codegraph/` to `.gitignore` — it holds a large local SQLite DB
  (`codegraph.db`, tens of MB) + daemon socket/pid, per-machine, never commit.

## 4. Project setup (also required)

These ship in the skeleton already — confirm they exist and are filled per project:

- [ ] `CLAUDE.md` — Claude Code entry point (references `project-context.md` + `docs/PROJECT-STANDARDS.md`).
- [ ] `project-context.md` — AI implementation rules (replace placeholder with the Tier 2 stack example).
- [ ] `docs/PROJECT-STANDARDS.md` — single source of truth, filled per project.

---

**Adding a new company skill?** Drop it under `.agents/skills/<name>/SKILL.md`, then add a
row to the table in §3 and its name to the loop in §2. Keep this checklist in sync.
