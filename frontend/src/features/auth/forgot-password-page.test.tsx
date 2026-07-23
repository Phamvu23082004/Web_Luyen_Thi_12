import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ForgotPasswordPage } from './forgot-password-page'

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  )
}

const CONFIRMATION =
  'Nếu email tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi.'

function submit(email: string) {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: 'Gửi liên kết đặt lại' }))
}

describe('ForgotPasswordPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the generic confirmation on success (AC 2)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { message: CONFIRMATION } }),
      }),
    )

    renderPage()
    submit('student1@onthi12.local')

    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument()
  })

  // The page cannot distinguish a known from an unknown email — the backend
  // returns the same 200 for both — so testing a second happy-path email would
  // assert nothing. What is worth pinning is that a *failed* request is not
  // reported differently either, and does not escape as a rejected promise.
  it('shows the same confirmation when the request fails outright (AC 2)', async () => {
    const rejections: unknown[] = []
    const onRejection = (e: PromiseRejectionEvent) => rejections.push(e.reason)
    window.addEventListener('unhandledrejection', onRejection)

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    renderPage()
    submit('student1@onthi12.local')

    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()

    await new Promise((resolve) => setTimeout(resolve, 0))
    window.removeEventListener('unhandledrejection', onRejection)
    expect(rejections).toHaveLength(0)
  })

  it('does not leak a backend error message to the user', async () => {
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
    submit('student1@onthi12.local')

    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument()
    expect(screen.queryByText(/Internal server error/)).not.toBeInTheDocument()
  })
})
