import { NavLink } from 'react-router'
import type { LucideIcon } from 'lucide-react'

interface NavItemProps {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /**
   * 'sidebar' (default): vertical row, 10% primary tint + 3px left pill when active (UX-DR3).
   * 'bottom': compact vertical stack for BottomNav — active shown by color weight only,
   * since a horizontal bar has no room for a left pill.
   */
  variant?: 'sidebar' | 'bottom'
}

const BASE_CLASSES: Record<NonNullable<NavItemProps['variant']>, string> = {
  sidebar: 'relative flex items-center gap-sm rounded px-md py-sm text-label-md transition-colors',
  bottom: 'flex min-w-16 flex-col items-center gap-xs rounded px-sm py-xs text-label-sm transition-colors',
}

const ACTIVE_CLASSES: Record<NonNullable<NavItemProps['variant']>, string> = {
  // 10% primary tint + 3px left pill (UX-DR3; --width-pill is the spec-mandated indicator width)
  sidebar:
    'bg-primary/10 font-semibold text-primary before:absolute before:left-0 before:top-1/2 before:h-6 before:w-pill before:-translate-y-1/2 before:rounded-full before:bg-primary',
  bottom: 'font-semibold text-primary',
}

const INACTIVE_CLASSES: Record<NonNullable<NavItemProps['variant']>, string> = {
  sidebar: 'text-on-surface-variant hover:bg-primary/5 hover:text-on-surface',
  bottom: 'text-on-surface-variant',
}

/**
 * A single navigation link, shared by the desktop Sidebar and the mobile BottomNav
 * (UX-DR3). Uses react-router's NavLink `isActive` rather than manual path matching.
 */
export function NavItem({ to, label, icon: Icon, end, variant = 'sidebar' }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [BASE_CLASSES[variant], isActive ? ACTIVE_CLASSES[variant] : INACTIVE_CLASSES[variant]].join(' ')
      }
    >
      <Icon size={20} strokeWidth={2} aria-hidden="true" />
      <span>{label}</span>
    </NavLink>
  )
}
