---
baseline_commit: f0181b5bf10a87e78c98a5540078682366acfb10
---

# Story 1.4: Design tokens & role-aware app shell

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a consistent, accessible application shell,
so that I navigate the product coherently on desktop and tablet before any feature screen exists.

## Acceptance Criteria

1. **Design tokens are the single source of truth.** The Tailwind theme is configured from the Vietnamese EdTech Standard design system (`docs/design-system.md`) so its color palette, **Inter** typography scale, **4/8px** spacing system, and **10px default radius** are the *only* token source consumed by UI — no ad-hoc hex/px literals in components (UX-DR1). The **three semantic colors are defined as distinct tokens** — green (good/correct), amber (warning/low-confidence, EXAM-07), red (missing-answer/error, EXAM-09) — such that they can never be conflated (UX-DR2, SRS §5.3). [Source: epics.md#Story 1.4; docs/design-system.md; ARCHITECTURE-SPINE.md#Consistency Conventions "Semantic colors"]
2. **Role-aware app shell renders.** For an (authenticated-context) user, the shell renders a **fixed 260px left sidebar + fluid content area capped at max-width 1200px**, showing **role-scoped navigation** (a Student sees only Student destinations; a Teacher sees only Teacher destinations). The **active** nav item is styled as **10% primary tint background + a 3px left "pill" indicator** (UX-DR3). [Source: epics.md#Story 1.4; docs/design-system.md#Components, #Layout & Spacing]
3. **Responsive collapse.** On a narrow (mobile/tablet) viewport the sidebar collapses to a **hamburger / bottom nav**, and the content's horizontal margins shrink to **16px** (UX-DR4). [Source: epics.md#Story 1.4; docs/design-system.md#Layout & Spacing "Mobile Adaptation"]
4. **Accessible focus + button variants.** Any interactive element receiving keyboard focus shows a **high-contrast 2px offset primary-blue focus ring** (UX-DR9), and **Primary / Secondary / Ghost** button variants render per the design-system spec (UX-DR11). [Source: epics.md#Story 1.4; docs/design-system.md#Elevation & Depth "Focus States", #Components "Buttons"]
5. **Stitch mockups established as the cross-cutting fidelity bar.** The Stitch mockups in `docs/stitch_exports/` are wired in as the reference every later front-end story implements against (Student: Home, Exam List, Take Exam, Results, Result Detail, Study History, My Class; Teacher: Home, Exam Management, Review AI Questions, Class Management, Detailed Statistics). This story does **not** build those feature screens — it establishes the tokens, shell, and reference so later stories can match their mockup 1:1 (UX-DR14). [Source: epics.md#Story 1.4]

## Tasks / Subtasks

- [x] **Task 1 — Install & pin the front-end foundation deps** (AC: 1, 2, 4)
  - [x] From `frontend/`, add (check current stable with `npm view <pkg> version` — do not guess a pin, mirror Story 1.3's approach; the spine pins the *majors*: TailwindCSS 4.x, React 19.x, Vite 8.x — honor those):
    - `tailwindcss@4` + `@tailwindcss/vite@4` (Tailwind 4 uses the Vite plugin, **not** PostCSS/`tailwind.config.js`).
    - `react-router@7` (route-driven active-nav state + placeholder pages; also the primitive Story 1.5 builds role-landing on).
    - `lucide-react` (stroke-based 20×20 icons — matches design-system "20×20px stroke-based icons"; see Dev Notes on why not Material Symbols).
    - `@fontsource-variable/inter` (self-host Inter — offline/CSP-safe; the design system mandates Inter for all roles).
  - [x] Confirm no native build step / `allowScripts` entry is needed for any of these (all pure JS/CSS). If `npm install` adds an approval prompt for one, record it — don't silently `--ignore-scripts` past it.
  - [x] Do **NOT** add TanStack Query, shadcn/ui CLI, or Recharts in this story — no data fetching, charts, or rich components exist yet (Simplicity First). TanStack Query lands with the first data story (1.5 login); Recharts with the first dashboard.

- [x] **Task 2 — Wire Tailwind 4 into Vite and delete the create-vite demo** (AC: 1)
  - [x] Add `@tailwindcss/vite` to `frontend/vite.config.ts` `plugins` (keep the existing `react()` plugin and the `/api` → `:3000` proxy untouched — that proxy is load-bearing for Story 1.5).
  - [x] **Delete the committed create-vite demo** (called out in `deferred-work.md` as this story's cleanup): replace `frontend/src/App.tsx`'s counter/hero/links body; delete `frontend/src/App.css`; strip the purple-accent demo tokens from `frontend/src/index.css`; delete `frontend/src/assets/hero.png` (and unused `react.svg`/`vite.svg` if nothing references them after the shell lands); fix `frontend/index.html` `<title>frontend</title>` → `OnThi12`. Remove `public/icons.svg`-style demo assets only if unreferenced.
  - [x] `index.css` becomes the token entrypoint: `@import "tailwindcss";` then the `@theme { … }` block (Task 3) and the Inter `@fontsource-variable/inter` import. No leftover demo CSS variables.

- [x] **Task 3 — Define the design tokens in a CSS-first `@theme`** (AC: 1)
  - [x] Translate `docs/design-system.md` **frontmatter** (the authoritative token block — see Dev Notes on the prose-vs-frontmatter hex conflict) into a Tailwind 4 `@theme` block in `index.css`: the full color palette (`--color-primary: #0058be`, surface/on-surface layers, outline, etc.), the Inter type scale (`display/h1/h2/h3/body-lg/body-md/body-sm/label-md/label-sm` + the `-mobile` variants) as `--font-size-*` / matching line-height/weight utilities, the spacing scale (base 4px, `xs 4 / sm 8 / md 16 / lg 24 / xl 32`), and radii (`sm .25rem / DEFAULT .5rem / md .75rem / lg 1rem / xl 1.5rem / full`).
  - [x] Set the **10px default radius**: design-system §Shapes says "consistent 10px (0.625rem) corner radius for almost all components" — add `--radius-DEFAULT` (or the project's default token) = `0.625rem` so cards/inputs/buttons/badges get 10px by default, while keeping the sm/md/lg/xl scale from the frontmatter for the exceptions. Flag the discrepancy in a comment (frontmatter `DEFAULT: 0.5rem` vs §Shapes 10px) — §Shapes wins for the component default.
  - [x] **Add the three distinct semantic tokens (AC 1 / UX-DR2).** The frontmatter only ships an `error` family — **green (success) and amber (warning) are named in the prose but missing from the token block**. Define all three as separate hues with `-container`/on- pairs consistent with the palette's tonal style, mapped to SRS §5.3 meaning: `success` = green (good/correct/high), `warning` = amber (low-confidence EXAM-07 / mild), `danger`|`error` = red (missing-answer EXAM-09 / error). They must be visually unmistakable from each other and from `--color-primary` (blue). Add a comment tying each to its FR so a later dev can't collapse amber into red.
  - [x] Provide the sidebar/container layout tokens the shell needs (`--sidebar-width: 260px`, `--container-max: 1200px`) from the frontmatter `spacing` block.

- [x] **Task 4 — Provisional role source (the 1.5 seam)** (AC: 2)
  - [x] The AC says "an authenticated user", but **auth does not exist until Story 1.5**. Provide a **provisional role source** so the shell is demonstrable now: a tiny `useRole()` (context or a `lib/` helper) returning `'student' | 'teacher'`, backed by a **dev-only toggle gated behind `import.meta.env.DEV`** (Decision 3 — never ships to production; not a `?role=` query or localStorage) — clearly commented as a temporary seam.
  - [x] Isolate it so Story 1.5 replaces **only** this one source (verified JWT `role`) without touching the shell/nav components. Do **not** build login, JWT, guards, or a real `AuthProvider` here — that's 1.5/1.6. [Source: ARCHITECTURE-SPINE.md#AD-17 — role read from token; epics.md#Story 1.5]

- [x] **Task 5 — Nav config + AppShell layout** (AC: 2)
  - [x] Define a single role→destinations config (labels in Vietnamese per the mockups, icon, route path). From the Home mockups: **Student** = Trang chủ (`home`), Đề thi (`assignment`→lucide `ClipboardList`), Thống kê (`analytics`→`BarChart3`), Lớp học (`school`→`GraduationCap`), + Cài đặt (`settings`, footer). **Teacher** = Trang chủ (`dashboard`→`LayoutDashboard`), Đề thi (`description`→`FileText`), Lớp học (`groups`→`Users`), Thống kê (`leaderboard`→`BarChart3`), + Cài đặt (footer). [Source: docs/stitch_exports/Student - Home/code.html, Teacher - Home/code.html]
  - [x] Build `AppShell` (layout route wrapping `<Outlet/>`): fixed **260px** `Sidebar` (brand block "OnThi12" + role-scoped `NavItem` list + footer settings) and a fluid `<main>` whose inner content is capped at **max-width 1200px** and offset by the sidebar on desktop. Optional top bar per the mockups (brand/search/avatar) — keep minimal, don't build search behavior.
  - [x] `NavItem` active state (UX-DR3): current route → **10% primary tint bg + 3px left pill indicator**; inactive → `on-surface-variant` with a hover tint. Use `react-router` `NavLink`'s active state, not manual path matching. Put shell components under `frontend/src/components/` (shell) and reusable primitives under `frontend/src/components/ui/`.

- [x] **Task 6 — Responsive collapse** (AC: 3)
  - [x] Below the desktop breakpoint (design system uses ~`md`/1024px in the demo `index.css` and mockups gate the sidebar at `md:`), the 260px sidebar is **hidden** and replaced by a **hamburger toggle (drawer)** and/or a **bottom nav bar** (the Student mockup ships a bottom nav at lines ~406–430 — reuse that pattern), and content horizontal margins shrink to **16px**. Pick one primary pattern (bottom nav matches the mockups) and keep it accessible (focusable, labeled). [Source: docs/stitch_exports/Student - Home/code.html#bottom-nav; docs/design-system.md#Mobile Adaptation]

- [x] **Task 7 — Button primitive + global focus ring** (AC: 4)
  - [x] `components/ui/button.tsx` with **Primary** (solid blue bg, white text), **Secondary** (white bg, slate/`outline-variant` border, `on-surface` text), **Ghost** (no bg/border, primary-blue text) variants + sizes, 10px radius. A small variant helper (plain conditional class map or a tiny `cva`-style function) — **do not** pull the shadcn CLI just for this (Decision 1).
  - [x] Global focus style (UX-DR9): every interactive element (`:focus-visible`) shows a **2px offset primary-blue ring** (`outline` or `ring` + offset). Apply once at the base layer so it's inherited, not re-declared per component. High contrast — must be visible on both white cards and the gray workspace.

- [x] **Task 8 — Placeholder routes so the shell is navigable** (AC: 2, 5)
  - [x] Under `frontend/src/routes/`, register the `react-router` tree: `AppShell` layout route → child routes for each nav destination (student + teacher), each a **minimal placeholder page** (heading + "coming in a later story" stub) — enough to prove the active-item pill and role-scoped nav work end-to-end. **Do not** implement any feature screen's real content (that's AC 5's later-story bar, explicitly out of scope here).
  - [x] Mount the router in `main.tsx` (replace the demo `<App/>` render). Keep `StrictMode`.
  - [x] Add a short `frontend/src/routes/README` note or code comment pointing each placeholder route at its Stitch mockup folder (the AC-5 fidelity reference), so later-story devs land on the right mockup.

- [x] **Task 9 — Frontend test baseline + verify** (AC: 1–4)
  - [x] Introduce the frontend test runner: **Vitest + @testing-library/react + jsdom** (Decision 2; none exists yet, only `oxlint`). Keep it minimal.
  - [x] Add the **one behavioral test that matters**: `Sidebar`/nav renders **exactly the Student destinations for role=student and exactly the Teacher destinations for role=teacher** (locks role-scoped nav — the visual half of the AUTH-02 isolation the backend enforces in 1.6). Optionally: Button renders each variant's classes; active NavLink gets the pill/tint class.
  - [x] `npm run build` (tsc -b + vite build) clean, `npm run lint` (oxlint) clean, tests green. Manually run `npm run dev` and confirm against the mockups: sidebar 260px + active pill, role toggle swaps the nav set, narrow viewport collapses to hamburger/bottom-nav with 16px margins, Tab shows the focus ring, the three semantic colors read as three distinct hues.

### Review Findings

- [x] [Review][Decision] Duplicate `--color-danger`/`--color-error` semantic tokens — resolved by Admin: collapsed to a single canonical `error` token (matches the design-system frontmatter's own family name; `danger` was an unused alias, deleted). `frontend/src/index.css`.
- [x] [Review][Patch] Arbitrary `w-[3px]` literal bypasses the token system [frontend/src/components/nav-item.tsx:30] — fixed: added a dedicated `--width-pill: 3px` token (scoped like `--width-sidebar`, verified via build to only emit `before:w-pill`, no shared-scale pollution)
- [x] [Review][Patch] `--spacing-sidebar` in the shared spacing namespace generates nonsense utilities (`p-sidebar`, `gap-sidebar` = 260px) [frontend/src/index.css:128] — fixed: renamed to `--width-sidebar` (feeds only `w-*`); the `ml-sidebar` offset now reads the same token via `ml-[var(--width-sidebar)]`. Verified empirically via a throwaway build probe that `p-sidebar`/`gap-sidebar`/`m-sidebar` no longer compile.
- [x] [Review][Patch] Dead `onNavigate` prop wired through `NavItem`/`SidebarNav` for a mobile drawer that was never built [frontend/src/components/nav-item.tsx:10] — fixed: removed the prop from `NavItemProps`, `SidebarNav`, and all call sites.
- [x] [Review][Patch] `BottomNav` reimplements its own active-link styling instead of reusing `NavItem` [frontend/src/components/bottom-nav.tsx:27] — fixed: `NavItem` gained a `variant: 'sidebar' | 'bottom'` prop; `BottomNav` now renders `<NavItem variant="bottom" />` instead of a hand-rolled `NavLink`.
- [x] [Review][Patch] Dev-only role resets to `'student'` on every reload, desyncing the sidebar/bottom-nav from the current route [frontend/src/lib/role-provider.tsx:17] — fixed: `RoleProvider`'s `initialRole` default now infers from `window.location.pathname` (`/teacher/*` → `'teacher'`) instead of a hardcoded default.
- [x] [Review][Patch] `BottomNav`'s 5 `min-w-16` items have no overflow handling and can clip on narrow phones (~320-360px) [frontend/src/components/bottom-nav.tsx:19] — fixed: added `overflow-x-auto` as a safety net.
- [x] [Review][Patch] `DevRoleToggle`'s fixed position overlaps `BottomNav` on mobile viewports [frontend/src/components/dev-role-toggle.tsx:22] — fixed: `bottom-20 md:bottom-md` clears the bottom-nav bar height on mobile.
- [x] [Review][Patch] `min-h-screen`/`h-screen` (100vh) reintroduces the mobile browser toolbar jump the deleted demo's `100svh` was written to avoid [frontend/src/components/app-shell.tsx:16] — fixed: swapped for Tailwind's native `min-h-dvh`/`h-dvh` in `app-shell.tsx` and `sidebar.tsx`.
- [x] [Review][Defer] `--color-outline` text is marginally below WCAG AA contrast (~4.2:1 vs. 4.5:1) at small sizes [frontend/src/index.css:34] — deferred, pre-existing (value inherited verbatim from `docs/design-system.md` frontmatter, not introduced by this diff)
- [x] [Review][Defer] Type scale and spacing scale use raw `px` rather than `rem`, weakening browser text-zoom accessibility (WCAG 1.4.4) [frontend/src/index.css:82] — deferred, pre-existing (design-system.md's frontmatter itself specifies px, e.g. `fontSize: 36px`; this diff faithfully transcribed the authoritative source per AC1)
- [x] [Review][Defer] Dark-mode support (`color-scheme` + `prefers-color-scheme` palette) was not carried over from the deleted demo CSS [frontend/src/index.css:1] — deferred, no product requirement (SRS and design-system.md define light-mode tokens only; the removed dark mode was demo-only boilerplate this story's own tasks instruct deleting)

## Dev Notes

### Scope guardrails (read first — prevents the most likely mistakes)

- **This is a presentation/foundation story, not an auth story.** No login, JWT, guards, `AuthProvider`, or real role resolution — those are Stories 1.5 (login + role routing) and 1.6 (role-based access enforcement). The shell consumes a **provisional** role (Task 4) that 1.5 swaps out at a single seam. Building auth here would collide head-on with 1.5. [Source: epics.md#Story 1.5, #Story 1.6; ARCHITECTURE-SPINE.md#AD-17]
- **No feature screens.** AC 5 makes the Stitch mockups the fidelity bar for *later* stories; this story only builds the shell + placeholders. Do not implement Home/Exam List/Take Exam/etc. content — that's over-scoping every future front-end story into this one. [Source: epics.md#Story 1.4 AC 5]
- **Delete the create-vite demo — don't leave it lying around.** `deferred-work.md` explicitly assigns Story 1.4 the removal of `App.tsx` (counter/hero/links), `App.css`, the purple tokens in `index.css`, `assets/hero.png`, and the `<title>frontend</title>`. Leaving any of it is a known-defect carryover. [Source: _bmad-output/implementation-artifacts/deferred-work.md#"The create-vite demo landing page is committed as the app"]
- **Tokens are the single source — no magic literals.** Once the `@theme` exists, components use token utilities (`bg-primary`, `text-on-surface`, `rounded`, `p-md`), never raw `#0058be`/`260px`/`10px` inline. AC 1 (UX-DR1) is about *sourcing*, and later reviews will grep for stray hex.
- **Keep the primitive set tiny.** This story needs a `Button` and the shell components — nothing more. No speculative `Card`/`Input`/`Table`/`Dialog` until a story actually needs them (Simplicity First). Resist scaffolding a full component library.
- **Don't touch backend, Prisma, or the six NestJS module shells.** Frontend-only story.

### The prose-vs-frontmatter token conflict (resolve deliberately)

`docs/design-system.md` and `docs/stitch_exports/vietnamese_edtech_standard/DESIGN.md` **disagree on the primary blue in prose** — the narrative "Colors" sections say `#3B82F6` (design-system.md says `#0058BE`), but **both files' YAML frontmatter agree the token is `primary: '#0058be'`**. **The frontmatter is authoritative** (it's the machine-readable token block the epics AC points at). Use `#0058BE`. Same rule for any other prose/frontmatter drift: frontmatter wins, prose is descriptive. Note also design-system §Shapes (10px default radius) overrides the frontmatter `rounded.DEFAULT: 0.5rem` for the component default — call it out in a code comment. [Source: docs/design-system.md frontmatter vs #Colors; docs/stitch_exports/vietnamese_edtech_standard/DESIGN.md]

### Semantic colors — you must ADD green + amber (they're missing from the tokens)

UX-DR2 / SRS §5.3 / the spine's "Semantic colors" row require **three distinct** hues: **green = good/correct/high**, **amber/yellow = low-confidence (FR-6/EXAM-07)**, **red = missing-answer (FR-7/EXAM-09) & error**. The design-system frontmatter only defines the **`error`** (red) family — **`success` (green) and `warning` (amber) are named in prose but have no tokens**. Define them (with `-container` + `on-` pairs matching the palette's tonal approach) as new `@theme` colors. This is *the* correctness-adjacent UI invariant of the whole product (a teacher must never confuse an amber "check this" flag with a red "you must pick an answer" gate), so make the two visually unmistakable and comment each with its FR. [Source: docs/design-system.md#Colors; SRS §5.3; ARCHITECTURE-SPINE.md#Consistency Conventions "Semantic colors"]

### Architecture compliance

- **Frontend structure (spine Structural Seed):** code lives under `frontend/src/{features,components/ui,lib,routes}/`. This story populates `components/` (shell) + `components/ui/` (Button), `routes/` (router tree + placeholders), and `lib/` (the provisional `useRole`). `features/` stays empty until a feature story. [Source: ARCHITECTURE-SPINE.md#Structural Seed, #Design Paradigm "Frontend" row]
- **Naming (spine Consistency Conventions):** FE files kebab-case (`app-shell.tsx`, `nav-item.tsx`, `button.tsx`); PascalCase components; feature/domain grouping. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions]
- **Data access convention (spine):** "one API client + TanStack Query hooks in `lib/`; no ad-hoc `fetch` in components." **Not triggered this story** (no data), but don't set a counter-precedent — if you need any client state, keep it local; don't hand-roll a fetch layer that 1.5 will replace. [Source: ARCHITECTURE-SPINE.md#Consistency Conventions "Frontend data access"]
- **Role from token (AD-17):** the eventual role source is the verified JWT, read server-trusted. The provisional `useRole` is a stand-in with the same *shape* (`'student'|'teacher'`) so 1.5's swap is mechanical. [Source: ARCHITECTURE-SPINE.md#AD-17]
- **Secrets/config (spine):** nothing secret here, but the frontend bundle must never carry backend secrets — trivially satisfied (no env usage this story). [Source: ARCHITECTURE-SPINE.md#Consistency Conventions "Secrets / config"]

### Latest tech / version notes (verify at implementation time)

- **Tailwind CSS 4.x is CSS-first.** No `tailwind.config.js` / `postcss.config.js` by default — install `@tailwindcss/vite`, add it to `vite.config.ts` plugins, and `@import "tailwindcss";` in `index.css`. Tokens are declared in a `@theme { --color-*: …; --font-*: …; --spacing-*: …; --radius-*: … }` block, which generates the matching utilities. Confirm the exact `@theme` variable namespaces against the installed 4.x docs (`npm view tailwindcss version` then check that minor's theming reference) — the namespace names (`--color-`, `--text-`/`--font-size-`, `--spacing-`, `--radius-`) are the load-bearing detail. [Source: ARCHITECTURE-SPINE.md#Stack (TailwindCSS 4.x)]
- **react-router 7** — the merged Remix/React-Router line; use the data-router (`createBrowserRouter`) or `<BrowserRouter>` + `<Routes>` with a layout route + `<Outlet/>`; `NavLink` exposes `isActive` for the pill styling. Pin the current 7.x. [Source: pin per `npm view react-router version`]
- **Icons:** the mockups load **Material Symbols Outlined via Google Fonts CDN** (filled, external host). The design system spec instead says **"20×20px stroke-based icons"** — `lucide-react` matches that spec, is offline/CSP-safe, and is the shadcn default. **Deliberate deviation from the mockup's icon *font*, honoring the design-system icon *spec*.** Map each mockup glyph to its nearest lucide icon (Task 5). [Source: docs/design-system.md#Components "Sidebar Navigation"; docs/stitch_exports/*/code.html]
- **Inter:** self-host via `@fontsource-variable/inter` (import in `index.css`), not the Google Fonts CDN the mockups use — avoids an external request and matches the "no external host" posture. [Source: docs/design-system.md#Typography]
- **React 19 + Vite 8** are already installed (Story 1.1). Tailwind 4's Vite plugin supports both. [Source: ARCHITECTURE-SPINE.md#Stack]

### Previous story intelligence (Stories 1.1–1.3)

- **Frontend is still the bare create-vite scaffold** — `package.json` has only `react`/`react-dom` (deps) and `vite`/`typescript`/`oxlint`/`@vitejs/plugin-react` (dev). No Tailwind, router, icons, fonts, or test runner yet. This story stands them up for the first time. [verified: `frontend/package.json`]
- **`components/ui/`, `features/`, `lib/`, `routes/` exist only as `.gitkeep` placeholders** — populate them, remove the `.gitkeep` where you add real files. [verified: `frontend/src/` tree]
- **Lint is `oxlint`** (`frontend/.oxlintrc.json`, `npm run lint`), not eslint — different from the backend. Whatever test runner you add must not fight oxlint's rules. [verified: `frontend/package.json`]
- **`vite.config.ts` already proxies `/api` → `http://localhost:3000`** — preserve it (Story 1.5 login calls the backend through it). Only *add* the Tailwind plugin. [verified: `frontend/vite.config.ts`]
- **Dev-Agent-Record honesty was flagged in every prior review** (1.1, 1.2, 1.3): record only commands actually run against the real repo/build — no aspirational "tests pass" without running them. Story 1.3's record shows the expected level of detail (exact lint errors + fixes). [Source: 1-3-*.md#Dev Agent Record; 1-2/1-1 review notes]
- **`strict` TS + no-unused rules are on** (`tsconfig.app.json`: `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `erasableSyntaxOnly`). `verbatimModuleSyntax` means **type-only imports must use `import type`** — a common Vite/React 19 stumble. [verified: `frontend/tsconfig.app.json`]

### Project Structure Notes

- **New:** `frontend/src/components/` (shell: `app-shell.tsx`, `sidebar.tsx`, `nav-item.tsx`, `bottom-nav.tsx`, optional `top-bar.tsx`), `frontend/src/components/ui/button.tsx`, `frontend/src/lib/use-role.ts` (+ nav config, e.g. `lib/nav-config.ts`), `frontend/src/routes/` (router tree + per-destination placeholder pages), plus the test setup + the role-nav test.
- **Modified:** `frontend/package.json` (+lockfile), `frontend/vite.config.ts` (+Tailwind plugin), `frontend/index.html` (`<title>`), `frontend/src/index.css` (Tailwind import + `@theme` tokens + Inter + global focus ring), `frontend/src/main.tsx` (mount router).
- **Deleted:** `frontend/src/App.tsx` demo body (repurpose or delete), `frontend/src/App.css`, `frontend/src/assets/hero.png`, unreferenced demo assets/`icons.svg`; `.gitkeep` files where real files now live.
- No backend/Prisma/module changes. Matches the spine's frontend layout exactly — no structural variance. [Source: ARCHITECTURE-SPINE.md#Structural Seed]

### Testing requirements

- **Must-Have list (PROJECT-STANDARDS §7)** is backend-centric (grading idempotency, role-guard access, assign gate) — none of those are in this story. The one thing here worth locking is **role-scoped navigation** (a Student never sees Teacher destinations and vice-versa) — the front-of-house half of the AUTH-02 / AD-17 isolation the backend enforces in Story 1.6. That's the single required behavioral test (Task 9).
- Everything else (260px sidebar, active pill, focus ring, responsive collapse, three distinct semantic hues) is **visual** — verify manually against the Stitch mockups with `npm run dev`; don't over-invest in brittle DOM/CSS assertions or pixel snapshots for a shell.
- Establish the runner minimally (Vitest + RTL + jsdom recommended). Don't build a broad component-test suite — one meaningful test + green build/lint/typecheck is the bar for a foundation story (matches Story 1.3's "don't over-scope the infra story's tests").

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 1.4: Design tokens & role-aware app shell] — the 5 ACs (UX-DR1/2/3/4/9/11/14)
- [Source: docs/design-system.md] — **primary token source**: frontmatter (colors/type/spacing/radius) + prose (Brand, Colors, Typography, Layout, Elevation, Shapes, Components)
- [Source: docs/stitch_exports/vietnamese_edtech_standard/DESIGN.md] — same tokens; note the prose `#3B82F6` vs frontmatter `#0058be` conflict (frontmatter wins)
- [Source: docs/stitch_exports/Student - Home/code.html] — Student sidebar nav set + bottom-nav pattern
- [Source: docs/stitch_exports/Teacher - Home/code.html] — Teacher sidebar nav set
- [Source: docs/stitch_exports/ (12 screen folders)] — AC-5 fidelity reference for later stories
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#Structural Seed] — frontend `src/{features,components/ui,lib,routes}/` layout
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#Consistency Conventions] — FE naming, semantic colors, frontend data-access rule
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#AD-17] — role read from verified token (the seam the provisional `useRole` fills)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-Web_OnThi12-2026-07-15/ARCHITECTURE-SPINE.md#Stack] — TailwindCSS 4.x / React 19.x / Vite 8.x pins
- [Source: _bmad-output/implementation-artifacts/deferred-work.md] — Story 1.4 owns deleting the create-vite demo
- [Source: SRS §5.3] — semantic color meaning (green good / yellow mild warning / red missing-answer)
- [Source: project-context.md#Code generation rules] — semantic color system; TanStack Query hooks + single API client in `lib/` (future); surgical changes
- Codebase state verified directly: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/src/{main.tsx,App.tsx,App.css,index.css}`, `frontend/tsconfig.app.json`, `frontend/src/` tree, `frontend/.oxlintrc.json`

## Decisions (resolved 2026-07-19, by Admin)

These three implementation choices are **settled** — do not re-litigate them during dev:

1. **UI primitives: hand-roll, do NOT run the shadcn CLI.** The spine names "TailwindCSS + shadcn/ui 4.x", but this story needs only a `Button` + the shell, so hand-roll the tiny primitive set with Tailwind (a small conditional class-map / lightweight `cva`-style helper is fine). Adopt the shadcn CLI later when a component-heavy story (tables/dialogs/forms — e.g. Story 2.4 Review screen) actually benefits. Keep `components/ui/` minimal now.
2. **Frontend test infra: add Vitest now.** Stand up **Vitest + @testing-library/react + jsdom** in this story (no runner exists yet — only `oxlint`) and lock the one role-scoped-nav test (Task 9). Story 1.5 inherits the ready runner.
3. **Provisional role: a dev-only toggle.** Gate it behind `import.meta.env.DEV` so it never ships to production; Story 1.5 replaces this single seam with the verified JWT `role`. Not a `?role=` query or `localStorage`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (bmad-dev-story)

### Debug Log References

- Frontend runs on Node 24 (via fnm) for build/test — the system Node 20.17.0 fails Vite 8's engine check (`^20.19.0 || >=22.12.0`). `npm install` (Node 20) only warns (EBADENGINE); build/dev/test are prefixed with the fnm-24 env. [[prisma7-dev-env-gotchas]] noted Node 24 for this repo.
- Verified Tailwind 4 namespaces against the installed `node_modules/tailwindcss/theme.css`: bare `rounded` → `--radius` (set to 0.625rem = 10px), sizes via `--text-*` (+ `--text-*--line-height`/`--font-weight`/`--letter-spacing`), spacing base `--spacing`, and `max-w-*` reads `--container-*` (so `--container-app: 1200px` → `max-w-app`). Named `--spacing-*` (xs/sm/md/lg/xl, sidebar) generate `p-*`/`gap-*`/`w-*`/`ml-*` utilities.
- `npm test` (vitest run): 2 files / 5 tests passed.
- `npm run lint` (oxlint): clean, no warnings.
- `npm run build` (`tsc -b && vite build`): clean — 1792 modules, token utilities all resolved, Inter self-hosted woff2 emitted, CSS 19.86 kB.
- `npm run dev` smoke: HTTP 200 at `/`, `<title>OnThi12</title>`, no Vite errors. (Visual fidelity vs the Stitch mockups — sidebar 260px + active pill, role toggle, mobile collapse, focus ring, three semantic hues — is left for a human eyeball in the browser; not machine-asserted.)

### Completion Notes List

- **Version note (Decision on the fly):** the story pins `react-router@7`, but npm current stable is 8.2.0. Honored the story's explicit pin (installed 7.18.1) — the shell uses only stable data-router (`createBrowserRouter`) + `NavLink`/`Outlet` APIs. Flag for review if the project prefers tracking latest.
- **Tokens (AC 1):** `src/index.css` is now the single token source — `@import "tailwindcss"` + self-hosted Inter + one `@theme` block translated from `docs/design-system.md` frontmatter (authoritative; frontmatter `#0058be` wins over prose `#3B82F6`). Default `rounded` = 10px per §Shapes (overrides frontmatter 0.5rem — commented). **Added the two missing semantic families:** `success` (green) + `warning` (amber); `danger`/`error` (red) already existed. Each is commented with its FR (EXAM-07 amber vs EXAM-09 red) so they can't be conflated — four visually distinct hues (green/amber/red/blue).
- **Role seam (AC 2, Task 4):** provisional role lives only in `lib/role-context.ts` + `lib/use-role.ts` + `lib/role-provider.tsx`, flipped by a dev-only `components/dev-role-toggle.tsx` gated behind `import.meta.env.DEV`. Story 1.5 swaps the provider body for the verified JWT role without touching the shell. `RoleProvider` gained an `initialRole` prop (dev default `student`; tests exercise both roles).
- **Shell (AC 2/3):** `app-shell.tsx` = fixed 260px `Sidebar` (hidden < md) + fluid `<main>` capped at `max-w-app` (1200px), offset `md:ml-sidebar`; `bottom-nav.tsx` replaces the sidebar < md with content margins at `px-md` (16px). Active nav (`nav-item.tsx`) = `bg-primary/10` + 3px left pill via `before:`, driven by `NavLink` `isActive`. Routes are role-prefixed (`/student/*`, `/teacher/*`) so the two nav sets are disjoint.
- **Button + focus (AC 4):** hand-rolled `components/ui/button.tsx` (Primary/Secondary/Ghost, sm/md, 10px radius) — no shadcn CLI (Decision 1). Global `:focus-visible` 2px offset primary-blue ring declared once in `index.css` base layer.
- **Mockups as the bar (AC 5):** no feature screens built. `routes/README.md` maps each placeholder route to its Stitch mockup folder; nav-config carries a `mockup` field per destination. `PlaceholderPage` stubs prove role-scoped nav + active pill end-to-end.
- **Test baseline (Task 9):** Vitest + @testing-library/react + jsdom (Decision 2). The one required behavioral test locks role-scoped nav (Student hrefs vs Teacher hrefs, no cross-role leak); a small Button-variant test added for the primitive.
- **Demo removed:** deleted `App.tsx`/`App.css`/`assets/hero.png`/`react.svg`/`vite.svg`/`public/icons.svg`, purple demo tokens gone from `index.css`, `<title>` → `OnThi12`. `features/.gitkeep` kept (no feature story yet).

### File List

**Added**
- `frontend/src/index.css` (rewritten — token entrypoint)
- `frontend/src/lib/role-context.ts`
- `frontend/src/lib/use-role.ts`
- `frontend/src/lib/role-provider.tsx`
- `frontend/src/lib/nav-config.ts`
- `frontend/src/components/dev-role-toggle.tsx`
- `frontend/src/components/nav-item.tsx`
- `frontend/src/components/sidebar.tsx`
- `frontend/src/components/bottom-nav.tsx`
- `frontend/src/components/app-shell.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/routes/router.tsx`
- `frontend/src/routes/root-redirect.tsx`
- `frontend/src/routes/placeholder-page.tsx`
- `frontend/src/routes/README.md`
- `frontend/src/test/setup.ts`
- `frontend/src/components/sidebar.test.tsx`
- `frontend/src/components/ui/button.test.tsx`

**Modified**
- `frontend/package.json` (deps + `test` script) & `frontend/package-lock.json`
- `frontend/vite.config.ts` (Tailwind plugin + vitest config)
- `frontend/tsconfig.app.json` (`vitest/globals` types)
- `frontend/index.html` (`<title>` → OnThi12)
- `frontend/src/main.tsx` (mount RoleProvider + RouterProvider)

**Deleted**
- `frontend/src/App.tsx`, `frontend/src/App.css`
- `frontend/src/assets/hero.png`, `frontend/src/assets/react.svg`, `frontend/src/assets/vite.svg`
- `frontend/public/icons.svg`
- `frontend/src/lib/.gitkeep`, `frontend/src/routes/.gitkeep`, `frontend/src/components/ui/.gitkeep`

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-07-19 | Story drafted via bmad-create-story from epics.md Story 1.4 + docs/design-system.md + Stitch mockups + ARCHITECTURE-SPINE.md, verified against the current bare create-vite frontend. Three open questions surfaced (shadcn vs hand-roll, Vitest now vs 1.5, provisional-role mechanism). | claude-opus-4-8 (create-story) |
| 2026-07-19 | Three decisions resolved by Admin: (1) hand-roll UI primitives (no shadcn CLI), (2) add Vitest+RTL now, (3) dev-only role toggle gated by `import.meta.env.DEV`. Folded into Tasks 1/4/7/9 and the Decisions section. | claude-opus-4-8 (create-story) |
| 2026-07-19 | Implemented Story 1.4: Tailwind 4 CSS-first design tokens (+ added missing green/amber semantic families), role-aware app shell (260px sidebar / 1200px content cap / bottom-nav collapse), provisional `useRole` seam + dev toggle, hand-rolled Button + global focus ring, role-prefixed placeholder routes wired to Stitch mockups, and a Vitest+RTL baseline with the role-scoped-nav lock. create-vite demo removed. Build/lint/test all green. Status → review. | claude-opus-4-8 (bmad-dev-story) |
