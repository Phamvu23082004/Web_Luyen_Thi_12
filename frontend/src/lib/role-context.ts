import { createContext } from 'react'

export type Role = 'student' | 'teacher'

export interface RoleContextValue {
  role: Role
  /** Dev-only seam — Story 1.5 removes this when role comes from the verified JWT. */
  setRole: (role: Role) => void
}

export const RoleContext = createContext<RoleContextValue | null>(null)
