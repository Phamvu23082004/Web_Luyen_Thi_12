import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ResetPasswordPage } from './reset-password-page'

function renderPage(entry = '/reset-password?token=abc123') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

function fillAndSubmit(password: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Mật khẩu mới'), {
    target: { value: password },
  })
  fireEvent.change(screen.getByLabelText('Xác nhận mật khẩu'), {
    target: { value: confirm },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Đặt lại mật khẩu' }))
}

describe('ResetPasswordPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a confirmation on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { message: 'Mật khẩu đã được đặt lại thành công.' } }),
      }),
    )

    renderPage()
    fillAndSubmit('NewPassword123!', 'NewPassword123!')

    expect(
      await screen.findByText('Mật khẩu đã được đặt lại thành công.'),
    ).toBeInTheDocument()
  })

  it('shows a generic invalid-link message on a 422, not the raw API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            statusCode: 422,
            message: 'Invalid or expired reset token',
            error: 'Unprocessable Entity',
          }),
      }),
    )

    renderPage()
    fillAndSubmit('NewPassword123!', 'NewPassword123!')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Liên kết không hợp lệ hoặc đã hết hạn')
    expect(alert).not.toHaveTextContent('Invalid or expired reset token')
  })

  it('reports a non-422 failure as a retryable error, not as an expired link', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ statusCode: 500, message: 'Internal server error' }),
      }),
    )

    renderPage()
    fillAndSubmit('NewPassword123!', 'NewPassword123!')

    const alert = await screen.findByRole('alert')
    // Telling the user the link expired would send them to request a new one
    // and hit the very same outage again.
    expect(alert).toHaveTextContent('Không thể đặt lại mật khẩu lúc này')
    expect(alert).not.toHaveTextContent('Liên kết không hợp lệ hoặc đã hết hạn')
    expect(
      screen.queryByRole('link', { name: 'Yêu cầu liên kết mới' }),
    ).not.toBeInTheDocument()
  })

  it('refuses to show the form at all when the link carries no token', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPage('/reset-password')

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Liên kết không hợp lệ hoặc đã hết hạn',
    )
    expect(screen.queryByLabelText('Mật khẩu mới')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Yêu cầu liên kết mới' }),
    ).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a mismatched confirmation client-side without calling the API', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    renderPage()
    fillAndSubmit('NewPassword123!', 'Different123!')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Mật khẩu xác nhận không khớp')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
