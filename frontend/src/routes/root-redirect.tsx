import { Navigate } from 'react-router'
import { useRole } from '../hooks/use-role'

/**
 * Index landing: sends `/` to the current role's home. Also where the login
 * page's post-login navigate('/') lands, so it's the one place role-routing
 * logic lives (AC 1).
 */
export function RootRedirect() {
  const role = useRole()
  return <Navigate to={`/${role}`} replace />
}
