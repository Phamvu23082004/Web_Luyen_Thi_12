import { useAuth } from './use-auth'
import type { Role } from '../contexts/auth-context'

/**
 * Re-pointed at the real auth context (Story 1.5) — signature unchanged from
 * the Story 1.4 seam, so app-shell.tsx, sidebar.tsx, bottom-nav.tsx and
 * root-redirect.tsx need no changes beyond their import path.
 * Never called for a logged-out user — the `RequireAuth` route gate ensures that.
 */
export function useRole(): Role {
  const { role } = useAuth()
  if (!role) throw new Error('useRole must be used within an authenticated session')
  return role
}
