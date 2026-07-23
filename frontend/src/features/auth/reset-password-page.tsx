import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ArrowRight, Lock } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { writeStoredTokens } from '../../contexts/auth-context'
import { ApiError, apiFetch } from '../../lib/api-client'

const MISMATCH_ERROR = 'Mật khẩu xác nhận không khớp'
const MIN_LENGTH_ERROR = 'Mật khẩu phải có ít nhất 8 ký tự'
// Never surface the raw backend message — the 422 collapses three distinct
// causes (unknown/used/expired token) into one generic client-facing string.
const INVALID_TOKEN_ERROR = 'Liên kết không hợp lệ hoặc đã hết hạn'
// Anything that is not a 422 says nothing about the link, so it must not send
// the user off to request a new one — they would just hit the same failure.
const GENERIC_ERROR = 'Không thể đặt lại mật khẩu lúc này. Vui lòng thử lại.'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError(MIN_LENGTH_ERROR)
      return
    }
    if (newPassword !== confirmPassword) {
      setError(MISMATCH_ERROR)
      return
    }

    setSubmitting(true)
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword }),
      })
      // Any session held in this browser was just revoked server-side; leaving
      // the stored pair behind would 401 on the next refresh instead of simply
      // sending the user to log in again.
      writeStoredTokens(null)
      setSuccess(true)
    } catch (err) {
      setError(
        err instanceof ApiError && err.statusCode === 422
          ? INVALID_TOKEN_ERROR
          : GENERIC_ERROR,
      )
    } finally {
      setSubmitting(false)
    }
  }

  // Reached without a token (a truncated link, or the URL typed by hand) — the
  // form would only collect two passwords and then fail on a 400 that reads as
  // "expired link". Say so before the user types anything.
  if (!token) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-surface p-lg">
        <div className="w-full max-w-md space-y-lg">
          <h2 className="text-display text-on-surface">Đặt lại mật khẩu</h2>
          <p role="alert" className="text-body-md text-error">
            {INVALID_TOKEN_ERROR}
          </p>
          <Link to="/forgot-password" className="text-label-md text-primary hover:underline">
            Yêu cầu liên kết mới
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface p-lg">
      <div className="w-full max-w-md">
        <div className="mb-xl text-left">
          <h2 className="text-display text-on-surface">Đặt lại mật khẩu</h2>
          <p className="mt-sm text-body-md text-on-surface-variant">
            Nhập mật khẩu mới cho tài khoản của bạn.
          </p>
        </div>

        {success ? (
          <div className="space-y-lg">
            <p className="text-body-md text-on-surface">
              Mật khẩu đã được đặt lại thành công.
            </p>
            <Link to="/login" className="text-label-md text-primary hover:underline">
              Đăng nhập ngay
            </Link>
          </div>
        ) : (
          <form className="space-y-lg" onSubmit={handleSubmit}>
            <div className="space-y-sm">
              <label className="block text-label-md text-on-surface-variant" htmlFor="newPassword">
                Mật khẩu mới
              </label>
              <Input
                id="newPassword"
                type="password"
                inputSize="lg"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="••••••••"
                leadingIcon={<Lock size={20} aria-hidden="true" />}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-sm">
              <label className="block text-label-md text-on-surface-variant" htmlFor="confirmPassword">
                Xác nhận mật khẩu
              </label>
              <Input
                id="confirmPassword"
                type="password"
                inputSize="lg"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="••••••••"
                leadingIcon={<Lock size={20} aria-hidden="true" />}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            {error && (
              <div>
                <p role="alert" className="text-body-sm text-error">
                  {error}
                </p>
                {error === INVALID_TOKEN_ERROR && (
                  <Link
                    to="/forgot-password"
                    className="mt-sm inline-block text-label-md text-primary hover:underline"
                  >
                    Yêu cầu liên kết mới
                  </Link>
                )}
              </div>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="w-full">
              {submitting ? 'Đang xử lý…' : 'Đặt lại mật khẩu'}
              {!submitting && <ArrowRight size={20} aria-hidden="true" />}
            </Button>
          </form>
        )}
      </div>
    </main>
  )
}
