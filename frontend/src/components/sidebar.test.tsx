import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { RoleProvider } from '../lib/role-provider'
import { NAV_BY_ROLE } from '../lib/nav-config'
import type { Role } from '../lib/role-context'
import { Sidebar } from './sidebar'

function renderSidebar(role: Role) {
  return render(
    <MemoryRouter>
      <RoleProvider initialRole={role}>
        <Sidebar />
      </RoleProvider>
    </MemoryRouter>,
  )
}

/** The main-nav link hrefs, in order — the meaningful lock for role scoping. */
function mainNavHrefs() {
  const nav = screen.getByRole('navigation', { name: 'Điều hướng chính' })
  return within(nav)
    .getAllByRole('link')
    .map((link) => link.getAttribute('href'))
}

/**
 * Role-scoped navigation (AC 2) — the front-of-house half of the AUTH-02 / AD-17
 * isolation the backend enforces in Story 1.6: a Student must never see Teacher
 * destinations and vice-versa. This is the one behavioral test the shell must lock.
 */
describe('Sidebar role-scoped navigation', () => {
  it('renders exactly the Student destinations for role=student', () => {
    renderSidebar('student')
    expect(mainNavHrefs()).toEqual(NAV_BY_ROLE.student.main.map((d) => d.to))
    // No teacher-only destination leaks in.
    for (const d of NAV_BY_ROLE.teacher.main) {
      expect(screen.queryByRole('link', { name: new RegExp(`^${d.label}$`) })?.getAttribute('href')).not.toBe(d.to)
    }
  })

  it('renders exactly the Teacher destinations for role=teacher', () => {
    renderSidebar('teacher')
    expect(mainNavHrefs()).toEqual(NAV_BY_ROLE.teacher.main.map((d) => d.to))
    // No student-only destination leaks in.
    const hrefs = mainNavHrefs()
    for (const d of NAV_BY_ROLE.student.main) {
      expect(hrefs).not.toContain(d.to)
    }
  })
})
