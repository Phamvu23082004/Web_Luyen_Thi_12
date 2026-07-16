---
name: modern-css
description: Reference for writing modern, robust, efficient CSS — container queries, cascade layers, OKLCH and relative color, light-dark theming, fluid type, scroll-driven animations, view transitions, anchor positioning, popover/dialog, @property, field-sizing, and Baseline support checking. Use whenever writing, reviewing, or refactoring CSS; building responsive layouts or components; theming or dark mode; animations and transitions; or styling forms and interactive UI — even when the user doesn't say "modern CSS". Prefer native CSS over JS libraries for layout, animation, and interaction.
---

# Modern CSS

This skill provides a reference for writing modern, robust, and efficient CSS.

---

## Layout & Responsive Design

### Container Queries
```css
.card {
  container: --my-card / inline-size;
}

@container --my-card (width < 40ch) {
  /* Component-based responsive design */
}

@container (20ch < width < 50ch) {
  /* Range syntax */
}
```

**Container units:** `cqi`, `cqb`, `cqw`, `cqh` - size relative to container dimensions

**Anchored container queries:** ⚠️ **Limited availability / experimental — syntax unsettled.** Style positioned elements based on anchor fallback state. Verify current syntax on Baseline before use; treat the below as illustrative, not canonical.
```css
.tooltip {
  container-type: anchored;
}

@container anchored(top) {
  /* Styles when positioned at top */
}
```

### Media Query Range Syntax
```css
@media (width <= 1024px) { }
@media (360px < width < 1024px) { }
```


### Grid Enhancements
- **Subgrid:** Inherit parent grid lines for nested layouts. *(Widely available.)*
- **Masonry:** ⚠️ **Not settled — do not ship.** The spec is still contested between `display: grid-lanes` / `item-flow` and `grid-template-rows: masonry`; the syntax that lands may differ from any shown here. Check Baseline before using, and gate behind `@supports`.

---

## Color & Theming

### Color Scheme & Light-Dark Function
```css
:root {
  color-scheme: light dark;
  --surface-1: light-dark(white, #222);
  --text-1: light-dark(#222, #fff);
}
```

### Modern Color Spaces
```css
/* OKLCH: uniform brightness, P3+ colors */
.vibrant {
  background: oklch(72% 75% 330);
}

/* Display-P3 for HDR displays */
@media (dynamic-range: high) {
  .neon {
    --neon-red: color(display-p3 1 0 0);
  }
}

/* Better gradients with in oklch */
.gradient {
  background: linear-gradient(
    to right in oklch,
    color(display-p3 1 0 .5),
    color(display-p3 0 1 1)
  );
}
```

### Color Manipulation
```css
/* color-mix() */
.lighten {
  background: color-mix(in oklab, var(--brand), white);
}

/* Relative color syntax */
.lighter {
  background: oklch(from blue calc(l + .25) c h);
  background: oklch(from blue 75% c h); /* Set to specific lightness */
}

.semi-transparent {
  background: oklch(from var(--color) l c h / 50%);
}

.complementary {
  background: hsl(from blue calc(h + 180) s l);
}
```

### Accent Color
```css
:root {
  accent-color: hotpink; /* Tints checkboxes, radios, range inputs */
}
```

---

## Typography

### Text Wrapping
```css
h1 {
  text-wrap: balance; /* Balanced multi-line headings */
  max-inline-size: 25ch;
}

p {
  text-wrap: pretty; /* No orphans */
  max-inline-size: 50ch;
}
```

### Text Box Trim
⚠️ **Newly/limited — syntax still moving** (also written as `text-box-trim` / `text-box-edge`). Confirm on Baseline; gate with `@supports (text-box: trim-both cap alphabetic)`.
```css
h1, p, button {
  text-box: trim-both cap alphabetic; /* Optical vertical centering */
}
```

### Fluid Typography
```css
.heading {
  font-size: clamp(1rem, 1rem + 0.5vw, 2rem); /* Respects user preferences */
}
```

