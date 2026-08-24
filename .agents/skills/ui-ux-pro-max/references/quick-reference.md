# Quick Reference — Full Rule Set (all 10 categories)

Load this file when doing a UI review/audit pass, or when you need the full checklist for a category beyond the priority table in SKILL.md.

## Quick Reference

### 1. Accessibility (CRITICAL)
- `color-contrast` - Minimum 4.5:1 ratio for normal text (large text 3:1); WCAG AA
- `focus-states` - Visible focus rings on interactive elements (2–4px)
- `alt-text` - Descriptive alt text for meaningful images
- `aria-labels` - aria-label for icon-only buttons
- `icon-context` - Semantics depend on use: decorative icons beside visible text are hidden from accessibility tree; meaningful icons need text alternatives; icon controls need accessible names and states
- `keyboard-nav` - Tab order matches visual order; full keyboard support
- `form-labels` - Use label with `for` / `id` attribute
- `skip-links` - Skip to main content for keyboard users
- `heading-hierarchy` - Sequential h1→h6, no level skipping
- `color-not-only` - Don't convey info by color alone (add icon/text)
- `dynamic-type` - Support system text scaling; avoid truncation as text grows
- `reduced-motion` - Respect `prefers-reduced-motion`; reduce/disable animations when requested
- `escape-routes` - Provide cancel/back in modals and multi-step flows
- `focus-not-obscured` - Sticky UI, overlays, and banners must not hide keyboard-focused control
- `web-target-size` - Web pointer targets need 24×24 CSS px minimum or documented exception

### 2. Touch & Interaction (CRITICAL)
- `touch-target-size` - Min 44×44px (iOS) / 48×48dp (Material); extend hit area beyond visual bounds if needed
- `touch-spacing` - Minimum 8px gap between touch targets
- `hover-vs-tap` - Use click/tap for primary interactions; don't rely on hover alone
- `loading-buttons` - Disable button during async operations; show spinner or progress
- `error-feedback` - Clear error messages near the problem
- `cursor-pointer` - Add cursor-pointer to clickable elements
- `gesture-conflicts` - Avoid horizontal swipe on main content; prefer vertical scroll
- `press-feedback` - Visual feedback on press (ripple/highlight/active state)
- `safe-area-awareness` - Keep primary touch targets away from screen edges and gestures

### 3. Performance (HIGH)
- `image-optimization` - Use WebP/AVIF, responsive images, lazy load non-critical assets
- `image-dimension` - Declare width/height or use aspect-ratio to prevent layout shift (CLS < 0.1)
- `font-loading` - Use font-display: swap to avoid invisible text (FOIT)
- `reduce-reflows` - Batch DOM reads then writes
- `virtualize-lists` - Virtualize lists with 50+ items to improve memory efficiency and scroll performance
- `tap-feedback-speed` - Provide visual feedback within 100ms of tap

### 4. Style Selection (HIGH)
- `style-match` - Match style to product type
- `consistency` - Use same style tokens across all pages and components
- `no-emoji-icons` - Use SVG icons (Lucide, Heroicons), not emojis for structural UI
- `effects-match-style` - Shadows, blur, radius aligned with chosen style
- `elevation-consistent` - Use consistent elevation/shadow scale for cards, sheets, modals
- `dark-mode-pairing` - Design light/dark variants together to keep brand, contrast, and style consistent
- `primary-action` - Each screen should have only one primary CTA; secondary actions visually subordinate

### 5. Layout & Responsive (HIGH)
- `viewport-meta` - `width=device-width, initial-scale=1` (never disable zoom)
- `mobile-first` - Design mobile-first, then scale up to tablet and desktop
- `readable-font-size` - Minimum 16px body text on mobile (avoids iOS auto-zoom)
- `line-length-control` - Mobile 35–60 chars per line; desktop 60–75 chars
- `horizontal-scroll` - No horizontal scroll on mobile; ensure content fits viewport width
- `spacing-scale` - Use 4px / 8px incremental spacing scale
- `container-width` - Consistent max-width on desktop
- `z-index-management` - Define layered z-index scale (e.g. 0 / 10 / 20 / 40 / 100 / 1000)

### 6. Typography & Color (MEDIUM)
- `modular-scale` - Use consistent ratio (1.2–1.333) for font size progression
- `contrast-ratios` - 4.5:1 normal text, 3:1 large text, 3:1 interactive elements
- `semantic-tokens` - Use semantic tokens (`--color-surface`, `--color-primary`) rather than raw hex values in components
- `text-overflow` - Handle long strings with truncation + tooltips or wrapping

### 7. Animation & Motion (MEDIUM)
- `motion-duration` - 100–150ms for micro-interactions, 200–300ms for expansions/modals
- `easing-purpose` - `ease-out` for entering elements, `ease-in` for exiting elements, `ease-in-out` for continuous motion
- `hardware-acceleration` - Animate `transform` and `opacity` only; avoid animating `width`, `height`, `top`, `left`
