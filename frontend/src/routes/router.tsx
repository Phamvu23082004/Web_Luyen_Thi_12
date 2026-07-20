import { createBrowserRouter } from 'react-router'
import { AppShell } from '../components/app-shell'
import { LoginPage } from '../features/auth/login-page'
import { NAV_BY_ROLE } from '../lib/nav-config'
import { PlaceholderPage } from './placeholder-page'
import { RequireAuth } from './require-auth'
import { RootRedirect } from './root-redirect'

// Every role-scoped destination becomes a placeholder route under the AppShell
// layout. Derived from nav-config so routes and the sidebar can never drift apart.
const destinations = [
  ...NAV_BY_ROLE.student.main,
  ...NAV_BY_ROLE.student.footer,
  ...NAV_BY_ROLE.teacher.main,
  ...NAV_BY_ROLE.teacher.footer,
]

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
          ...destinations.map((d) => ({
            // child paths are relative to the layout route — strip the leading slash
            path: d.to.replace(/^\//, ''),
            element: <PlaceholderPage title={d.label} mockup={d.mockup} />,
          })),
          { path: '*', element: <PlaceholderPage title="Không tìm thấy trang" /> },
        ],
      },
    ],
  },
])
