import { defineConfig, devices } from '@playwright/test'

/**
 * Visual-fidelity harness (PROJECT-STANDARDS §14.2).
 *
 * Not a functional test suite — Vitest owns behaviour. This exists so the
 * "does it look like the mockup" check is a repeatable command instead of the
 * Project Lead opening a browser, which is how every UI defect in Epic 1 was
 * actually found (see epic-1-retro-2026-07-23.md, Pattern 7).
 *
 * The two viewports are the ones the design system defines behaviour for:
 * desktop (sidebar visible) and mobile (sidebar collapsed to the bottom nav).
 */
export default defineConfig({
  testDir: './visual',
  // Screenshots must be deterministic: one worker, no retries, no parallel racing
  // against a single dev server.
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1400, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
