import { createBrowserRouter } from 'react-router'
import { AppShell } from '../components/app-shell'
import { LoginPage } from '../features/auth/login-page'
import { NAV_BY_ROLE } from '../lib/nav-config'
import type { NavDestination } from '../lib/nav-config'
import { PlaceholderPage } from './placeholder-page'
import { RequireAuth } from './require-auth'
import { RequireRole } from './require-role'
import { RootRedirect } from './root-redirect'

// Each role's destinations become placeholder routes under the AppShell layout.
// Derived from nav-config so routes and the sidebar can never drift apart.
const studentDestinations = [
  ...NAV_BY_ROLE.student.main,
  ...NAV_BY_ROLE.student.footer,
]
const teacherDestinations = [
  ...NAV_BY_ROLE.teacher.main,
  ...NAV_BY_ROLE.teacher.footer,
]

// child paths are relative to the layout route — strip the leading slash
const toRoute = (d: NavDestination) => ({
  path: d.to.replace(/^\//, ''),
  element: <PlaceholderPage title={d.label} mockup={d.mockup} />,
})

export const router = createBrowserRouter([
  // Public — outside AppShell, no sidebar.
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <RootRedirect /> },
          // Split by role and wrap each group in RequireRole — a logged-in
          // Student can no longer render /teacher/* and vice-versa (AC 3).
          {
            element: <RequireRole role="student" />,
            children: studentDestinations.map(toRoute),
          },
          {
            element: <RequireRole role="teacher" />,
            children: teacherDestinations.map(toRoute),
          },
          // Index + 404 stay outside both groups — they apply to any authed role.
          { path: '*', element: <PlaceholderPage title="Không tìm thấy trang" /> },
        ],
      },
    ],
  },
])
