# Routes

The `AppShell` layout route (`components/app-shell.tsx`) wraps every page via
`<Outlet/>`. Child routes are generated from `lib/nav-config.ts`, so the sidebar,
bottom nav, and route table stay in sync automatically.

Every child is a **placeholder** for now — Story 1.4 builds only the tokens, shell,
and role-scoped nav. The real feature screens land in later stories and must match
their Stitch mockup **1:1** (AC 5, the cross-cutting fidelity bar).

## Mockup reference per destination (`docs/stitch_exports/`)

| Route | Role | Stitch mockup folder |
|-------|------|----------------------|
| `/student` | Student | `Student - Home` |
| `/student/exams` | Student | `Student - Exam List` (→ `Student - Take Exam`, `Student - Result Detail`) |
| `/student/stats` | Student | `Student - Results` (→ `Student - Study History`) |
| `/student/class` | Student | `Student - My Class` |
| `/teacher` | Teacher | `Teacher - Home` |
| `/teacher/exams` | Teacher | `Teacher - Exam Management` (→ `Teacher - Review AI Questions`) |
| `/teacher/class` | Teacher | `Teacher - Class Management` |
| `/teacher/stats` | Teacher | `Teacher - Detailed Statistics` |

Role prefixes (`/student/*`, `/teacher/*`) keep the two destination sets disjoint —
the front-of-house half of the AUTH-02 isolation the backend enforces in Story 1.6.
The provisional role comes from `lib/use-role.ts` (a dev-only toggle); Story 1.5
replaces that single seam with the verified JWT role.
