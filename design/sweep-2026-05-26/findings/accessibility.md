# accessibility

**Lens:** WCAG 2.1 AA compliance — color contrast, keyboard navigation, focus management, screen reader semantics, alt text, and motion preferences.
**Reviewed:** `home-desktop.png` screenshot + `src/app/layout.tsx`, `src/app/page.tsx`, `src/components/Navigation.tsx`, `src/components/RestaurantCard.tsx`, `src/app/globals.css`.

## Top 3 findings

1. [P0] **What's wrong:** The focus ring color (`--color-primary: #D4A574`, a warm tan) on a white surface yields a contrast ratio of approximately 2.3:1 — well below the WCAG 3:1 minimum for non-text UI components. `globals.css:63` sets this for all interactive elements sitewide.
   **Why it matters:** Keyboard-only users (motor disabilities, power users) lose all visible indication of which element is focused, effectively making the entire site unnavigable without a mouse.
   **What to do:** Replace the focus outline color with `--color-secondary: #2C3E50` (dark navy, ~10:1 on white) or add a high-contrast fallback via `@media (prefers-color-scheme)`. Update `globals.css:63–74`.
   **Why you'd want to do this:** Focus visibility is a P0 legal requirement under WCAG 2.4.7 and ADA; fixing it also improves experience for all keyboard and switch-device users.
   (effort: S)

2. [P1] **What's wrong:** The mobile menu overlay (`Navigation.tsx:162`) is not a focus trap (a modal that imprisons keyboard focus inside it while open). When the drawer opens, Tab continues cycling into the page behind the overlay. There is also no `aria-modal`, `role="dialog"`, or `aria-label` on the overlay container.
   **Why it matters:** Screen reader users and keyboard users Tab past the drawer into invisible, scroll-locked content — disorientating and potentially unescapable without a mouse.
   **What to do:** Wrap the drawer `div` at `Navigation.tsx:166` with a focus-trap library (e.g. `focus-trap-react`) or manually manage `tabIndex`, add `role="dialog" aria-modal="true" aria-label="Navigation menu"`, and move focus to the close button on open.
   **Why you'd want to do this:** WCAG 2.1 SC 2.1.2 (No Keyboard Trap) and SC 4.1.2 (Name, Role, Value); unfixed, this blocks all keyboard-primary users from using mobile nav.
   (effort: M)

3. [P1] **What's wrong:** The secondary nav label color (`--color-text-secondary: #757575`) on the white/near-white nav background (`rgba(255,255,255,0.97)`) produces a contrast ratio of approximately 4.5:1 — borderline passing for large text but failing for the `text-xs uppercase` (≈10px rendered) nav labels used in `Navigation.tsx:86–89`. Text below 18px regular weight requires 4.5:1 minimum; at this small size the ratio is tight and the all-caps rendering reduces perceived legibility further.
   **Why it matters:** Low-vision users and anyone in bright ambient light will struggle to read inactive nav items; this is the primary wayfinding element on every page.
   **What to do:** Darken inactive nav labels to at least `#595959` (7:1 on white) or increase font size to ≥14px and test contrast again. Screenshot confirms the nav text reads as light gray at desktop scale.
   **Why you'd want to do this:** WCAG SC 1.4.3 (Contrast Minimum); fixing this also improves perceived polish and legibility for all sighted users.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** Collection tile images in `page.tsx:116–119` use `alt="${c.name} collection"` — reasonable — but the wrapping `<Link>` has no `aria-label`, so screen readers announce both the image alt and the heading text `{c.name}` inside, producing a doubled announcement ("Date Night collection Date Night").
   **Why it matters:** Screen reader users hear redundant noise on every collection card, degrading comprehension of the page structure.
   **What to do:** Add `aria-label={c.name}` to the `<Link>` at `page.tsx:108` and change the `<img>` to `alt=""` (presentational) since the link label carries the meaning.
   **Why you'd want to do this:** Reduces screen reader verbosity for all assistive technology users at zero visual cost.
   (effort: S)

2. **What's wrong:** The `MapPin` icon in `RestaurantCard.tsx:114` is rendered inline alongside city text with no `aria-hidden="true"`. Screen readers may announce it as an unlabeled image or SVG element before the city name.
   **Why it matters:** Assistive technology users hear a meaningless icon token before the location — small friction that compounds across every card on the page.
   **What to do:** Add `aria-hidden="true"` to the `<MapPin>` instance at `RestaurantCard.tsx:114` (and the matching instance at line 276 in the hero variant). The surrounding text already conveys the location.
   **Why you'd want to do this:** Cleaner, faster screen reader traversal; 1-attribute fix.
   (effort: S)

3. **What's wrong:** `layout.tsx` has no `<meta name="viewport">` with `user-scalable=no` set — which is actually correct — but there is also no explicit skip-navigation link before `<Navigation />` at `layout.tsx:78`. Keyboard users must Tab through all nav items on every page load before reaching main content.
   **Why it matters:** On a page with 4 nav links plus a sign-in button, that is 5+ Tab presses before reaching any content — a WCAG SC 2.4.1 (Bypass Blocks) failure.
   **What to do:** Add a visually hidden "Skip to main content" anchor as the first child of `<body>` that focuses `<main>` on activation. One `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>` added before `<Navigation />` in `layout.tsx:78`.
   **Why you'd want to do this:** WCAG 2.4.1 is a Level A (baseline) requirement; this is the single highest-ROI accessibility addition for keyboard users.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** No `prefers-reduced-motion` guard exists anywhere in the reviewed files. The collection card images animate `scale-110` over 700ms on hover (`page.tsx:118`), the hero restaurant card animates `scale-105` over 500ms (`RestaurantCard.tsx:188`), and the nav transition scales and shadows animate on every hover. None are wrapped in a `@media (prefers-reduced-motion: reduce)` block in `globals.css`.
**Why it matters:** Users with vestibular disorders (motion sickness, BPPD) can trigger nausea from persistent scale/parallax animations. WCAG SC 2.3.3 (Animation from Interactions) is Level AAA but is increasingly treated as AA in enterprise audits and CVAA filings.
**What to do:** In `globals.css`, add:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```
This is a one-line global suppression. Verify the hover shadow still appears (it is opacity-based, not transform-based, so it will).
**Why you'd want to do this:** Protects users with vestibular sensitivity; increasingly required by enterprise procurement teams.
**The tradeoff:** The "Saved Collections" hover zoom (a deliberate delight interaction visible in the screenshot) becomes a flat state-change for opted-out users — intentional and correct per spec.
(effort: S)