### Dynamic Viewport Units
- `dvh` / `dvw` - Dynamic (accounts for mobile browser UI)
- `svh` / `svw` - Small (smallest possible viewport)
- `lvh` / `lvw` - Large (largest possible viewport)

---

## Animations & Motion

### Scroll-Driven Animation
```css
/* Animate on scroll position */
.parallax {
  animation: slide-up linear both;
  animation-timeline: scroll();
}

/* Animate on viewport intersection */
.fade-in {
  animation: fade linear both;
  animation-timeline: view();
  animation-range: cover -75cqi contain 20cqi;
}
```

### View Transitions
**Status:** Baseline Newly Available (Same-document).
Cross-document transitions are in Limited Availability (Chrome/Safari 18.2+).

```css
@view-transition {
  navigation: auto; /* Automatically animate page transitions (MPAs) */
}

nav {
  view-transition-name: --persist-nav; /* Persist specific elements */
  view-transition-class: --site-header; /* Group transitions with classes */
}

/* Style the active transition */
html:active-view-transition {
  overflow: hidden;
}
```

**Nested View Transition Groups:** Preserve 3D transforms and clipping during transitions.

### Advanced Easing with linear()
```css
.springy {
  --spring: linear(
    0, 0.14 4%, 0.94 17%, 1.15 24% 30%, 1.02 43%, 0.98 51%, 1 77%, 1
  );
  transition: transform 1s var(--spring);
}
```

### @starting-style
```css
.dialog {
  transition: opacity .5s, scale .5s;

  @starting-style {
    opacity: 0;
    scale: 1.1;
  }
}
```

---

## Custom Properties & Advanced Features

### @property
Type-safe, animatable custom properties:
```css
@property --gradient-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}

.animate {
  transition: --gradient-angle 1s ease;

  &:hover {
    --gradient-angle: 360deg;
  }
}
```

### Math Functions & calc-size()
⚠️ **`calc-size()` is Limited availability** (Chromium-only at time of writing) — the trig/`calc()` math below is widely available, but `calc-size()` is not. Gate height-to-`auto` transitions behind `@supports (height: calc-size(auto, size))` and keep a non-animated fallback.

```css
/* Finally: Animate to auto height! */
.accordion-content {
  height: 0;
  overflow: hidden;
  transition: height 0.3s ease;
}

.accordion-item.open .accordion-content {
  height: calc-size(auto);
}

.radial-layout {
  --_angle: calc(var(--sibling-index) * var(--_offset));
  translate:
    calc(cos(var(--_angle)) * var(--_circle-size))
    calc(sin(var(--_angle)) * var(--_circle-size));
}
```

### Tree Counting Functions (Coming Soon)
```css
.staggered {
  animation-delay: calc(sibling-index() * .1s);
  background-color: hsl(sibling-count() 50% 50%);
}
```

### Conditional CSS with if() (Coming Soon)
```css
.dynamic {
  color: if(
    style(--theme: dark),
    white,
    black
  );
}
```

---

## Architecture & Organization

### Cascade Layers
```css
@layer reset, design-system, components, utilities;

@import "open-props/colors" layer(design-system);
@import "components/nav/base.css" layer(components.nav);

@layer components.nav.primary {
  nav {
    position: sticky;
    inset-block-start: 0;
  }
}
```

Benefits:
- Import third-party CSS with lower specificity
- Organize styles by concern, not selector weight
- Nested layers create clear hierarchies

---

## Interactive Components

### Dialog
```html
<dialog id="modal">
  <form method="dialog">
    <button value="cancel">Cancel</button>
    <button value="confirm">Confirm</button>
  </form>
</dialog>

<button commandfor="modal" command="showModal">Open</button>
<button commandfor="modal" command="close">Close</button>
```

⚠️ **`command`/`commandfor` (Invoker Commands) and `closedby` are Limited availability.** The `<dialog>` element itself + `showModal()`/`close()` are widely available — fall back to a tiny JS click handler where the declarative commands aren't supported.

### Popover
```html
<button popovertarget="menu">Show Menu</button>
<div popover id="menu">...</div>
```

