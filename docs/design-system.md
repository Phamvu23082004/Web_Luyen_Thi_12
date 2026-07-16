---
name: Vietnamese EdTech Standard
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#424754'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#727785'
  outline-variant: '#c2c6d6'
  surface-tint: '#005ac2'
  primary: '#0058be'
  on-primary: '#ffffff'
  primary-container: '#2170e4'
  on-primary-container: '#fefcff'
  inverse-primary: '#adc6ff'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#924700'
  on-tertiary: '#ffffff'
  tertiary-container: '#b75b00'
  on-tertiary-container: '#fffbff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#ffdcc6'
  tertiary-fixed-dim: '#ffb786'
  on-tertiary-fixed: '#311400'
  on-tertiary-fixed-variant: '#723600'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: '1.3'
  h2:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  h3:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: 0.02em
  h1-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-md-mobile:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  sidebar_width: 260px
  container_max: 1200px
  gutter: 20px
---

## Brand & Style

The design system is engineered for **OnThi12**, focusing on the rigorous academic environment of Vietnamese Grade 12 students and their educators. The brand personality is **academic, focused, and high-performance**, stripping away visual noise to prioritize information density and cognitive ease.

The aesthetic follows a **Modern SaaS / Minimalist** movement. It utilizes a flat design language characterized by high-quality typography, a strictly limited color palette, and a clear functional hierarchy. The goal is to evoke a sense of organized calm during the high-pressure exam preparation season, moving away from "playful" juvenile education apps toward a professional tool that treats students as young adults.

**Key Principles:**
- **Clarity over Decoration:** Every element must serve a functional purpose.
- **Focus:** Use whitespace to isolate complex exam content.
- **Efficiency:** Optimized for quick navigation through large question banks and data sets.

## Colors

The palette is rooted in a professional "utility" spectrum. 

- **Primary Action:** Blue (#0058BE) is reserved exclusively for primary actions, active navigation states, and progress indicators.
- **Neutral Foundation:** We use a "Slate" scale for text and "Slate-50/100" for backgrounds to reduce eye strain compared to pure white/black.
- **Semantic Feedback:** Colors are used sparingly but strictly:
    - **Green:** Correct answers, completed modules, or positive growth.
    - **Amber:** Pending reviews, time warnings, or medium-priority alerts.
    - **Red:** Incorrect answers, errors, or critical deadlines.
- **Surface Strategy:** Layers are distinguished by subtle background shifts (e.g., a white card on a light gray workspace) rather than shadows.

## Typography

This design system uses **Inter** for all roles to ensure maximum readability and a technical, modern feel. 

- **Sentence Case:** Always use sentence case for headings and labels to maintain an approachable, professional tone.
- **Line Height:** Body text uses a generous 1.6x line height to help students parse long paragraphs in exam questions or explanations.
- **Vietnamese Support:** Care must be taken with diacritics; Inter's tall x-height and clear glyphs provide excellent legibility for the Vietnamese alphabet.
- **Hierarchy:** Contrast is created primarily through font weight (SemiBold/Bold for headers) rather than drastic size changes.

## Layout & Spacing

The layout philosophy follows a **Fixed-Sidebar/Fluid-Content** model.

- **Sidebar:** A persistent left navigation (260px) provides quick access to subjects, mock tests, and analytics. It should utilize a subtle gray background (#F8FAFC) to differentiate it from the main workspace.
- **Grid:** On desktop, content is contained within a 12-column grid with a max-width of 1200px to ensure line lengths remain readable for educational content.
- **Spacing Scale:** A strict 4px/8px-based system. Use 16px (md) for internal component padding and 24px (lg) for margins between sections.
- **Mobile Adaptation:** On mobile, the sidebar collapses into a bottom navigation bar or a hamburger menu, and horizontal margins shrink to 16px.

## Elevation & Depth

This design system rejects heavy shadows in favor of **Tonal Layers and Borders**.

- **Surfaces:** Use `#FFFFFF` for the primary work surface (cards, inputs) and `#F8FAFC` or `#F1F5F9` for the background.
- **Borders:** Depth is communicated via 1px solid borders using `#E2E8F0`. When an element is hovered or active, the border may transition to `#CBD5E1` or the primary blue.
- **Focus States:** High-contrast focus rings (2px offset, Primary Blue) are essential for keyboard navigation and accessibility during timed tests.
- **No Shadows:** Avoid `box-shadow` unless used for temporary overlays like dropdown menus or modals, in which case use a very soft, high-diffusion shadow: `0 10px 15px -3px rgba(0, 0, 0, 0.05)`.

## Shapes

The design uses a consistent **10px (0.625rem)** corner radius for almost all components, creating a soft but professional geometry.

- **Standard (10px):** Metric cards, input fields, buttons, and status badges.
- **Fully Rounded (Pill):** Used only for progress bar tracks and specific high-visibility "Status Tags" (e.g., "Active," "Completed").
- **Consistency:** Avoid mixing sharp corners with rounded ones to maintain the SaaS-inspired aesthetic.

## Components

- **Sidebar Navigation:** Use 20x20px stroke-based icons. The active state should show a subtle background tint (Primary Blue at 10% opacity) and a 3px vertical "pill" indicator on the left edge.
- **Metric Cards:** Flat white background, 1px border (#E2E8F0), 10px radius. Use Label-SM for titles and H2 for the primary metric.
- **Data Tables:** Minimalist style. Headers in Label-MD (uppercase/bold) with a light gray background. No vertical borders; use subtle horizontal dividers.
- **Multiple Choice Controls:** Large, clickable tap targets for mobile. Use a 1px border that turns Blue (#0058BE) when selected. Correct/Incorrect feedback should fill the background with 10% semantic color and change the border to 100% semantic color.
- **Progress Bars:** A 8px height track. Use the semantic Green for completion and Primary Blue for "in-progress" states.
- **Buttons:** 
    - *Primary:* Solid Blue background, White text.
    - *Secondary:* White background, Slate-200 border, Slate-800 text.
    - *Ghost:* No background or border, Blue text (for secondary actions like "Skip").
- **Status Badges:** Small, 10px rounded containers with 10% opacity background of the semantic color and 100% opacity text color.