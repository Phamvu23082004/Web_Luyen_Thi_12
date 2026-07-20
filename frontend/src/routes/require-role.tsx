import { Navigate, Outlet } from 'react-router'
import { useRole } from '../hooks/use-role'
import type { Role } from '../contexts/auth-context'

/**
 * Cross-role gate (Story 1.6 AC 3). Runs inside the RequireAuth subtree, so a
 * decodable role is guaranteed — a Student hitting /teacher/* (or vice-versa) is
 * redirected to their own role home rather than rendering the other role's shell.
 *
 * Defense-in-depth / UX only — the backend RolesGuard is the authoritative
 * security boundary; the frontend can't be trusted.
 */
export function RequireRole({ role }: { role: Role }) {
  const current = useRole()
  if (current !== role) return <Navigate to={`/${current}`} replace />
  return <Outlet />
}