**popover=hint:** ⚠️ **Limited availability.** Ephemeral tooltips that don't dismiss other popovers. (Base `popover` / `popovertarget` is widely available; `hint` is not yet.)

```css
[popover] {
  transition:
    display .5s allow-discrete,
    overlay .5s allow-discrete,
    opacity .5s;

  @starting-style {
    &:popover-open {
      opacity: 0;
    }
  }
}
```

### Anchor Positioning
```css
.tooltip-anchor {
  anchor-name: --tooltip;
}

.tooltip[popover] {
  position-anchor: --tooltip;
  position-area: block-start;
  position-try-fallbacks: flip-block;
  position-try-order: most-height;
}
```

**Pseudo-elements:** `anchor()`, `::scroll-button()`, `::scroll-marker()`

### Exclusive Accordion
```html
<details name="accordion">...</details>
<details name="accordion">...</details>
<!-- Only one can be open at a time -->
```

### Customizable Select
⚠️ **Limited availability.** `appearance: base-select` and rich-HTML options are Chromium-only at time of writing — must degrade to a native select. Gate with `@supports`.
```css
select {
  appearance: base-select; /* Full CSS control */
}

/* Style options with rich HTML */
select option::before {
  content: ""; /* Can include images, icons */
}
```

### Search Element
```html
<search>
  <form>
    <input type="search" name="q">
    <button type="submit">Search</button>
  </form>
</search>
```

---

## Form Enhancements

### Field Sizing
```css
textarea, select, input {
  field-sizing: content; /* Auto-grow to content */
}

textarea {
  min-block-size: 3lh; /* Line-height units */
  max-block-size: 80dvh;
}
```

### Better Validation Pseudo-Classes
```css
/* Wait for user interaction before showing errors */
:user-invalid {
  outline-color: red;
}

:user-valid {
  outline-color: green;
}

label:has(+ input:user-invalid) {
  text-decoration: underline wavy red;
}
```

### HR in Select
```html
<select>
  <option>Option 1</option>
  <hr>
  <option>Option 2</option>
</select>
```

---

## Visual Effects

### Scrollbar Styling
```css
.custom-scrollbar {
  scrollbar-color: hotpink transparent;
  scrollbar-width: thin;
}
```

### Shape Function
⚠️ **Newly/limited availability.** `clip-path: shape()` is recent — confirm on Baseline and provide a fallback `clip-path` (or none) for non-supporting browsers.
```css
.complex-clip {
  clip-path: shape(
    from 0% 0%,
    curve by 50% 25% via 25% 50%,
    line to 100% 100%
  );
}
```

### Corner Shapes
⚠️ **Limited availability / experimental.** `corner-shape` is not broadly shipped — purely decorative, so let it degrade to normal `border-radius`. Gate with `@supports (corner-shape: squircle)`.
```css
.fancy-corners {
  corner-shape: squircle;
  corner-shape: notch;
  corner-shape: scoop;
  corner-shape: superellipse(0.7);
}
```

---

## Progressive Enhancement Patterns

### Feature Detection
```css
@supports (animation-timeline: view()) {
  .fade-in {
    animation: fade linear both;
    animation-timeline: view();
  }
}

@supports (container-type: inline-size) {
  .responsive-card {
    container-type: inline-size;
  }
}
```

### Respect User Preferences
```css
@media (prefers-reduced-motion: no-preference) {
  .animated {
    animation: slide 1s ease;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --surface: #222;
  }
}

@media (prefers-contrast: more) {
  .text {
    font-weight: 600;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .glass {
    backdrop-filter: none;
    background: var(--surface);
  }
}

@media (prefers-reduced-data: reduce) {
  .hero {
    background-image: none; /* Skip heavy decorative assets */
  }
}
```

---

## Accessibility

Modern CSS adds power that quietly breaks accessibility if used carelessly — interactivity expressed in style, motion, color, and reordering all have a11y consequences. Defaults that keep interfaces usable:

