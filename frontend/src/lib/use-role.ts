import { useContext } from 'react'
import { RoleContext } from './role-context'
import type { Role } from './role-context'

/**
 * Provisional role source — the single Story 1.4 → 1.5 seam.
 *
 * TEMPORARY: the role is held in React state and flipped by a dev-only toggle
 * (see components/dev-role-toggle.tsx). Story 1.5 replaces the RoleProvider body
 * with the verified-JWT `role` (ARCHITECTURE-SPINE AD-17) WITHOUT touching the
 * shell/nav components that consume this hook — the shape ('student' | 'teacher')
 * stays identical, so the swap is mechanical.
 */
export function useRole(): Role {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useRole must be used within <RoleProvider>')
  return ctx.role
}

/** Dev-only: flip the provisional role. Not for feature code — removed in Story 1.5. */
export function useSetRole(): (role: Role) => void {
  const ctx = useContext(RoleContext)
  if (!ctx) throw new Error('useSetRole must be used within <RoleProvider>')
  return ctx.setRole
}
