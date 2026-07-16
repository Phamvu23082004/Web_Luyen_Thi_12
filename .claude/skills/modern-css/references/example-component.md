# Real-World Example: Modern Component

A card component combining many modern CSS features — container queries, `@property`, OKLCH + relative color, `light-dark()`, view transitions, scroll-driven animation, anchor positioning, and progressive enhancement.

> Note: this example deliberately uses some Limited-availability features (`text-box`, `popover="hint"`, scroll-state container queries). In production, gate those behind `@supports` and keep fallbacks — see the status tags in SKILL.md.

```css
/* Cascade layer for organization */
@layer components.card {

  /* Custom properties with @property */
  @property --card-hue {
    syntax: "<number>";
    inherits: false;
    initial-value: 200;
  }

  .card {
    /* Container for responsive design */
    container: card / inline-size;

    /* Logical properties */
    inline-size: 100%;
    padding-inline: var(--space-md);
    padding-block: var(--space-lg);

    /* Modern color system */
    background: light-dark(
      oklch(98% 0.02 var(--card-hue)),
      oklch(20% 0.02 var(--card-hue))
    );

    /* Border with relative color */
    border: 1px solid oklch(from var(--surface) calc(l * 0.9) c h);

    /* Smooth corners */
    border-radius: var(--radius-md);

    /* View transition */
    view-transition-name: --card;

    /* Scroll-driven animation */
    animation: fade-in linear both;
    animation-timeline: view();
    animation-range: entry 0% cover 30%;

    /* Anchor for tooltips */
    anchor-name: --card-anchor;

    /* Transition custom property */
    transition: --card-hue 0.5s var(--ease-spring-3);

    &:hover {
      --card-hue: 280;
    }

    /* Responsive typography in container */
    @container card (width > 30ch) {
      .card__title {
        font-size: clamp(1.5rem, 3cqi, 2.5rem);
        text-wrap: balance;
      }
    }

    @container card (width < 30ch) {
      .card__image {
        aspect-ratio: 16 / 9;
        object-fit: cover;
      }
    }
  }

  .card__title {
    /* Text box trim for optical alignment */
    text-box: trim-both cap alphabetic;
    text-wrap: balance;

    /* Logical margin */
    margin-block-end: var(--space-sm);
  }

  .card__body {
    text-wrap: pretty;
    max-inline-size: 65ch;
  }

  .card__cta {
    /* Inherit font */
    font: inherit;

    /* Accent color */
    accent-color: var(--brand);

    /* Field sizing */
    field-sizing: content;

    /* Logical properties */
    padding-inline: var(--space-md);
    padding-block: var(--space-sm);

    /* Modern color with relative syntax */
    background: oklch(from var(--brand) l c h);
    color: oklch(from var(--brand) 95% 0.05 h);

    &:hover {
      background: oklch(from var(--brand) calc(l * 1.1) c h);
    }

    &:user-invalid {
      outline: 2px solid light-dark(red, #ff6b6b);
    }
  }

  /* Popover tooltip anchored to card */
  .card__tooltip[popover] {
    position-anchor: --card-anchor;
    position-area: block-start;
    position-try-fallbacks: flip-block;

    /* Entry animation */
    @starting-style {
      opacity: 0;
      scale: 0.9;
    }

    transition:
      opacity 0.2s,
      scale 0.2s,
      display 0.2s allow-discrete,
      overlay 0.2s allow-discrete;
  }

  /* Scroll state container queries */
  @supports (container-type: scroll-state) {
    .card__sticky-header {
      container-type: scroll-state;
      position: sticky;
      inset-block-start: 0;

      @container scroll-state(stuck: top) {
        box-shadow: 0 2px 8px oklch(0% 0 0 / 0.1);
      }
    }
  }

  /* Respect user preferences */
  @media (prefers-reduced-motion: reduce) {
    .card {
      animation: none;
      transition: none;
    }
  }

  @media (prefers-contrast: more) {
    .card {
      border-width: 2px;
    }
  }
}

/* Keyframes for scroll animation */
@keyframes fade-in {
  from {
    opacity: 0;
    scale: 0.95;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}
```

## HTML for the Example

```html
<article class="card">
  <img
    class="card__image"
    src="image.jpg"
    alt="Description"
    loading="lazy"
  >

  <h2 class="card__title">Card Title</h2>

  <p class="card__body">
    Card description with pretty text wrapping that avoids orphans.
  </p>

  <button
    class="card__cta"
    popovertarget="card-tooltip"
  >
    Learn More
  </button>

  <div
    class="card__tooltip"
    popover="hint"
    id="card-tooltip"
  >
    Additional information appears here
  </div>
</article>
```
