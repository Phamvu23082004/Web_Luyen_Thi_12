import { useRole, useSetRole } from '../lib/use-role'

/**
 * DEV-ONLY provisional role switcher (Story 1.4).
 *
 * Gated behind `import.meta.env.DEV` so it never ships to production. It exists
 * only to demonstrate the role-scoped shell before auth (Story 1.5) lands.
 * Story 1.5 deletes this component along with the `setRole` seam.
 */
export function DevRoleToggle() {
  const role = useRole()
  const setRole = useSetRole()

  // Hooks are called unconditionally above (rules-of-hooks); render nothing in prod.
  if (!import.meta.env.DEV) return null

  const next = role === 'student' ? 'teacher' : 'student'
  return (
    <button
      type="button"
      onClick={() => setRole(next)}
      className="fixed bottom-20 right-md z-50 rounded-full border border-outline-variant bg-surface-container-lowest px-md py-sm text-label-md text-on-surface-variant shadow-sm hover:border-primary hover:text-primary md:bottom-md"
      title="Dev-only: switch role (removed in Story 1.5)"
    >
      Role: {role} → {next}
    </button>
  )
}
