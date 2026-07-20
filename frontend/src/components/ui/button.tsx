import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

// Hand-rolled variant map (Decision 1 — no shadcn CLI for a single primitive).
// 10px radius comes from the default `rounded` token (design-system §Shapes).
const base =
  'inline-flex items-center justify-center gap-sm rounded font-medium transition-colors disabled:pointer-events-none disabled:opacity-50'

const VARIANTS: Record<Variant, string> = {
  // Primary: solid blue background, white text.
  primary: 'bg-primary text-on-primary hover:bg-primary-container',
  // Secondary: white background, outline border, dark text.
  secondary:
    'border border-outline-variant bg-surface-container-lowest text-on-surface hover:border-outline',
  // Ghost: no background/border, blue text.
  ghost: 'text-primary hover:bg-primary/10',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-md text-label-md',
  md: 'h-11 px-lg text-body-md',
  // Full-width "hero" contexts (e.g. a full-page auth form's submit button).
  lg: 'h-14 px-xl text-body-lg',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[base, VARIANTS[variant], SIZES[size], className].filter(Boolean).join(' ')}
      {...props}
    />
  )
}