### Focus visibility
```css
/* Style focus for keyboard users; don't kill the outline outright */
:focus-visible {
  outline: 2px solid light-dark(#0050c0, #6aa6ff);
  outline-offset: 2px;
}

/* Only remove the default ring once you've provided :focus-visible */
:focus:not(:focus-visible) {
  outline: none;
}
```

### Color & contrast
- Body text needs WCAG contrast (≥4.5:1 normal, ≥3:1 large). `oklch`'s uniform lightness makes this easier to reason about — but still verify computed contrast, especially with `light-dark()` and relative-color math that can drift a pair below threshold.
- Never encode meaning in color alone (error/success): pair with text, icon, or shape.
- Respect `forced-colors` (Windows High Contrast): use `forced-colors: active` and system color keywords rather than fighting the user's palette.

```css
@media (forced-colors: active) {
  .button {
    border: 1px solid ButtonText; /* System color keyword */
  }
}
```

### Motion
- Heavy scroll-driven animations and view transitions can trigger vestibular issues. Wrap non-essential motion in `@media (prefers-reduced-motion: no-preference)`, or disable inside `(reduce)` (as the card example does).

### Don't let layout reorder break reading order
- `order` (flex/grid), `grid-template-areas`, and `flex-direction: row-reverse` change *visual* order but **not** DOM/tab order. A keyboard or screen-reader user still traverses source order. Keep them aligned, or fix the source order instead of patching visually.

### Touch targets & sizing
- Interactive targets ≥24×24px (WCAG 2.2 minimum; 44×44px is the comfortable iOS target). Don't shrink hit areas below this with tight padding.
- Prefer relative units (`rem`, `ch`, `lh`) over `px` for type and spacing so user zoom / font-size preferences are honored.

---

## Checking Browser Support: Baseline

**What is Baseline?** A unified way to understand cross-browser feature availability. Features are marked as:

- **Widely Available:** Supported in the last 2.5 years of all major browsers
- **Newly Available:** Available in all major browsers
- **Limited Availability:** Not yet in all browsers

### How to Check Baseline Status

0. BEST: Fetch https://web-platform-dx.github.io/web-features-explorer/groups/ and find the feature in there, then fetch it's detail page.
1. **Can I Use:** [caniuse.com](https://caniuse.com) shows Baseline badges at the top of each feature
2. **MDN:** Look for the Baseline badge in the browser compatibility table
3. **web.dev:** Feature articles include Baseline status


**Remember:** Always check Baseline status, use `@supports` for cutting-edge features, and respect user preferences with media queries. Modern CSS is about progressive enhancement and building resilient interfaces that work for everyone.


---

## Real-World Example: Modern Component

A full card component combining container queries, `@property`, OKLCH + relative color, `light-dark()`, view transitions, scroll-driven animation, anchor positioning, and progressive enhancement lives in **`references/example-component.md`** (CSS + HTML). Read it when you want a worked end-to-end example or a pattern to adapt.


## Canonical Resources

- [CSS Wrapped 2025](https://chrome.dev/css-wrapped-2025/) - The year's CSS features
- [The Coyier CSS Starter](https://frontendmasters.com/blog/the-coyier-css-starter/) - Opinionated modern baseline
- [Adam Argyle's CascadiaJS 2025 Deck](https://cascadiajs-2025.netlify.app/) - (markdownified locally in `references/argyle-cacadia-2025-deck.md`)
- [Modern CSS in Real Life](https://chriscoyier.net/2023/06/06/modern-css-in-real-life/) - Practical applications


## Usage Guidelines

1.  **Prioritize Stability:**
    *   Recommend **Newly Available** or **Widely Available** features for production code.
    *   Use **Limited Availability** features with progressive enhancement, graceful degredation, or `@supports`. Or ask the user how they want to handle it.

2.  **Use the web platform:**
    *   Always prefer standard CSS solutions over JavaScript libraries for layout, animation, and interaction (e.g., use CSS Masonry instead of Masonry.js, Popover API instead of custom tooltip scripts).

3.  **Code Style:**
    *   Use modern color spaces (`oklch`) for new palettes.
