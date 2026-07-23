# OnThi12 — Frontend

React 19 + TypeScript + Vite 8.

See [`docs/PROJECT-STANDARDS.md`](../docs/PROJECT-STANDARDS.md) for conventions and [`project-context.md`](../project-context.md) for coding rules.

## Running locally

Requires **Node 24.x** (Vite 8 and the Vitest/jsdom suite both fail on Node 20). Run `fnm use` / `nvm use` from the repo root first — `engine-strict=true` in `.npmrc` makes `npm ci` fail rather than warn if you forget.

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
| `src/components/` | App shell (sidebar, bottom nav, top bar) |
| `src/components/ui/` | Hand-rolled primitives — `Button`, `Input` (Story 1.4 chose these over the shadcn CLI) |
| `src/contexts/` · `src/providers/` · `src/hooks/` | Auth context object, its provider, and the consumer hooks |
| `src/lib/` | Framework-agnostic `api-client.ts` and the TanStack Query client |
| `src/routes/` | Route tree, auth/role guards, placeholder pages |

## Scripts

```bash
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build
npm run lint      # oxlint
npm run test      # vitest run
npm run preview   # serve the production build
```

## Conventions

- **Design tokens are the only source of colour, type, spacing and radius** — `src/index.css`'s `@theme` block. No raw hex or px literals in components.
- **Server state goes through TanStack Query** — `useQuery` for every GET, `useMutation` for every write that invalidates cached data. The three pre-auth forms (login, forgot-password, reset-password) are the one grandfathered exception; there are no new ones from Epic 2 onward. See [`project-context.md`](../project-context.md).
- **Mockup fidelity** — what must match a Stitch mockup and what must not is defined in [`docs/PROJECT-STANDARDS.md` §14](../docs/PROJECT-STANDARDS.md).
