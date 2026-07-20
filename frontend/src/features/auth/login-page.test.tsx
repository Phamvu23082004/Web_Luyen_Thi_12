import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '../../providers/auth-provider'
import { LoginPage } from './login-page'

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('shows a fixed Vietnamese message on invalid credentials, not the raw API error (AC 2)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            statusCode: 401,
            message: 'Invalid email or password',
            error: 'Unauthorized',
          }),
      }),
    )

    renderLoginPage()

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'student1@onthi12.local' },
    })
    fireEvent.change(screen.getByLabelText('Mật khẩu'), {
      target: { value: 'wrong-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Email hoặc mật khẩu không đúng')
    expect(alert).not.toHaveTextContent('Invalid email or password')
  })
})
