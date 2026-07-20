import { NAV_BY_ROLE } from '../lib/nav-config'
import { useRole } from '../hooks/use-role'
import { NavItem } from './nav-item'

/**
 * Mobile/tablet bottom navigation (AC 3 — responsive collapse).
 *
 * Below the md breakpoint the 260px sidebar is hidden and replaced by this bar
 * (the pattern the Student Home mockup ships). Same role-scoped destinations as the
 * sidebar, rendered via the shared NavItem in its 'bottom' variant (color-weight-only
 * active state — the sidebar's left-pill doesn't translate to a horizontal bar).
 * overflow-x-auto is a safety net if a role ever grows past what a narrow phone fits.
 */
export function BottomNav() {
  const role = useRole()
  const nav = NAV_BY_ROLE[role]
  const items = [...nav.main, ...nav.footer]
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around overflow-x-auto border-t border-outline-variant bg-surface-container-highest px-sm pb-sm pt-xs md:hidden"
      aria-label="Điều hướng chính"
    >
      {items.map((d) => (
        <NavItem key={d.to} to={d.to} label={d.label} icon={d.icon} end={d.end} variant="bottom" />
      ))}
    </nav>
  )
}
