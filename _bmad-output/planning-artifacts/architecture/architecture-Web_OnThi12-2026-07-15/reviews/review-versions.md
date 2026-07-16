---
title: 'Version Reality Review — ARCHITECTURE-SPINE.md Stack table'
reviewer: architecture spine version-checker
date: '2026-07-15'
target: '_bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md (§Stack)'
method: WebSearch verification of every pinned major version against current reality as of 2026-07-15
---

# Version Reality Review — OnThi12 Architecture Spine

**Verdict:** The stack is mostly current and sensible, but **one entry is a hard defect** — `@google/generative-ai` is a deprecated, end-of-life package (support ended 2025-11-30) and must be replaced with `@google/genai`. Three others (TypeScript, Redis, Vite) name a major that is now behind the current stable major; none is broken, but each has a materially newer default. The remaining eight pins are accurate.

## Method

Each pinned technology in the Stack table (spine lines 163–178) was checked via web search for three things: (1) does the named major version exist, (2) is it current/stable as of 2026-07-15, and (3) is it a sensible default versus what a greenfield project would pick today. "Today" = 2026-07-15.

## Findings by technology

### 1. Node.js — pinned `24.x (LTS)` — ✅ CORRECT
Node.js 24 ("Krypton") entered **Active LTS on 2025-10-28** and is the current active LTS line in July 2026 (maintenance begins 2026-10-20, EOL 2028-04-30). "24 is an LTS line" is accurate — even majors get LTS; 24 is even. Sensible pin. (Note for context: from Oct 2026 Node moves to one major/year starting with Node 27, but that does not affect 24's status.)

### 2. TypeScript — pinned `5.x` — ⚠️ OUTDATED (two majors behind) — **[medium]**
**TypeScript 7.0 hit GA on 2026-07-08** (latest `7.0.2`, 2026-07-14). The line skipped nothing user-facing but the 5.x label is now two majors stale (6.0 was the transitional JS-based release that hardened deprecations; 7.0 is the Go-native rewrite, ~10x faster). Caveat that keeps this at medium not high: **TS 7.0 ships without a stable programmatic API** (expected in 7.1), so typescript-eslint, Vue/Angular/Svelte/Astro template tooling cannot switch yet. A cautious production pin today is the **final 5.x line (5.9.x)** or an explicit "hold at 5.9 until the 7.x toolchain stabilizes" note — but writing bare "5.x" reads as stale training data rather than a deliberate hold. Recommend: either bump the label to `5.9.x` with a one-line reason, or plan 7.x once eslint/tooling catches up.

### 3. NestJS — pinned `11.x (Node ≥20, Express v5 default, SWC)` — ✅ CORRECT
Latest `11.1.28` (2026-07-08). Every parenthetical is accurate: NestJS 11 defaults to **Express v5**, uses **SWC** as the default compiler, and requires **Node ≥20** (Node 24 satisfies this). Current major, sensible.

### 4. Prisma ORM — pinned `7.x (rust-free)` — ✅ CORRECT
Prisma 7 is the **current major** (latest `7.7.0`, 2026-04-07; committed as the recommended production version through ~March 2027). "rust-free" is accurate — v7's headline was dropping the Rust query engine. Prisma "Next" (a full TypeScript rewrite) was announced March 2026 and will become **Prisma 8**, but is not yet the recommended default. Correct pin.

### 5. PostgreSQL — pinned `18.x` — ✅ CORRECT
PostgreSQL 18 was **released GA on 2025-09-25** (stable, not beta/RC). Current stable major. Correct and sensible.

### 6. Redis — pinned `7.x` — ⚠️ OUTDATED (one major behind) — **[medium]**
**Redis 8 is the current major** (latest `8.8.0`, 2026-05-25; active 8.x maintenance releases through June 2026). Redis 8 is GA, is the default for new installs, and (relevant to this project) returned Redis to an OSI-track/open licensing posture. Redis 7 is still supported, and OnThi12 only uses Redis for cache + rate-limiting (§9.1/§9.6), so 7.x is not broken — but a greenfield project today would pick **8.x**. Recommend bump to `8.x`.

### 7. RabbitMQ (+ amqplib) — pinned `4.x` — ✅ CORRECT
RabbitMQ 4.1.x is the current release series (latest `4.1.8`, 2026-07; 4.1 has extended support to 2030-06-30). Current major, sensible.

### 8. React — pinned `19.x` — ✅ CORRECT
React 19 is the **current stable major** (latest `19.2.7`, 2026-06-01). Correct pin.

### 9. Vite — pinned `7.x` — ⚠️ SLIGHTLY BEHIND (one major behind) — **[low]**
**Vite 8 is out and stable** (Rolldown/Rust-based bundler, the biggest change since Vite 2; beta shipped Dec 2025, GA before mid-2026). Vite 7 is now the *previous* major but is still fully supported, and Vite 8 provides a compat layer that auto-converts esbuild/rollupOptions config. Low impact for a capstone, but the current default is `8.x`. Recommend bump to `8.x` (or note "7.x acceptable; 8.x is current").

### 10. TailwindCSS + shadcn/ui — pinned `4.x` — ✅ CORRECT
Tailwind CSS v4 is the current major (v4.1 line, CSS-first config, official `@tailwindcss/vite` plugin). shadcn/ui has first-class Tailwind v4 + React 19 support. Correct and current.

### 11. TanStack Query — pinned `5.x` — ✅ CORRECT
v5 is the current major, actively released through May 2026, TypeScript-first (supports TS 5.4+). Correct pin.

### 12. @google/generative-ai (Gemini) — pinned `current` — ❌ WRONG PACKAGE — **[critical]**
**`@google/generative-ai` is deprecated and end-of-life.** Its repo is now `google-gemini/deprecated-generative-ai-js`; **all support (including bug fixes) permanently ended 2025-11-30.** Google's unified replacement, **`@google/genai`**, reached GA in May 2025 and is the sole recommended library for JS/TS Gemini access — it is required for Gemini 2.x features and is what the official migration guide points to. This is not a version bump but a package rename + rewrite. Because the entire OnThi12 exam-creation flow depends 100% on this SDK (AD-02, AD-13, AD-14), shipping against a package that receives zero fixes is a real risk. **Action:** replace every reference to `@google/generative-ai` with `@google/genai` across the spine (Stack table line 177), TechStack.md, PROJECT-STANDARDS.md, project-context.md, and CLAUDE.md, and update the migration surface in `ai-parsing`. The Gemini Flash / Flash-Lite model choice itself remains fine.

### Uninlined (`current`): Recharts, Nginx, Docker Compose, GitHub Actions
Left as "current" in the spine — no pinned major to verify; all remain live, standard choices. No action.

## Recommended edits to the Stack table

| Name | Current pin | Recommended | Severity |
| --- | --- | --- | --- |
| @google/generative-ai | current | **`@google/genai` (rename — old pkg is EOL 2025-11-30)** | critical |
| TypeScript | 5.x | `5.9.x` (hold) with reason, or plan 7.x | medium |
| Redis | 7.x | `8.x` | medium |
| Vite | 7.x | `8.x` (7.x still acceptable) | low |
| Node.js | 24.x (LTS) | unchanged ✅ | — |
| NestJS | 11.x | unchanged ✅ | — |
| Prisma ORM | 7.x | unchanged ✅ | — |
| PostgreSQL | 18.x | unchanged ✅ | — |
| RabbitMQ | 4.x | unchanged ✅ | — |
| React | 19.x | unchanged ✅ | — |
| TailwindCSS + shadcn/ui | 4.x | unchanged ✅ | — |
| TanStack Query | 5.x | unchanged ✅ | — |

## Sources

- Node.js: [nodejs.org releases](https://nodejs.org/en/about/previous-releases), [nodesource — Node 24 LTS](https://nodesource.com/blog/nodejs-24-becomes-lts), [endoflife.date/nodejs](https://endoflife.date/nodejs)
- TypeScript: [Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/), [The Register — TS 7.0 stable](https://www.theregister.com/devops/2026/07/09/speedier-type-checks-in-typescript-70-as-first-stable-go-release-ships/)
- NestJS: [Announcing NestJS 11 (Trilon)](https://trilon.io/blog/announcing-nestjs-11-whats-new), [@nestjs/core npm versions](https://www.npmjs.com/package/@nestjs/core?activeTab=versions)
- Prisma: [Announcing Prisma ORM 7](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0), [Prisma changelog](https://www.prisma.io/changelog)
- PostgreSQL: [PostgreSQL 18 Released](https://www.postgresql.org/about/news/postgresql-18-released-3142/), [release notes 18.0](https://www.postgresql.org/docs/release/18.0/)
- Redis: [redis/redis releases](https://github.com/redis/redis/releases), [versionlog.com/redis](https://versionlog.com/redis/)
- RabbitMQ: [RabbitMQ release information](https://www.rabbitmq.com/release-information)
- React: [react.dev/versions](https://react.dev/versions), [endoflife.date/react](https://endoflife.date/react)
- Vite: [Vite 8.0 is out!](https://vite.dev/blog/announcing-vite8), [Vite releases](https://vite.dev/releases)
- TailwindCSS / shadcn: [Tailwind v4 — shadcn/ui](https://ui.shadcn.com/docs/tailwind-v4)
- TanStack Query: [Announcing TanStack Query v5](https://tanstack.com/blog/announcing-tanstack-query-v5), [TanStack/query releases](https://github.com/tanstack/query/releases)
- Gemini SDK: [deprecated-generative-ai-js (google-gemini)](https://github.com/google-gemini/deprecated-generative-ai-js), [Migrate to the Google GenAI SDK](https://ai.google.dev/gemini-api/docs/migrate), [Gemini API libraries](https://ai.google.dev/gemini-api/docs/libraries)
