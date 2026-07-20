import { useNavigate } from 'react-router'
import { LogOut } from 'lucide-react'
import { useAuth } from '../hooks/use-auth'

/** Logs out and returns to /login. Shared by the desktop Sidebar footer and the mobile top bar. */
export function LogoutButton({ variant = 'sidebar' }: { variant?: 'sidebar' | 'icon' }) {
  const { logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Đăng xuất"
        className="flex h-10 w-10 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-primary/5 hover:text-on-surface"
      >
        <LogOut size={20} strokeWidth={2} aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-sm rounded px-md py-sm text-label-md text-on-surface-variant transition-colors hover:bg-primary/5 hover:text-on-surface"
    >
      <LogOut size={20} strokeWidth={2} aria-hidden="true" />
      <span>Đăng xuất</span>
    </button>
  )
}
