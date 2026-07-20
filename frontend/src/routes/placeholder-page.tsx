interface PlaceholderPageProps {
  title: string
  /** Stitch mockup folder this route's real screen will be built against (AC-5). */
  mockup?: string
}

/**
 * Minimal placeholder for a nav destination (Task 8).
 *
 * This story deliberately does NOT build any feature screen — AC 5 makes the Stitch
 * mockups the fidelity bar for LATER stories. These stubs only prove the shell,
 * role-scoped nav, and active-item pill work end-to-end, and point each future dev
 * at the correct mockup folder.
 */
export function PlaceholderPage({ title, mockup }: PlaceholderPageProps) {
  return (
    <section>
      <h1 className="text-h1 text-on-surface">{title}</h1>
      <p className="mt-sm text-body-md text-on-surface-variant">
        Màn hình này sẽ được xây dựng ở một story sau. Đây chỉ là placeholder để chứng
        minh khung điều hướng theo vai trò hoạt động.
      </p>
      {mockup ? (
        <p className="mt-md text-body-sm text-outline">
          Bản thiết kế tham chiếu (AC-5): docs/stitch_exports/{mockup}/
        </p>
      ) : null}
    </section>
  )
}
