import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { AuthProvider } from '../providers/auth-provider'
import type { Role } from '../contexts/auth-context'
import { RequireRole } from './require-role'

/** Builds a fake (unsigned) access token whose payload decodes to the given role. */
function fakeAccessToken(role: Role): string {
  const payload = btoa(JSON.stringify({ role })).replace(/\+/g, '-').replace(/\//g, '_')
  return `header.${payload}.signature`
}

function renderGuarded(sessionRole: Role, guardRole: Role) {
  return render(
    <AuthProvider
      initialTokens={{ accessToken: fakeAccessToken(sessionRole), refreshToken: 'refresh-token' }}
    >
      <MemoryRouter initialEntries={['/guarded']}>
        <Routes>
          <Route element={<RequireRole role={guardRole} />}>
            <Route path="/guarded" element={<div>guarded content</div>} />
          </Route>
          <Route path="/student" element={<div>student home</div>} />
          <Route path="/teacher" element={<div>teacher home</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

/**
 * Cross-role route guard (AC 3) — the client-side reflection of the backend
 * RolesGuard: a Student must never render a Teacher route and vice-versa; the
 * guard redirects to the user's own role home instead.
 */
describe('RequireRole cross-role redirect', () => {
  it('redirects a Student away from a teacher route to /student', () => {
    renderGuarded('student', 'teacher')
    expect(screen.getByText('student home')).toBeInTheDocument()
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument()
  })

  it('redirects a Teacher away from a student route to /teacher', () => {
    renderGuarded('teacher', 'student')
    expect(screen.getByText('teacher home')).toBeInTheDocument()
    expect(screen.queryByText('guarded content')).not.toBeInTheDocument()
  })

  it('renders the guarded route when the role matches', () => {
    renderGuarded('student', 'student')
    expect(screen.getByText('guarded content')).toBeInTheDocument()
  })
})
