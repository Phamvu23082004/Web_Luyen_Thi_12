import { readStoredTokens } from '../contexts/auth-context'

/** Thrown for any non-2xx response — carries the HTTP status alongside the parsed error message. */
export class ApiError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
  }
}

/**
 * The one API client (spine "Frontend data access" convention) — no ad-hoc
 * `fetch` elsewhere. Wraps the existing Vite dev proxy (`/api` -> :3000).
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const tokens = readStoredTokens()
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json')
  if (tokens?.accessToken) headers.set('Authorization', `Bearer ${tokens.accessToken}`)

  const res = await fetch(`/api${path}`, { ...init, headers })
  const body: unknown = await res.json().catch(() => null)

  if (!res.ok) {
    const message = (body as { message?: unknown } | null)?.message
    const text = Array.isArray(message) ? message.join(', ') : (message ?? 'Request failed')
    throw new ApiError(String(text), res.status)
  }

  // A void/204 success (e.g. logout) has an empty body -> res.json() rejected
  // above and `body` is null. Resolve to undefined instead of dereferencing .data.
  if (body === null) return undefined as T

  return (body as { data: T }).data
}
