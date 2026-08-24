# Common Rules for Professional UI + Pre-Delivery Checklist

## Icons & Visual Elements

| Rule | Standard | Avoid | Why It Matters |
|------|----------|--------|----------------|
| **No Emoji as Structural Icons** | Use vector-based icons (e.g., Lucide, Heroicons, custom SVG). | Using emojis (🎨 🚀 ⚙️) for navigation, settings, or system controls. | Emojis are font-dependent, inconsistent across platforms, and cannot be controlled via design tokens. |
| **Vector-Only Assets** | Use SVG or platform vector icons that scale cleanly and support theming. | Raster PNG icons that blur or pixelate. | Ensures scalability, crisp rendering, and dark/light mode adaptability. |
| **Contextual Semantics** | Decorative icons beside visible text must have `aria-hidden="true"`; standalone icons need `aria-label`. | Unlabeled icon buttons or duplicated screen-reader announcements. | Ensures clean accessibility. |
| **Stable Interaction States** | Use color, opacity, or elevation transitions for press states without changing layout bounds. | Layout-shifting transforms that move surrounding content or trigger visual jitter. | Prevents visual jarring and misclicks. |
| **Consistent Icon Sizing** | Define icon sizes as design tokens (e.g., 16px, 20px, 24px). | Mixing arbitrary values like 17px, 22px, 29px randomly. | Maintains rhythm and visual hierarchy across the interface. |
| **Touch Target Minimum** | Minimum 44×44px hit area; expand hit padding when the visual icon is smaller. | Tiny tap targets that cause missed clicks on touch screens. | Ensures reliable interaction across devices. |

## Interaction & Polish Checklist

- [ ] **Tap feedback**: Provide clear pressed feedback (ripple/opacity/elevation) within 80-150ms.
- [ ] **Animation timing**: Use shared tokens chosen for distance and purpose.
- [ ] **Accessibility focus**: Ensure keyboard focus order matches visual order with visible focus rings.
- [ ] **Disabled states**: Use disabled semantics (`disabled` attribute/property), reduced opacity (0.5), and `pointer-events: none` or clear tooltips.
- [ ] **Dark mode contrast**: Ensure text and icon contrast meets 4.5:1 minimum on all elevated surfaces.
- [ ] **Responsive behavior**: Tested at 375px, 768px, 1024px, and 1440px+ without horizontal overflow.
