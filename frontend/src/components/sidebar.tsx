import { NAV_BY_ROLE } from '../lib/nav-config'
import { useRole } from '../hooks/use-role'
import { LogoutButton } from './logout-button'
import { NavItem } from './nav-item'

/** Brand block reused by the desktop sidebar and the mobile drawer header. */
export function Brand() {
  return (
    <div className="flex items-center gap-sm px-sm">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-h3 font-bold text-on-primary">
        O
      </div>
      <div>
        <p className="text-h3 font-semibold tracking-tight text-primary">OnThi12</p>
        <p className="text-label-sm text-outline">Ôn thi lớp 12</p>
      </div>
    </div>
  )
}

/** The role-scoped destination list (main + footer) for the fixed desktop sidebar. */
export function SidebarNav() {
  const role = useRole()
  const nav = NAV_BY_ROLE[role]
  return (
    <>
      <nav className="flex flex-1 flex-col gap-xs" aria-label="Điều hướng chính">
        {nav.main.map((d) => (
          <NavItem key={d.to} to={d.to} label={d.label} icon={d.icon} end={d.end} />
        ))}
      </nav>
      <nav className="flex flex-col gap-xs" aria-label="Cài đặt">
        {nav.footer.map((d) => (
          <NavItem key={d.to} to={d.to} label={d.label} icon={d.icon} />
        ))}
        <LogoutButton />
      </nav>
    </>
  )
}

/** Fixed 260px left sidebar (desktop only — hidden below md, see BottomNav). */
export function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-dvh w-sidebar flex-col gap-lg border-r border-outline-variant bg-surface-container-low px-sm py-lg md:flex">
      <Brand />
      <SidebarNav />
    </aside>
  )
}
