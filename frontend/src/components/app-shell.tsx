import { Outlet } from 'react-router'
import { Brand, Sidebar } from './sidebar'
import { BottomNav } from './bottom-nav'
import { LogoutButton } from './logout-button'

/**
 * Role-aware application shell (AC 2 & 3).
 *
 * Desktop: fixed 260px left sidebar + a fluid content area whose inner width is
 * capped at 1200px (max-w-app) and offset by the sidebar. The offset reuses the
 * --width-sidebar token via an arbitrary value (rather than a second entry on the
 * shared spacing scale, which would also surface as p-sidebar/gap-sidebar/m-sidebar).
 * Mobile/tablet (< md): the sidebar is hidden, a compact top bar shows the brand,
 * a bottom nav replaces the sidebar, and content horizontal margins shrink to 16px.
 */
export function AppShell() {
  return (
    <div className="min-h-dvh bg-background">
      <Sidebar />

      <div className="flex min-h-dvh flex-col md:ml-[var(--width-sidebar)]">
        {/* Compact mobile top bar (brand + logout) — sidebar carries both on desktop. */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-outline-variant bg-surface/90 px-md backdrop-blur md:hidden">
          <Brand />
          <LogoutButton variant="icon" />
        </header>

        {/* px-md (16px) margins on mobile per AC 3; roomier on desktop. pb clears the bottom nav. */}
        <main className="flex-1 px-md pb-24 pt-lg md:px-lg md:pb-lg">
          <div className="mx-auto w-full max-w-app">
            <Outlet />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  )
}
