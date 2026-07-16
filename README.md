# OnThi12

An exam-prep web platform for grade-12 students and teachers. Teachers create exams **by uploading a PDF** — Gemini (multimodal AI) extracts the questions, the teacher reviews and confirms answers, then assigns the exam to classes. Students take timed multiple-choice exams that are graded automatically, and both roles get progress dashboards.

Built on the Xiontech **X-Tek** skeleton (Tier-1 company process + AI-assisted development scaffolding).

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Vite, TailwindCSS + shadcn/ui, Recharts, TanStack Query |
| Backend | Node.js + TypeScript + NestJS (modular monolith) |
| Database | PostgreSQL 16 + Prisma |
| Cache | Redis |
| Message queue | RabbitMQ |
| AI parsing | Gemini API (`@google/generative-ai`) |
| Infra | Docker Compose, Nginx, GitHub Actions |

See [`TechStack.md`](TechStack.md) for the full rationale.

## Documentation

| Path | Purpose |
|------|---------|
| [`SRS.md`](SRS.md) | Software Requirements Specification (v1.1) — the requirements / PRD |
| [`TechStack.md`](TechStack.md) | Technology choices per layer |
| [`docs/PROJECT-STANDARDS.md`](docs/PROJECT-STANDARDS.md) | **Single source of truth** — decisions, conventions, environment |
| [`project-context.md`](project-context.md) | Lean AI coding rules for BMad agents and AI tools |
| [`CLAUDE.md`](CLAUDE.md) | Claude Code entry point |
| [`docs/technical_architecture_guidelines/coding-standard/`](docs/technical_architecture_guidelines/coding-standard/index.md) | XT-ESS Tier 1 company standards (git, commits, review, CI/CD, security, testing) |

## Getting started

> The application code (frontend/backend) is not scaffolded yet — the project is in the planning phase. The steps below describe the intended local setup once the stack is scaffolded.

1. **Prerequisites**: Docker + Docker Compose, Node.js LTS, a Gemini API key.
2. **Configure env**: copy `.env.example` → `.env` and set `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`, `GEMINI_API_KEY`, `JWT_SECRET` (see [`docs/PROJECT-STANDARDS.md` §8](docs/PROJECT-STANDARDS.md)).
3. **Run**: `docker compose up` — brings up PostgreSQL, Redis, RabbitMQ, the NestJS backend, and Nginx.
4. **Migrate**: `npx prisma migrate dev` to apply the schema.

## Roadmap (MVP, ~5 weeks)

| Phase | Scope |
|-------|-------|
| Weeks 1–2 | Auth + roles; exam creation (upload PDF → AI parsing → review → confirm answers → crop images) |
| Week 3 | Taking exams, submission, auto grading |
| Week 4 | Student dashboard |
| Week 5 | Teacher dashboard (by class / student) |

Full roadmap and post-MVP optimization plan: [`SRS.md`](SRS.md) §8–§9.

## Development workflow

This project is driven with **BMad**. Invoke `bmad-help` to see where you are and what to run next. Requirements (SRS) and tech stack are done; the next planning steps are `bmad-architecture` (architecture spine) then `bmad-create-epics-and-stories`.
