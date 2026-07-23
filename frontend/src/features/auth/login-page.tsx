import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  LaptopMinimal,
  Lock,
  Mail,
} from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { useAuth } from '../../hooks/use-auth'

const GENERIC_ERROR = 'Email hoặc mật khẩu không đúng'

/**
 * First story to populate features/. Layout adapted from docs/stitch_exports/Login
 * (split-screen composition + hero illustration side) but rebuilt on this
 * project's real design tokens (Inter, existing color palette, Button/Input
 * primitives, lucide icons — no external image/font CDN) and with the
 * mockup's still-out-of-scope affordances (remember-me, Google login, sign-up
 * link) removed — the forgot-password link is wired below (Story 1.8).
 */
export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      // Navigate to '/' and let RootRedirect compute the role-specific home —
      // avoids duplicating that logic here (AC 1).
      navigate('/', { replace: true })
    } catch {
      setError(GENERIC_ERROR)
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-dvh">
      {/* Left panel — hidden below md, mirrors the mockup's illustration side. */}
      <section className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden bg-primary-container p-xl text-center text-on-primary-container md:flex">
        <GraduationCap
          size={40}
          strokeWidth={1.5}
          aria-hidden="true"
          className="absolute left-xl top-xl opacity-40"
        />

        {/* Hero card — stands in for the mockup's photo illustration (no external
            image asset available/allowed); built purely from tokens + icons. */}
        <div className="relative mb-xl w-full max-w-xs -rotate-2 transition-transform duration-500 hover:rotate-0 md:max-w-sm">
          <span className="absolute -left-4 -top-4 h-16 w-16 rounded-full bg-white/20 blur-xl" aria-hidden="true" />
          <span
            className="absolute -bottom-6 -right-2 h-20 w-20 rounded-full bg-white/10 blur-xl"
            aria-hidden="true"
          />
          <div className="relative flex aspect-square w-full items-center justify-center rounded-xl bg-white/10 shadow-2xl ring-1 ring-white/25 backdrop-blur-sm">
            <LaptopMinimal size={88} strokeWidth={1.25} aria-hidden="true" className="opacity-90" />
          </div>
        </div>

        <h1 className="text-display font-bold tracking-tight">OnThi12</h1>
        <p className="mt-sm max-w-sm text-body-lg italic opacity-90">
          Đồng hành cùng sĩ tử chinh phục ước mơ
        </p>

        <BookOpen
          size={56}
          strokeWidth={1.5}
          aria-hidden="true"
          className="absolute bottom-xl right-xl opacity-20"
        />
      </section>

      {/* Right panel — the login form. */}
      <section className="flex flex-1 items-center justify-center bg-surface p-lg">
        <div className="w-full max-w-md">
          <div className="mb-lg flex items-center gap-sm md:hidden">
            <GraduationCap size={28} className="text-primary" aria-hidden="true" />
            <span className="text-h2 font-bold text-primary">OnThi12</span>
          </div>

          <div className="mb-xl text-left">
            <h2 className="text-display text-on-surface">Chào mừng bạn đến với OnThi12</h2>
            <p className="mt-sm text-body-md text-on-surface-variant">
              Vui lòng đăng nhập để tiếp tục hành trình học tập.
            </p>
          </div>

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

            <div className="space-y-sm">
              <label className="block text-label-md text-on-surface-variant" htmlFor="password">
                Mật khẩu
              </label>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                inputSize="lg"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                leadingIcon={<Lock size={20} aria-hidden="true" />}
                trailingIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="pointer-events-auto text-outline transition-colors hover:text-on-surface"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Link
                to="/forgot-password"
                className="block text-right text-label-md text-primary hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>

            {error && (
              <p role="alert" className="text-body-sm text-error">
                {error}
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="w-full shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0"
            >
              {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
              {!submitting && <ArrowRight size={20} aria-hidden="true" />}
            </Button>
          </form>
        </div>
      </section>
    </main>
  )
}
