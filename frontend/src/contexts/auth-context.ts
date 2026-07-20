import { createContext } from 'react'

export type Role = 'student' | 'teacher'

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthContextValue {
  accessToken: string | null
  refreshToken: string | null
  /** Decoded from the access token payload — null when logged out. */
  role: Role | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'onthi12.auth'

/** Reads the persisted token pair (survives a page reload). Not React state — used by api-client.ts too. */
export function readStoredTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthTokens
  } catch {
    // Unavailable or corrupt storage (private mode, disabled, bad JSON) —
    // treat as no session rather than crashing AuthProvider's initializer.
    return null
  }
}

export function writeStoredTokens(tokens: AuthTokens | null): void {
  try {
    if (tokens) localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable/quota — React state still holds the session for this
    // page; cross-reload persistence is best-effort only.
  }
}

/**
 * Tiny inline base64url-JSON decode of the access token's payload segment —
 * no `jwt-decode` dependency for a three-line operation. UI routing only, not
 * a trust decision: the server is the sole authority once Story 1.6 lands.
 */
export function decodeRole(accessToken: string): Role | null {
  try {
    const payload = accessToken.split('.')[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = JSON.parse(atob(base64)) as { role?: unknown }
    return json.role === 'student' || json.role === 'teacher' ? json.role : null
  } catch {
    return null
  }
}
