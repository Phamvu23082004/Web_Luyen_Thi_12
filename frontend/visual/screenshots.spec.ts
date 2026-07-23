import { test, type Page } from '@playwright/test'
import { NAV_BY_ROLE } from '../src/lib/nav-config'
import type { Role } from '../src/contexts/auth-context'

/**
 * Captures every routable screen at both viewports, named after the Stitch
 * mockup it must be compared against (PROJECT-STANDARDS §14.2).
 *
 * This produces evidence, not assertions. It deliberately does not compare
 * pixels: §14.1 makes font, icon set and literal colour intentionally different
 * from the mockups, so a pixel diff would fail on every screen by design. The
 * output is meant to be looked at side by side with docs/stitch_exports/<name>/.
 *
 * No backend is required. Authenticated routes are reached by seeding the same
 * localStorage key the app reads (`onthi12.auth`) with an unsigned token whose
 * payload carries the role — the identical trick sidebar.test.tsx uses. The
 * server is the real authority (Story 1.6 RolesGuard); this only gets the shell
 * to render.
 */

const OUT = 'visual/__screenshots__'

/** Mirrors sidebar.test.tsx's helper: an unsigned JWT whose payload decodes to `role`. */
function fakeAccessToken(role: Role): string {
  const payload = Buffer.from(JSON.stringify({ role, sub: 'visual-harness' }))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${payload}.signature`
}

async function signIn(page: Page, role: Role) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [
      'onthi12.auth',
      JSON.stringify({ accessToken: fakeAccessToken(role), refreshToken: 'visual-harness' }),
    ] as const,
  )
}

/**
 * Slugifies a route into a filename: `/teacher/exams` -> `teacher-exams`.
 * The query string is dropped — `?` is an illegal filename character on Windows.
 */
function slug(route: string): string {
  return route.split(/[?#]/)[0].replace(/^\//, '').replace(/\//g, '-') || 'root'
}

async function capture(page: Page, route: string, mockup: string, viewport: string) {
  await page.goto(route)
  // The shell renders synchronously; this waits out font swap and the Vite HMR
  // client so text is not captured mid-layout.
  await page.waitForLoadState('networkidle')
  await page.screenshot({
    path: `${OUT}/${viewport}/${slug(route)}.png`,
    fullPage: true,
  })
  // Surfaces the mockup pairing in the test log so the reviewer knows what to
  // open next to it.
  test.info().annotations.push({ type: 'mockup', description: `docs/stitch_exports/${mockup}/` })
}

// Public screens have no mockup of their own except Login; forgot/reset-password
// were derived from it (§14.1, "screens with no mockup").
const PUBLIC_ROUTES: Array<{ route: string; mockup: string }> = [
  { route: '/login', mockup: 'Login' },
  { route: '/forgot-password', mockup: 'Login' },
  { route: '/reset-password?token=visual-harness', mockup: 'Login' },
]

for (const { route, mockup } of PUBLIC_ROUTES) {
  test(`public ${route}`, async ({ page }, testInfo) => {
    await capture(page, route, mockup, testInfo.project.name)
  })
}

// Authenticated screens come straight from NAV_BY_ROLE so this list can never
// drift from the real navigation — including each destination's `mockup` field.
for (const role of ['student', 'teacher'] as const) {
  const { main, footer } = NAV_BY_ROLE[role]
  for (const destination of [...main, ...footer]) {
    test(`${role} ${destination.to}`, async ({ page }, testInfo) => {
      await signIn(page, role)
      await capture(page, destination.to, destination.mockup, testInfo.project.name)
    })
  }
}
