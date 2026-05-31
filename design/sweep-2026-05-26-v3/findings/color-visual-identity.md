# Color & Visual Identity — v3 Re-Sweep Findings

**Specialist:** color-visual-identity
**Screenshots reviewed:** home-desktop, restaurant-desktop, explore-mobile, onboarding-1-desktop
**Source reviewed:** `src/app/globals.css`

---

## Status on v2 top issue

[RESOLVED] Focus ring is now `var(--color-secondary)` (#2C3E50 slate), confirmed in `globals.css:131–143`. The gold-on-gold invisibility on primary CTAs is gone. Buttons also get a soft slate halo (`box-shadow: 0 0 0 4px rgba(44,62,80,0.22)`). Verified against onboarding-1-desktop: "CONTINUE" button has a visible dark ring.

[RESOLVED] Semantic accolade, rating, and skeleton tokens are now defined in `globals.css:28–40`. The skeleton shimmer uses warm cream (`#f5f0ea → #ede5d8`) — on-brand.

---

## Top 5 Findings

### 1. Emerald palette is still the dominant interactive color — 99 usages [STILL-OPEN] [P0] Effort: M
The "Luxe Moderne" system (warm gold primary, slate secondary) governs the nav, onboarding, search bar, and bottom nav — but 99 `emerald-*` Tailwind utilities survive everywhere else. The cities hero (`src/app/cities/[slug]/page.tsx:164`) is a full `from-emerald-600 via-emerald-500 to-teal-500` gradient. Active filter chips are `bg-emerald-600`. RestaurantCard hover names go `text-emerald-600`. Error and 404 pages use `bg-emerald-500` CTAs. ReviewForm focus rings fire `focus:ring-emerald-500` directly (overriding the global `:focus-visible` rule). The rendered product still reads as a standard green Tailwind app, not the editorial gold-and-slate brand. Screenshot: explore-mobile shows Top 10 Trending list items with no gold anywhere; the ranking number chip is the only branded element.

### 2. Cities slug page hero actively contradicts brand — large surface, wrong hue [STILL-OPEN] [P1] Effort: S
`src/app/cities/[slug]/page.tsx:164` renders a full-bleed `from-emerald-600 via-emerald-500 to-teal-500` header for every city page. This is the largest single color surface in the product and it is entirely off-brand. The "Gastronome" identity is cream, gold, slate; this hero screams "delivery app circa 2021." Replacing it with `from-[var(--color-secondary)] to-[#1a2a38]` (dark slate gradient) or a photo-under-scrim pattern used on restaurant-desktop would take an hour and unify the two most visited detail views. Cited: `cities/[slug]/page.tsx:164`.

### 3. RestaurantCard accolade border still uses raw Tailwind classes, not the semantic tokens [STILL-OPEN] [P1] Effort: XS
`globals.css` defines `--color-accolade-michelin`, `--color-accolade-jbf`, `--color-accolade-eater38` (lines 30–32). The comment in `RestaurantCard.tsx:34` acknowledges these tokens but the implementation still uses `border-l-red-400`, `border-l-amber-400`, `border-l-pink-400` (lines 41–44). The token exists and is unused — this is a one-line-per-accolade fix that closes a future-drift risk. Cited: `RestaurantCard.tsx:41–44`.

### 4. Dark mode is completely absent [NEW] [P2] Effort: L
Zero `dark:` classes exist in the codebase (confirmed: grep returned 0 results). The token system (`globals.css`) has no `@media (prefers-color-scheme: dark)` block. The cream background (#FFFEFB), white surfaces, and warm gold are pleasant in light mode but will harsh on OLED screens at night — the exact context in which restaurant discovery most often happens. Given the app's food-publication ambition this is a gap vs. Eater, The Infatuation, and NY Mag Grub Street (all dark-mode capable). Filing as P2 because the token architecture makes it achievable: one `:root[data-theme="dark"]` block overriding the 9 tokens would cover most surfaces.

### 5. `not-found.tsx` and `error.tsx` pages fully break brand [NEW] [P2] Effort: XS
`src/app/not-found.tsx:7` renders a `text-6xl font-bold text-emerald-500` "404" and `bg-emerald-500` CTA. `src/app/error.tsx:25` has the same emerald CTA. These pages are the worst possible moment to flash an off-brand color. They are also among the easiest to fix — swap to `style={{ color: 'var(--color-primary)' }}`. Cited: `not-found.tsx:7,15`, `error.tsx:25`.

---

## Quick Wins (≤5)

1. **not-found + error pages** — swap `bg-emerald-500` / `text-emerald-500` to token equivalents. 2 files, 4 lines. Immediate brand win on high-visibility failure states. (`not-found.tsx:7,15`, `error.tsx:25`)
2. **RestaurantCard accolade borders** — replace `border-l-red-400` / `border-l-amber-400` / `border-l-pink-400` with CSS variable references to the tokens already defined. (`RestaurantCard.tsx:41–44`)
3. **Review form focus rings** — `review/page.tsx` and `review/new/page.tsx` each fire `focus:ring-emerald-500` on every text input (~10 instances), overriding the global slate rule. Remove these per-element overrides and let the global rule govern. (`restaurants/[id]/review/page.tsx:212,228`, `review/new/page.tsx:352,362,379,449`)
4. **Recent page hero** — `recent/page.tsx:75` uses `from-gray-900 via-gray-900 to-emerald-950` for the section header. Swap to `to-[var(--color-secondary)]` or drop the emerald entirely; plain `bg-gray-900` already reads as dark/editorial.
5. **profile/[id] avatar** — `profile/[id]/page.tsx:79` renders the user avatar as a solid `bg-emerald-500` circle. `var(--color-primary)` (warm gold) would be on-brand and warmer for a social identity surface.

---

## Two Bigger Bets

**Bet 1 — Systematic emerald-to-token migration (99 usages)**
The 99 emerald instances span 15+ files. A structured migration — define `--color-interactive` (maps to `var(--color-primary)`) and `--color-interactive-hover` alongside the existing tokens, then do a file-by-file sweep with Tailwind's JIT arbitrary-value syntax where a Tailwind class won't compose — would permanently retire the emerald palette. The cities filter chips and the search sidebar active states are the most user-visible. Worth batching as a single "brand reconciliation" PR rather than fixing piecemeal. Estimated: 3–4 hours.

**Bet 2 — Dark mode via token override**
Because all 9 core tokens are in `:root` and the font, skeleton, and semantic tokens are already named, a dark mode pass is mostly value substitution: dark background (`#0F0E0C`), dark surface (`#1A1916`), inverted text, warm gold staying as accent. The hard part is verifying the ~99 raw Tailwind classes that don't respect CSS variables — they'd need the migration above first. Sequence: complete Bet 1, then add the dark block. Result would position Gastronome alongside Eater/Infatuation aesthetically and functionally.

---

## Alarming

The review-writing flow (`/restaurants/[id]/review`, `/review/new`, `/review/[id]/edit`) is entirely off-brand — emerald CTAs, emerald focus rings, emerald star labels. This is the highest-trust moment in the user relationship (leaving a public review) and it looks like a different product from the restaurant detail page that precedes it. These three files have the highest density of emerald usage and are not covered by the primary card/detail token work. They need their own pass.
