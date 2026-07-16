# 06 — Development Environment Setup

## Principle

A new developer should be able to go from zero to running the project in under 30 minutes. Environment setup should be documented, automated where possible, and consistent across the team.

## Required Tooling (Company-Wide)

Every developer at Xiontech must have these installed:

| Tool | Purpose | Notes |
|------|---------|-------|
| Git | Version control | Latest stable version |
| Docker Desktop | Containerized services (databases, message brokers, etc.) | Required for all projects |
| VS Code | Primary IDE | Standardized extensions listed below |
| Claude Code | AI-assisted development | Company's default AI coding assistant |
| Azure DevOps access | Development workspace | Repos, pipelines, boards, artifacts — company default |

### Per-Stack Tooling

Each project specifies its language runtime, package manager, and build tools in the project's Tier 2 standards and README. Examples:

| Stack | Runtime | Version Manager | Package Manager |
|-------|---------|----------------|-----------------|
| .NET | .NET SDK 8/9 | Built-in | NuGet |
| Python | Python 3.x | pyenv | pip, poetry, uv |
| Node.js/TypeScript | Node.js LTS | nvm, fnm | pnpm, npm |
| React/Frontend | Node.js LTS | nvm, fnm | pnpm, npm |

**Rule**: Use whatever the project specifies. Don't mix package managers within a project.

### VS Code Extensions

**Required for all developers:**
- Claude Code
- Azure Repos (for Azure DevOps integration)
- Docker
- GitLens (recommended)

**Per-stack (install for your project):**

| Stack | Extensions |
|-------|-----------|
| .NET | C# Dev Kit, .NET Extension Pack |
| Python | Python, Pylance, Black Formatter |
| Node.js/TypeScript | ESLint, Prettier |
| React | ESLint, Prettier, ES7+ React snippets |

## Project Onboarding Pattern

Every project must have a documented setup flow in the README or CONTRIBUTING.md. The pattern:

### 1. Prerequisites Check

The project README lists required tools and versions:
```
[Language runtime] >= [version]  (see version file)
[Package manager] >= [version]
Docker Desktop running
```

### 2. Environment Configuration

```bash
cp .env.example .env
# Edit .env with local values (or use defaults for dev)
```

A configuration template (`.env.example`, `config.example.yaml`, etc.) must exist in every project with all required variables documented.

### 3. Install Dependencies

```bash
[package-manager] install
```

One command. If it needs more than one command, the setup is too complex.

### 4. Start Services

```bash
docker compose up -d       # Start databases, etc.
[project] db:migrate       # Apply database schema
[project] db:seed          # Load development data
```

### 5. Run the Application

```bash
[project] dev              # Start development server
```

### 6. Verify

```bash
[project] test             # Run test suite
[project] lint             # Check code style
[project] typecheck        # Verify types (if applicable)
```

**Goal**: Steps 2-6 should work without any human intervention on a fresh clone.

## Environment Variables

### Rules

1. **Configuration template** committed to git with placeholder/default values and comments
2. **Actual config** gitignored — contains real local values
3. **No optional variables without defaults** — if the app needs it, it should either have a sensible default or fail fast at startup with a clear message
4. **Typed config** — environment variables should be parsed into a typed/validated config object at startup, not accessed as raw strings throughout the codebase
5. **Validation** — validate all required config at startup. Fail immediately with a descriptive error if anything is missing.

### Naming Convention

```
DATABASE_URL=...         # Full connection string
DB_HOST=...              # Individual connection params (alternative)
APP_SECRET=...           # Application secret keys
CORS_ORIGIN=...          # Security
PORT=3000                # Server config
APP_ENV=development      # Runtime environment
```

Uppercase, underscore-separated. Group related vars with a common prefix.

## Docker Standards

### Every project with external services must have:

1. **`docker-compose.yml`** — defines all services needed for local development
2. **Named volumes** — for data persistence across restarts
3. **Health checks** — for services that other services depend on
4. **Explicit stack name** — use the `name:` property at the top of docker-compose.yml to avoid confusion in Docker Desktop

### Port Allocation

Avoid conflicts when running multiple projects simultaneously:

| Service Type | Default Range | Convention |
|-------------|--------------|------------|
| Relational DB (PostgreSQL, MySQL) | 5432-5499 | Each project picks a unique port |
| NoSQL DB (MongoDB, Redis) | 6379-6399, 27017-27099 | Each project picks a unique port |
| API server | 3000-3099 | Each project picks a unique port |
| Frontend dev server | 5173-5299 | Each project picks a unique port |
| Reverse proxy | 8080-8099 | For production-like testing |

Document port assignments in the project's configuration template.

## Database Management

### Standard Commands

Every project with a database should expose these operations (via scripts, Makefile, or task runner):

| Operation | Purpose |
|-----------|---------|
| Migrate | Apply pending migrations |
| Seed | Load development/test data |
| Reset | Drop and recreate database from scratch |
| GUI | Open database management interface (if available) |

The exact command names and invocation method are project-specific — document in Tier 2.

### Seed Data Philosophy

- Seed data should create a **usable development environment** — not just empty tables
- Include at least: an admin user, essential configuration, sample business data
- Seeds must be idempotent — running twice produces the same result
