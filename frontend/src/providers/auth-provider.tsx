import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  AuthContext,
  decodeRole,
  readStoredTokens,
  writeStoredTokens,
} from '../contexts/auth-context'
import type { AuthTokens } from '../contexts/auth-context'
import { apiFetch } from '../lib/api-client'

/**
 * Holds the current token pair (persisted to localStorage) and derives `role`
 * from the access token payload — the single source of truth AD-17 requires.
 * Replaces Story 1.4's provisional RoleProvider.
 */
export function AuthProvider({
  children,
  /** Test-only seam — bypasses localStorage so tests don't need a real signed JWT lookup. */
  initialTokens,
}: {
  children: ReactNode
  initialTokens?: AuthTokens | null
}) {
  const [tokens, setTokens] = useState<AuthTokens | null>(
    () => initialTokens ?? readStoredTokens(),
  )

  const persist = useCallback((next: AuthTokens | null) => {
    writeStoredTokens(next)
    setTokens(next)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const next = await apiFetch<AuthTokens>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      persist(next)
    },
    [persist],
  )

  const logout = useCallback(async () => {
    if (tokens) {
      try {
        await apiFetch('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: tokens.refreshToken }),
        })
      } catch {
        // A network failure must not trap the user in a logged-in-looking UI —
        // clear the local session regardless of the API result.
      }
    }
    persist(null)
  }, [tokens, persist])

  const value = useMemo(
    () => ({
      accessToken: tokens?.accessToken ?? null,
      refreshToken: tokens?.refreshToken ?? null,
      role: tokens ? decodeRole(tokens.accessToken) : null,
      login,
      logout,
    }),
    [tokens, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
