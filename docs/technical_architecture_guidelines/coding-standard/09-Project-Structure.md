# 09 — Standard Project Structure

## Principle

Every project at Xiontech starts from the same structural foundation — the AI-assisted development scaffolding. This structure ensures BMad workflows, Claude Code configuration, documentation, and quality processes are in place from day one, regardless of the tech stack.

The tech stack lives *inside* this structure. The structure itself is stack-agnostic.

### Where Standards Live

**Xiontech Engineering Standards (Tier 1 + Tier 2 templates) live in the company DevOps Wiki — not inside project repos.** Projects do not copy the standards folder. Instead, each project contains only its own filled-in files:

| What each project contains | Source |
|---|---|
| `docs/PROJECT-STANDARDS.md` | Copied once from a Tier 2 template/example, then customized |
| `project-context.md` | Copied once from a project-context example, then customized |
| `CLAUDE.md` | 3-line thin file (written manually) |

Tier 1 documents (git workflow, security baseline, CI/CD, etc.) are **read from the wiki** when decisions need to be made — they are never copied into project repos.

## Single Source of Truth

A project's facts — what it is, who it's for, what tech it uses, how it's built — must live in **one place**. When multiple files describe the same thing, they drift apart and nobody knows which is current.

### The Rule

**`docs/PROJECT-STANDARDS.md` is the single source of truth** for all project decisions, context, and conventions. Every other file either:
- **References** it (doesn't duplicate it), or
- **Contains only what's unique to its purpose** (no overlapping content)

### How Files Relate

```
docs/PROJECT-STANDARDS.md          ← SINGLE SOURCE OF TRUTH
  │                                  (project context, tech stack, architecture,
  │                                   conventions, testing, deployment — everything)
  │
  ├── project-context.md           ← AI IMPLEMENTATION RULES
  │                                  (lean, LLM-optimized coding rules for AI agents;
  │                                   consumed by BMad agents + any AI tool)
  │
  ├── CLAUDE.md                    ← CLAUDE CODE ENTRY POINT
  │                                  (references project-context.md + PROJECT-STANDARDS.md;
  │                                   no unique content of its own)
  │
  ├── README.md                    ← REFERENCES project standards for details
  │                                  ADDS: Quick-start setup instructions
  │                                  (things a new developer needs immediately)
  │
  └── _bmad-output/                ← BMad ARTIFACTS (PRDs, architecture, reviews)
      ├── brainstorming/              Not duplicating project standards — these are
      ├── prd-*.md                    working documents that feed INTO standards
      ├── architecture-*.md           decisions, not the decisions themselves
      └── distillates/
```

### What Each File Contains

| File | Contains | Does NOT Contain |
|------|----------|-----------------|
| `docs/PROJECT-STANDARDS.md` | Project context, stakeholders, tech stack, architecture decisions, conventions, testing strategy, deployment, environment vars, Tier 1 deviations | AI-specific rules, setup steps, BMad artifacts |
| `project-context.md` | Lean AI implementation rules: tech stack summary, architecture rules, code generation rules, naming conventions, anti-patterns (Do NOT list) | Project overview, stakeholders, deployment, testing strategy (reference PROJECT-STANDARDS.md instead) |
| `CLAUDE.md` | References to `@project-context.md` and `@docs/PROJECT-STANDARDS.md` | No unique content — Claude Code entry point only |
| `README.md` | One-paragraph overview, prerequisites, setup steps, development commands | Full conventions, architecture decisions (link to PROJECT-STANDARDS.md instead) |
| `_bmad-output/*.md` | Working artifacts (brainstorming, PRDs, architecture docs, review reports) | Finalized project decisions (those go into PROJECT-STANDARDS.md) |

### Why project-context.md exists

BMad agents (all 9) search for `**/project-context.md` on every activation and load it as foundational context. BMad workflows (12+) load it as a `{project_context}` variable for coding standards and project-wide patterns. This is BMad's native convention — not optional, not deprecated.

`CLAUDE.md` is a Claude Code convention (auto-loaded by Claude Code). Since both serve the same purpose (lean AI implementation rules), the content lives in `project-context.md` (the tool-agnostic file), and `CLAUDE.md` simply references it. This avoids duplication while ensuring both BMad agents and Claude Code receive the same context.

## Standard Project Layout

```
project-root/
│
├── .claude/                        # Claude Code configuration
│   ├── skills/                     # BMad skills (installed by bmad-init)
│   │   ├── bmad-brainstorming/
│   │   ├── bmad-distillator/
│   │   ├── bmad-review-adversarial-general/
│   │   ├── bmad-review-edge-case-hunter/
│   │   ├── bmad-editorial-review-prose/
│   │   ├── bmad-editorial-review-structure/
│   │   ├── bmad-help/
│   │   ├── bmad-party-mode/
│   │   ├── bmad-shard-doc/
│   │   └── bmad-index-docs/
│   └── settings.json               # Claude Code project settings (if needed)
│
├── _bmad/                          # BMad framework configuration
│   ├── _config/
│   │   └── bmad-help.csv           # Skill catalog
│   └── core/
│       └── config.yaml             # BMad core config
│
├── _bmad-output/                   # BMad working artifacts (planning, design, reviews)
│   ├── brainstorming/              # Brainstorming sessions
│   └── ...                         # PRDs, architecture docs, distillates, review reports
│
├── docs/                           # Project documentation
│   └── PROJECT-STANDARDS.md        # ★ SINGLE SOURCE OF TRUTH — Tier 2 standards, filled in
│
├── azure-pipelines.yml              # CI/CD pipeline (Azure DevOps — company default)
│                                    # Or: .github/workflows/ (GitHub), .gitlab-ci.yml (GitLab)
│
├── .gitignore
├── .env.example                    # Environment variable template
├── docker-compose.yml              # Local development services
├── project-context.md              # AI implementation rules (consumed by BMad agents + any AI tool)
├── CLAUDE.md                       # Claude Code entry point (references project-context.md + PROJECT-STANDARDS.md)
├── README.md                       # Quick-start setup instructions (references PROJECT-STANDARDS.md)
│
└── [tech-stack directories]        # Project-specific: src/, server/, client/, app/, etc.
```

## Required Files — Every Project

### docs/PROJECT-STANDARDS.md (Single Source of Truth)

A copy of the [Tier 2 Project Standards Template](../Tier-2-Project-Standards/Project-Standards-Template), filled in for this specific project. This is **the** reference for all project decisions.

Contains: project context (what, who, why), stakeholders, tech stack, architecture decisions, code conventions, API design, testing strategy, environment configuration, deployment, documentation index, Tier 1 deviations.

Updated when: project decisions change, architecture evolves, conventions are added.

### project-context.md (AI Implementation Rules)

Lean, LLM-optimized coding rules that AI agents must follow when implementing code. This is BMad's native convention — all 9 BMad agents search for `**/project-context.md` on activation, and 12+ workflows load it as context.

**Contents:**
- Tech stack summary (brief — AI needs this for quick reference)
- Architecture rules (how layers/modules are organized, what goes where)
- Code generation rules (where to put new code, which module to follow as reference)
- Naming conventions by language/layer
- Anti-patterns to avoid (Do NOT list)
- Git conventions (commit format, branch naming — operational extract from Tier 1)
- Security rules (input validation, injection prevention — operational extract from Tier 1)

**Keep it lean** — focus on unobvious details that AI agents would otherwise miss. Under 150 lines.

**Standard sections** (all project-context.md files should follow this structure):

1. **Tech Stack** — brief summary of languages, frameworks, tools
2. **Architecture Rules** — layer discipline, module patterns, key constraints
3. **Code Generation Rules** — where to put new code, reference modules
4. **Naming** — conventions by language/layer
5. **Do NOT** — anti-patterns the AI must avoid (stack-specific)
6. **Git Conventions** — conventional commits format, branch naming pattern, merge discipline (operational extract from Tier 1 docs 01-02; parameterized with project ticket prefix and scope names)
7. **Security Rules** — input validation, injection prevention, auth/session rules, PII handling (operational extract from Tier 1 doc 05; parameterized with tech-specific patterns)

**Pre-filled examples by tech stack** — start from the closest match:

| Stack | Example |
|-------|---------|
| .NET Web API | [dotnet-webapi.project-context.md](../Tier-2-Project-Standards/Examples/Project-Context/dotnet-webapi) |
| Python FastAPI | [python-fastapi.project-context.md](../Tier-2-Project-Standards/Examples/Project-Context/python-fastapi) |
| .NET + React | [dotnet-react-fullstack.project-context.md](../Tier-2-Project-Standards/Examples/Project-Context/dotnet-react-fullstack) |
| Python + React | [python-react-fullstack.project-context.md](../Tier-2-Project-Standards/Examples/Project-Context/python-react-fullstack) |
| Node.js + React | [nodejs-react-fullstack.project-context.md](../Tier-2-Project-Standards/Examples/Project-Context/nodejs-react-fullstack) |

### CLAUDE.md (Claude Code Entry Point)

Claude Code auto-loads `CLAUDE.md` at the start of every session. Since the AI implementation rules live in `project-context.md`, CLAUDE.md is a thin reference file — it points Claude Code to the right files, nothing more.

**Contents:**
```markdown
# [Project Name]
Read @project-context.md for AI implementation rules.
Read @docs/PROJECT-STANDARDS.md for project context and decisions.
```

That's it. No unique content. If you need Claude Code-specific instructions that don't apply to other AI tools, add them here — but this should be rare.

### README.md

Quick-start for developers. Links to PROJECT-STANDARDS.md for deeper context.

**Contents:**
1. **What** — One paragraph describing the project
2. **Prerequisites** — Required tools and versions
3. **Quick Start** — Step-by-step from clone to running (see [06-dev-environment.md](06-Dev-Environment))
4. **Development Commands** — How to run, test, lint
5. **Further Reading** — Link to `docs/PROJECT-STANDARDS.md` for conventions, architecture, and deployment

### .gitignore

Must include at minimum:
```
# Dependencies (language-specific)
node_modules/
__pycache__/
.gradle/
vendor/
bin/
obj/

# Environment
.env
.env.local
.env.*.local

# Build output
dist/
build/
out/
target/

# IDE
.idea/
.vscode/settings.json

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Logs
*.log
```

Add language/framework-specific entries as needed.

### .env.example

Template for all required environment variables with:
- Placeholder values that are safe to commit
- Comments explaining each variable
- Sensible defaults for local development

### docker-compose.yml

Defines services needed for local development (database, cache, message broker, etc.) with:
- Explicit `name:` at the top
- Health checks on services
- Named volumes for persistence
- Ports documented in `.env.example`

## Required Directories

### _bmad-output/

BMad **working artifacts** directory. These are outputs from BMad skills — brainstorming sessions, PRDs, architecture designs, review reports, distillates.

| Artifact | When Created | Purpose |
|----------|-------------|---------|
| `brainstorming/` | Ideation phase | Brainstorming session records |
| PRD documents | Planning phase | Product requirements |
| Architecture documents | Design phase | System design, data models, API specs |
| Distillates | After large docs created | Compressed versions for AI context efficiency |
| Review reports | After quality reviews | Adversarial review findings, edge case reports |

**Key distinction**: These are *working artifacts* that feed into decisions. The *decisions themselves* live in `docs/PROJECT-STANDARDS.md`. For example: the architecture document in _bmad-output/ is the detailed design work; the summary of architecture decisions goes into PROJECT-STANDARDS.md Section 3.

### .agents/skills/

Company skills for Claude Code and other AI agents, committed to the repo so every team member has the same skills available. Install them into a skills directory Claude Code scans (`.claude/skills/` project-local or `~/.claude/skills/` global) — see `.agents/skills/SKILLS-CHECKLIST.md`.

### CI/CD Pipeline Configuration

The pipeline config file location depends on the platform:

| Platform | Location |
|----------|----------|
| Azure DevOps (default) | `azure-pipelines.yml` at repo root |
| GitHub | `.github/workflows/*.yml` |
| GitLab | `.gitlab-ci.yml` at repo root |

See [04-cicd-standards.md](04-CICD-Standards) for pipeline design rules.

## Project Initialization Checklist

When starting a new project, follow this sequence:

### Step 1: Create Repository

```bash
mkdir project-name && cd project-name
git init
```

### Step 2: Initialize BMad

Run `/bmad-init` in Claude Code to set up the BMad framework:
- Creates `_bmad/` configuration
- Installs `.claude/skills/`
- Creates `_bmad-output/` directory

### Step 3: Create Foundation Files

Create these files (manually or with AI assistance):

- [ ] `.gitignore` — based on tech stack
- [ ] `.env.example` — with all required variables
- [ ] `README.md` — project overview + quick-start setup
- [ ] `project-context.md` — AI implementation rules (see [Tier 2 Setup Guide](../Tier-2-Project-Standards) for examples per tech stack)
- [ ] `CLAUDE.md` — Claude Code entry point (references project-context.md + PROJECT-STANDARDS.md)
- [ ] `docker-compose.yml` — if external services needed

### Step 4: Set Up Project Standards (Single Source of Truth)

See [Tier 2 Setup Guide](../Tier-2-Project-Standards) for the full Tier 2 setup guide, including how to choose between the blank template and pre-filled examples. See [07a — Workflow Quick-Reference](07a-Workflow-Quick-Reference) — Tier 2 Setup section for the detailed process and verification checklist.

- [ ] Choose starting point: pre-filled example for your tech stack or blank template (see [Tier 2 Setup Guide](../Tier-2-Project-Standards))
- [ ] Copy to `docs/PROJECT-STANDARDS.md`
- [ ] Fill sections progressively following the workflow phases:

| When | Sections to Fill |
|------|-----------------|
| Phase 1 (Ideation) | 1 — Project Context |
| Phase 3 (Architecture) | 2 — Tech Stack, 3 — Architecture Decisions, 5 — Code Organization, 6 — API Conventions, 9 — Database |
| Phase 4 (Planning) | 4 — Git Workflow, 7 — Testing, 8 — Environment, 10 — Deployment, 11 — Documentation Index, 12 — AI Development, 13 — Tier 1 Deviations |
| Ongoing | Update any section when decisions change |

### Step 5: Begin Product Workflow (if building a new product)

Follow the 6-phase workflow from [07 — AI-Assisted Development](07-AI-Assisted-Development). Use the [07a — Quick-Reference](07a-Workflow-Quick-Reference) as a step-by-step checklist.

- [ ] Phase 1: Run brainstorming session (`/bmad-brainstorming`)
- [ ] Phase 2: Create PRD, review (adversarial + edge case), distill
- [ ] Phase 3: Design architecture, review (adversarial + edge case), distill
- [ ] Phase 3f: Update PROJECT-STANDARDS.md Sections 2, 3, 5, 6, 9 from architecture decisions
- [ ] Phase 4: Create implementation plan, fill remaining PROJECT-STANDARDS.md sections
- [ ] Phase 4: Create project-context.md from tech-stack example, create thin CLAUDE.md, update BMad config
- [ ] Phase 4 gate: Verify Tier 2 setup (see [07a quick-reference checklist](07a-Workflow-Quick-Reference))

### Step 6: Tech Stack Scaffolding

Set up the technology-specific project structure:
- [ ] Initialize language/framework project
- [ ] Configure linter and formatter
- [ ] Set up test framework
- [ ] Create CI pipeline
- [ ] Verify: install → lint → typecheck → test → build all pass

### Step 7: Initial Commit

```bash
git add -A
git commit -m "chore: initialize project with standard structure"
```

## What Goes Where

| Content Type | Location | Committed to Git |
|-------------|----------|-----------------|
| Project decisions & conventions (SSOT) | `docs/PROJECT-STANDARDS.md` | Yes |
| AI implementation rules (BMad + any AI tool) | `project-context.md` | Yes |
| Claude Code entry point (references only) | `CLAUDE.md` | Yes |
| Quick-start setup | `README.md` | Yes |
| Agent/company skills | `.agents/skills/` | Yes |
| BMad config | `_bmad/` | Yes |
| BMad working artifacts | `_bmad-output/` | Yes |
| Other documentation | `docs/` | Yes |
| Environment secrets | `.env` | **No** — gitignored |
| Environment template | `.env.example` | Yes |
| Source code | Tech-stack directories | Yes |
| Build output | `dist/`, `build/`, etc. | **No** — gitignored |
| Dependencies | `node_modules/`, etc. | **No** — gitignored |
