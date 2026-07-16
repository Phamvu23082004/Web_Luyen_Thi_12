---
name: Warm EdTech Narrative
colors:
  surface: '#fbf8ff'
  surface-dim: '#dad9e4'
  surface-bright: '#fbf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f2fd'
  surface-container: '#eeedf8'
  surface-container-high: '#e8e7f2'
  surface-container-highest: '#e2e1ec'
  on-surface: '#1a1b23'
  on-surface-variant: '#444654'
  inverse-surface: '#2f3038'
  inverse-on-surface: '#f1f0fb'
  outline: '#747685'
  outline-variant: '#c4c5d6'
  surface-tint: '#2f52d0'
  primary: '#2c50cd'
  on-primary: '#ffffff'
  primary-container: '#496ae8'
  on-primary-container: '#fffbff'
  inverse-primary: '#b8c4ff'
  secondary: '#046c4a'
  on-secondary: '#ffffff'
  secondary-container: '#9bf1c6'
  on-secondary-container: '#0f704e'
  tertiary: '#725c00'
  on-tertiary: '#ffffff'
  tertiary-container: '#cea700'
  on-tertiary-container: '#4e3e00'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#0337b8'
  secondary-fixed: '#9ef4c9'
  secondary-fixed-dim: '#82d8ae'
  on-secondary-fixed: '#002114'
  on-secondary-fixed-variant: '#005237'
  tertiary-fixed: '#ffe082'
  tertiary-fixed-dim: '#ecc228'
  on-tertiary-fixed: '#231b00'
  on-tertiary-fixed-variant: '#564500'
  background: '#fbf8ff'
  on-background: '#1a1b23'
  surface-variant: '#e2e1ec'
typography:
  headline-xl:
    fontFamily: Be Vietnam Pro
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-md:
    fontFamily: Be Vietnam Pro
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Be Vietnam Pro
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Be Vietnam Pro
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-padding-mobile: 20px
  container-padding-desktop: 40px
  gutter: 24px
  section-gap: 64px
---

## Brand & Style
The brand personality is that of a supportive mentor: encouraging, accessible, and optimistic. It aims to lower the barrier to learning by replacing clinical SaaS rigidity with a soft, tactile, and human-centric interface. The target audience includes Vietnamese students and lifelong learners who value clarity without the stress of traditional academic software.

The design style is a blend of **Soft Minimalism** and **Organic Tactility**. It prioritizes heavy whitespace and clean layouts while incorporating playful, rounded elements and a pastel-informed color story. The UI should evoke a sense of progress and comfort, utilizing friendly illustrations and subtle background textures to create a "safe space" for educational exploration.

## Colors
The palette shifts from a high-contrast corporate blue to a softer, more inviting "Periwinkle Blue" primary. This is supported by a trio of pastel accents—**Mint Green** for achievement, **Soft Amber** for focus, and **Peach** for interpersonal or community features.

Neutral tones are shifted toward warm greys and off-whites to reduce eye strain during long study sessions. The semantic logic remains strict for accessibility: Green for "Correct," Red for "Try Again," and Yellow for "Hint," but the saturation is tuned to feel helpful rather than punitive.

## Typography
This design system utilizes **Be Vietnam Pro** across all levels to ensure native tone-mark clarity and a modern, friendly Vietnamese reading experience. Headlines are bold and expressive to guide the eye, while body text uses generous line heights to improve legibility for complex educational content.

The typographic scale is intentionally "bubbly"—slightly larger than standard SaaS sets—to maintain an approachable feel. Captions and labels use medium weights to ensure they don't get lost against the softer color palette.

## Layout & Spacing
The layout follows a **Fluid Grid** model with a maximum content width of 1200px for lessons. We employ an 8px spacing rhythm to maintain mathematical harmony while allowing for significant "breathing room" between modules.

- **Mobile:** 4-column grid with 20px margins. Cards stack vertically.
- **Tablet:** 8-column grid with 24px margins. Sidebar navigation collapses to a bottom bar.
- **Desktop:** 12-column grid with 40px margins. Content is centered with ample whitespace in the margins to reduce cognitive load. 

Layouts should favor asymmetric balance, occasionally breaking the grid with illustrative elements to keep the interface feeling organic rather than mechanical.

## Elevation & Depth
Depth is conveyed through **Tonal Layers** and **Soft Ambient Shadows**. Instead of harsh black shadows, we use shadows tinted with the primary blue (e.g., `rgba(92, 124, 250, 0.08)`) to maintain a "glow" rather than a "drop."

- **Level 0 (Background):** Soft off-white or very light pastel tint.
- **Level 1 (Cards):** Pure white with a 1px border in a slightly darker neutral.
- **Level 2 (Active/Hover):** Substantial blur (24px) with low opacity to create a "lifted" effect.
- **Glassmorphism:** Used sparingly for top navigation bars (backdrop-blur: 12px) to allow background patterns to peek through, creating a sense of continuity.

## Shapes
The shape language is defined by high-radius curves to eliminate "sharpness" from the learning experience. 
- **Buttons:** Fully pill-shaped (999px) to invite interaction.
- **Cards & Containers:** 16px to 24px corner radius (`rounded-lg` and `rounded-xl`).
- **Input Fields:** 12px radius to balance the pill-shaped buttons.
- **Icons:** Wrapped in soft-edged circles or "squiggles" to emphasize the playful nature of the system.

## Components
- **Buttons:** Primary buttons are pill-shaped with a subtle 2px "inner shadow" at the bottom to give a tactile, pressable feel.
- **Cards:** Feature a 1px soft border. Success/Error states change the border color to the respective semantic pastel.
- **Chips/Badges:** Used for tags or categories, these should always be pill-shaped and use high-transparency pastel fills with dark-toned text.
- **Input Fields:** Use a thicker 2px border on focus in the primary blue, with the label floating slightly above.
- **Progress Bars:** Thick (12px height), rounded caps, with a subtle gradient and a small "sparkle" or icon at the leading edge to celebrate progress.
- **Lists:** Items are separated by generous padding rather than lines, using soft-colored background blocks on hover to indicate selection.
- **Illustrations:** Use "Spot Illustrations" in a hand-drawn or soft-vector style in the corners of empty states and dashboard headers.