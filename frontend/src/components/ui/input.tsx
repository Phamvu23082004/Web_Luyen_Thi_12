import type { InputHTMLAttributes, ReactNode } from 'react'

type Size = 'md' | 'lg'

// Hand-rolled, mirrors button.tsx's pattern (Decision 1 — no shadcn CLI for a single primitive).
const base =
  'w-full border border-outline-variant bg-surface-container-lowest text-on-surface placeholder:text-outline transition-colors focus-visible:border-primary focus-visible:bg-surface-container-lowest disabled:pointer-events-none disabled:opacity-50'

const SIZES: Record<Size, string> = {
  md: 'h-11 rounded px-md text-body-md',
  // A taller, more-rounded variant for "hero" contexts like a full-page auth form.
  lg: 'h-14 rounded-lg px-lg text-body-lg',
}

const ICON_OFFSET: Record<Size, { leading: string; trailing: string; leadingIcon: string; trailingIcon: string }> = {
  md: { leading: 'pl-11', trailing: 'pr-11', leadingIcon: 'left-md', trailingIcon: 'right-md' },
  lg: { leading: 'pl-12', trailing: 'pr-12', leadingIcon: 'left-lg', trailingIcon: 'right-lg' },
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Named `inputSize` — the native `<input>` `size` HTML attribute is a number, not this variant. */
  inputSize?: Size
  /** Decorative icon rendered inside the field, left-aligned. Not interactive. */
  leadingIcon?: ReactNode
  /** Rendered inside the field, right-aligned — can be interactive (e.g. a show/hide-password button). */
  trailingIcon?: ReactNode
}

export function Input({
  className,
  type = 'text',
  inputSize = 'md',
  leadingIcon,
  trailingIcon,
  ...props
}: InputProps) {
  const offsets = ICON_OFFSET[inputSize]
  const input = (
    <input
      type={type}
      className={[
        base,
        SIZES[inputSize],
        leadingIcon && offsets.leading,
        trailingIcon && offsets.trailing,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    />
  )

  if (!leadingIcon && !trailingIcon) return input

  return (
    <div className="relative">
      {leadingIcon && (
        <span
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-outline ${offsets.leadingIcon}`}
        >
          {leadingIcon}
        </span>
      )}
      {input}
      {trailingIcon && (
        <span className={`absolute top-1/2 -translate-y-1/2 ${offsets.trailingIcon}`}>{trailingIcon}</span>
      )}
    </div>
  )
}
