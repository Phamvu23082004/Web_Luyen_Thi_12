import { useState } from 'react'
import type { ReactNode } from 'react'
import { RoleContext } from './role-context'
import type { Role } from './role-context'

/**
 * Infer the starting role from the current URL (`/teacher/...` vs everything else)
 * so a page reload on a teacher route doesn't snap the nav back to Student while the
 * URL/content stay on Teacher. Reads `window.location` directly (not a router hook)
 * since RoleProvider sits outside <RouterProvider> in main.tsx.
 */
function inferInitialRole(): Role {
  if (typeof window === 'undefined') return 'student'
  return window.location.pathname.startsWith('/teacher') ? 'teacher' : 'student'
}

/**
 * PROVISIONAL role provider (Story 1.4).
 *
 * Holds a dev-only role in React state purely so the app shell is demonstrable
 * before authentication exists. Story 1.5 replaces the body of this provider with
 * the role read from the verified JWT and drops `setRole`. This file is the ONLY
 * place that source lives — keep the seam here.
 */
export function RoleProvider({
  children,
  /** Starting role — inferred from the URL by default; tests pass this explicitly. */
  initialRole = inferInitialRole(),
}: {
  children: ReactNode
  initialRole?: Role
}) {
  const [role, setRole] = useState<Role>(initialRole)
  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  )
}
