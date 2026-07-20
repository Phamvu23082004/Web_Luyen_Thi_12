import { Navigate } from 'react-router'
import { useRole } from '../lib/use-role'

/**
 * Provisional index landing: sends `/` to the current role's home.
 *
 * TEMPORARY — Story 1.5 replaces this with real post-login role routing. Kept tiny
 * and behind the same useRole() seam so the swap is contained.
 */
export function RootRedirect() {
  const role = useRole()
  return <Navigate to={`/${role}`} replace />
}
