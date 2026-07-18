# OnThi12 — Frontend

React 19 + TypeScript + Vite 8.

See [`docs/PROJECT-STANDARDS.md`](../docs/PROJECT-STANDARDS.md) for conventions and [`project-context.md`](../project-context.md) for coding rules.

## Running locally

The frontend runs natively (not in Docker) so Vite HMR works. Start the backend first — `docker compose up` from the repo root — then:

```bash
npm ci
npm run dev
```

Vite serves on port 5173 and proxies `/api` to the backend on port 3000, so API calls are same-origin in development.

## Structure

| Folder | Holds |
|--------|-------|
| `src/features/` | Code by domain: `auth`, `exams`, `take`, `dashboard`, `classes` |
| `src/components/ui/` | shadcn/ui components (added in Story 1.4) |
| `src/lib/` | API client and TanStack Query setup |
| `src/routes/` | Route definitions |

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm run preview   # serve the production build
```

## Not wired up yet

TailwindCSS + shadcn/ui and the design tokens arrive in Story 1.4; TanStack Query and Recharts arrive with the dashboard stories. The landing page is still the create-vite demo and gets replaced in Story 1.4.
