# OnThi12 — Backend

NestJS 11 modular monolith. One module per service: `auth`, `exam`, `ai-parsing`, `submission`, `dashboard`, `class`.

See [`docs/PROJECT-STANDARDS.md`](../docs/PROJECT-STANDARDS.md) for conventions and [`project-context.md`](../project-context.md) for coding rules.

## Requirements

- Node 24.x (the repo pins it — `fnm use 24` / `nvm use 24`)
- Docker + Docker Compose, for Postgres / Redis / RabbitMQ

## Running locally

Infrastructure and the backend both run in Docker. From the repo root:

```bash
cp .env.example .env    # fill in GEMINI_API_KEY / JWT_SECRET when those stories land
docker compose up
```

That starts `postgres`, `redis`, `rabbitmq`, `api` (HTTP, port 3000), and `worker`. Source is bind-mounted, so `nest start --watch` picks up edits without a rebuild. There is no `nginx` and no `frontend` container locally — the frontend runs natively via Vite and proxies `/api` to port 3000.

To run the backend outside Docker, start only the infrastructure and point the URLs at `localhost`:

```bash
docker compose up postgres redis rabbitmq
cd backend && npm ci && npx prisma generate && npm run dev
```

`npx prisma generate` is required before the first run — `PrismaService` imports the generated client from `backend/generated/`, which is gitignored.

## Entrypoints

| File | Process | Started by |
|------|---------|-----------|
| `src/main.ts` | HTTP server, global prefix `/api` | `npm run start:dev` |
| `src/worker.ts` | Queue worker, no HTTP listener | `npm run start:dev -- --entryFile worker` with `WORKER=true` |

Both boot the same `AppModule` from the same image; only the entrypoint and env differ (AD-18).

## Scripts

```bash
npm run dev          # nest start
npm run start:dev    # nest start --watch
npm run start:prod   # node dist/src/main  (after npm run build)
npm run lint         # eslint --fix
npm test             # unit tests — mocked Prisma
npm run test:e2e     # HTTP wiring — guards, envelope, filter; in-memory Prisma fake
npm run test:integration  # *.int-spec.ts against a throwaway postgres:18 (needs Docker)
```

## Health check

`GET /api/health` → `200 { "data": { "status": "ok" } }`

Static by design — it reports that the process is up, not that its dependencies are. Per-service dependency health fan-out is post-MVP (SRS §9.5).
