import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Mail } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { apiFetch } from '../../lib/api-client'

const CONFIRMATION_MESSAGE =
  'Nếu email tồn tại trong hệ thống, một liên kết đặt lại mật khẩu đã được gửi.'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  // AC 2 — every non-network-error response is treated as success, so this
  // page never reveals whether the email actually matched an account.
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
    } catch {
      // Deliberately swallowed, not merely unhandled: showing an error for a
      // rejected request would reveal more than a success does (AC 2). The
      // catch itself is required — apiFetch throws on any non-2xx and on
      // network failure, and without it handleSubmit returns a rejected
      // promise that React's onSubmit discards into an unhandled rejection.
    } finally {
      setSubmitting(false)
      setSubmitted(true)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-lg">
      <div className="w-full max-w-md">
        <div className="mb-xl text-left">
          <h2 className="text-display text-on-surface">Quên mật khẩu?</h2>
          <p className="mt-sm text-body-md text-on-surface-variant">
            Nhập email của bạn, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-lg">
            <p className="text-body-md text-on-surface">{CONFIRMATION_MESSAGE}</p>
            <Link to="/login" className="text-label-md text-primary hover:underline">
              Quay lại đăng nhập
            </Link>
          </div>
        ) : (
          <form className="space-y-lg" onSubmit={handleSubmit}>
            <div className="space-y-sm">
              <label className="block text-label-md text-on-surface-variant" htmlFor="email">
                Email
              </label>
              <Input
                id="email"
                type="email"
                inputSize="lg"
                autoComplete="email"
                required
                placeholder="example@onthi12.local"
                leadingIcon={<Mail size={20} aria-hidden="true" />}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <Button type="submit" size="lg" disabled={submitting} className="w-full">
              {submitting ? 'Đang gửi…' : 'Gửi liên kết đặt lại'}
              {!submitting && <ArrowRight size={20} aria-hidden="true" />}
            </Button>

            <Link to="/login" className="block text-center text-label-md text-primary hover:underline">
              Quay lại đăng nhập
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
