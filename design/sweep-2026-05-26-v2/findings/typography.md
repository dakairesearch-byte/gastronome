# Typography findings — sweep 2026-05-26-v2

## Top 5

**T1 — Restaurant h1 is undersized for a hero moment**
The restaurant name renders at `text-2xl sm:text-3xl` with `fontWeight: 500` over a dark photo overlay.
At 1440 px the name ("JoJo") occupies roughly the same visual weight as the ratings-section h2 ("Ratings Dashboard"), erasing the page-entry hierarchy. Michelin-star restaurants deserve a bolder first impression.
`src/app/restaurants/[id]/page.tsx:344-354` · `screenshot: restaurant-desktop`

**T2 — Secondary-text color (#757575 on white) falls below WCAG AA at small sizes**
`--color-text-secondary: #757575` on `--color-background: #FFFEFB` yields ≈4.5:1, which barely passes large text but fails the 4.5:1 AA threshold for any body text under 18 px — exactly the sizes used for cuisine tags, location lines, and review counts across every card.
`src/app/globals.css:20` · `src/components/RestaurantCard.tsx:113` · `screenshot: cities-newyork-desktop`

**T3 — Spectral is loaded in 5 weights but used in only 2 places**
`layout.tsx` loads Spectral weights 300–700. The font is applied only to `h1/h2/h3` via globals.css and inline styles. H4 and below default to DM Sans, producing a silent mid-hierarchy font switch with no visual differentiation between h3 (Spectral) and h4/label/overline text (DM Sans). The weight range also bloats font payload.
`src/app/layout.tsx:23-28` · `src/app/globals.css:51-53`

**T4 — Nav labels at `text-xs` / `letterSpacing: 0.16em` are too small to read at a glance**
Navigation links render at 12 px in all-caps with wide tracking — a pure decorative aesthetic. At that size and spacing, the words "COMMUNITY" and "PROFILE" require conscious reading rather than peripheral recognition. Desktop users who scan from 60 cm away cannot differentiate items fast enough.
`src/components/Navigation.tsx:85-92` · `screenshot: home-desktop`

**T5 — `text-[11px]` dish-chip text is below the practical mobile floor**
Rating chips and the "Top N" counter on the restaurant page use `text-[11px]` (11 px computed) and `text-xs` (12 px). On a retina display this survives; on a mid-range Android at system font scale 1.0 these are illegible without zooming. No minimum font-size guard is set anywhere in globals.
`src/app/restaurants/[id]/page.tsx:530,559` · `screenshot: restaurant-desktop`

---

## 5 Quick Wins

**QW1 — h4 and section-label text should also use Spectral**
Add `h4` to the `globals.css` selector (currently stops at `h3`) to extend the serif hierarchy to sub-section titles without adding a new weight.
`src/app/globals.css:51`

**QW2 — Spectral weight load can drop to 3 weights**
Remove weights 300 and 600 from the Spectral declaration; 400/500/700 cover every actual usage, saving ~30 KB of font transfer.
`src/app/layout.tsx:25`

**QW3 — Section overline `letterSpacing: 0.18em` is inconsistent with nav's 0.16em**
Two hardcoded tracking values exist for the same overline pattern. Unify to a single CSS custom property `--tracking-overline: 0.16em` and reference it from both places.
`src/app/restaurants/[id]/page.tsx:455` · `src/components/Navigation.tsx:89`

**QW4 — Restaurant h1 weight should increase to 600 or 700**
Changing `fontWeight: 500` to `fontWeight: 700` on the restaurant hero h1 costs zero bundle and immediately elevates the name above the Ratings Dashboard h2.
`src/app/restaurants/[id]/page.tsx:349`

**QW5 — Line-height is unset on description body copy**
The "About" / description paragraph inherits Tailwind's default `leading-normal` (1.5) but Spectral at the sizes used here reads better at 1.65–1.75. An explicit `leading-relaxed` class would improve readability for multi-sentence descriptions without touching the design system.
`src/app/restaurants/[id]/page.tsx` (description render block)

---

## 2 Bigger Bets

**BB1 — Establish a formal type-scale token layer in globals.css**
Currently font sizes are scattered Tailwind utility classes (`text-2xl`, `text-base`, `text-xs`, `text-[11px]`) with no named semantic tokens. A 6-step scale (`--type-display`, `--type-h1` … `--type-caption`) would let the cities-newyork list (which today reads as a uniform wall of `text-sm` regardless of item importance) acquire genuine hierarchy, and would make it possible to enforce a mobile minimum (e.g. `--type-caption: max(11px, 0.75rem)`) in one place.
`src/app/globals.css` · `screenshot: cities-newyork-desktop`

**BB2 — Replace the all-caps nav with mixed-case at a slightly larger size**
The current nav aesthetic borrows from luxury editorial (all-caps, wide tracking, small size) but the execution at 12 px loses too much legibility for a utility-first navigation bar. Mixed-case DM Sans at 13–14 px with moderate tracking (0.04em) would preserve the refined feel while halving the time-to-read — a net improvement for both new and returning users without changing the visual identity.
`src/components/Navigation.tsx:85-92`

---

## Alarming

**Spectral italic is not loaded.** The font declaration in `layout.tsx` specifies only weights (no `style: ['normal', 'italic']`). Any component that applies `font-italic` to Spectral headings will trigger browser-synthesised faux-italic — a known rendering artifact that is visually distinct (skewed, no true optical correction) and inconsistent across OS. Currently no component appears to use Spectral italic, but the risk is latent; the fix is adding `style: ['normal', 'italic']` to the Spectral config.
`src/app/layout.tsx:23-28`
