import {
  BarChart3,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from './role-context'

/**
 * Role → navigation destinations (AC 2 — role-scoped nav).
 *
 * Labels are Vietnamese per the Stitch Home mockups. Icons deviate from the
 * mockups' Material Symbols FONT to lucide's 20×20 stroke icons, honoring the
 * design-system icon SPEC ("20×20px stroke-based icons"). Each destination points
 * at its Stitch mockup folder — the AC-5 fidelity reference a later story builds to.
 *
 * Paths are role-prefixed (/student/*, /teacher/*) so the two destination sets are
 * genuinely disjoint — the front-of-house half of the AUTH-02 isolation the backend
 * enforces in Story 1.6. Story 1.5 adds the real role-landing on top of this.
 */
export interface NavDestination {
  label: string
  to: string
  icon: LucideIcon
  /** NavLink `end` so a parent path doesn't stay active on its children (index item). */
  end?: boolean
  /** Stitch mockup folder under docs/stitch_exports/ — AC-5 reference for later stories. */
  mockup: string
}

export interface RoleNav {
  main: NavDestination[]
  footer: NavDestination[]
}

export const NAV_BY_ROLE: Record<Role, RoleNav> = {
  student: {
    main: [
      { label: 'Trang chủ', to: '/student', icon: Home, end: true, mockup: 'Student - Home' },
      { label: 'Đề thi', to: '/student/exams', icon: ClipboardList, mockup: 'Student - Exam List' },
      { label: 'Thống kê', to: '/student/stats', icon: BarChart3, mockup: 'Student - Results' },
      { label: 'Lớp học', to: '/student/class', icon: GraduationCap, mockup: 'Student - My Class' },
    ],
    footer: [
      { label: 'Cài đặt', to: '/student/settings', icon: Settings, mockup: 'Student - Home' },
    ],
  },
  teacher: {
    main: [
      { label: 'Trang chủ', to: '/teacher', icon: LayoutDashboard, end: true, mockup: 'Teacher - Home' },
      { label: 'Đề thi', to: '/teacher/exams', icon: FileText, mockup: 'Teacher - Exam Management' },
      { label: 'Lớp học', to: '/teacher/class', icon: Users, mockup: 'Teacher - Class Management' },
      { label: 'Thống kê', to: '/teacher/stats', icon: BarChart3, mockup: 'Teacher - Detailed Statistics' },
    ],
    footer: [
      { label: 'Cài đặt', to: '/teacher/settings', icon: Settings, mockup: 'Teacher - Home' },
    ],
  },
}
