import { Navigate, Outlet } from 'react-router'
import { useAuth } from '../hooks/use-auth'

/**
 * Authenticated-vs-not gate for the whole AppShell route tree (Task 8).
 * NOT the Student/Teacher cross-role guard — that's Story 1.6's AC.
 */
export function RequireAuth() {
  const { accessToken, role } = useAuth()
  // A present-but-undecodable token (no readable role) is treated as logged
  // out — otherwise the gate would admit it and useRole() would then crash the
  // shell instead of sending the user back to /login.
  if (!accessToken || !role) return <Navigate to="/login" replace />
  return <Outlet />
}
