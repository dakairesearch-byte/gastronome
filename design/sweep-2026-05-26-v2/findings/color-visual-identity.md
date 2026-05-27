# Color & Visual Identity — Findings
**Specialist:** color-visual-identity | **Sweep:** 2026-05-26-v2

---

## Top 5 Findings

**F1. Brand palette defined but never used — emerald hijacks the product**
`globals.css:13` declares `--color-primary: #D4A574` (warm gold) and `--color-accent: #6B95A8` (slate blue) as the Luxe Moderne palette. In practice every interactive surface uses Tailwind's `emerald-*` utilities instead: hover text (`group-hover:text-emerald-600`, `RestaurantCard.tsx:104,217`), cuisine pills (`bg-emerald-50 text-emerald-700`, lines 109, 262). Emerald is a tech-product default, not a food-publication choice. The brand tokens exist but are orphaned.

**F2. Accolade border accents are arbitrary utility colors with no brand rationale**
`RestaurantCard.tsx:28–33` assigns `border-l-red-400` (Michelin), `border-l-amber-400` (James Beard), `border-l-pink-400` (Eater 38) — all raw Tailwind primitives unconnected to each source's actual brand identity. Michelin red is correct directionally but the shade is arbitrary; amber for James Beard and pink for Eater have no grounding. Seen at scale on `explore-desktop.png` the left-border forest reads as random colorization, not a semantic legend.

**F3. Onboarding surface has zero brand color warmth — the one marketing moment**
`onboarding-1-desktop.png`: the full-page onboarding card is white on `#FFFEFB`, the source-platform pills use tiny 8px colored dots (Google blue, Yelp red, Michelin red, etc.) that disappear at normal reading distance, and the sole brand-colored element is the Continue CTA (`--color-primary` gold). This is the first-impression surface and it reads like a SaaS sign-up wizard, not a curated food publication. No editorial photography, no warm texture, no gradient from `--color-secondary` (#2C3E50).

**F4. Dark footer is a disconnected color universe**
`home-desktop.png` and `onboarding-1-desktop.png`: the footer uses `--color-secondary` (#2C3E50, dark navy) which appears nowhere else on product surfaces. It looks imported from a different product. The Saved Collections section directly above it in home uses full-bleed dark food photography — the visual jump from richly colored photos to a plain dark-navy footer with white DM Sans text reads as two products stapled together.

**F5. No semantic color system — good/warning/danger are all the same gray**
`globals.css` defines no semantic tokens (success, warning, danger). The ratings dashboard on `restaurant-desktop.png` shows Google 4.3 and Yelp 3.7 side-by-side in plain `text-gray-700` with no signal about whether 3.7 is concerning vs. acceptable for that source's distribution. A food-editorial product should communicate quality gradient through color — a 3.7 Yelp should read differently than a 4.7.

---

## 5 Quick Wins

**QW1. Replace `emerald` hover with `--color-primary` gold.**
`RestaurantCard.tsx:104` — `group-hover:text-emerald-600` → `group-hover:text-[var(--color-primary)]`. One token, entire card hover personality shifts from generic-tech to warm editorial.

**QW2. Replace cuisine pill emerald with a brand-warm amber tint.**
`RestaurantCard.tsx:109, 262` — `bg-emerald-50 text-emerald-700` → something like `bg-amber-50 text-amber-800` or a custom class using `--color-primary` at 10% opacity. Aligns cuisine taxonomy with the gold palette.

**QW3. Alias Michelin, JBF, Eater accent colors as named CSS tokens.**
Add `--color-accolade-michelin`, `--color-accolade-jbf`, `--color-accolade-eater` to `globals.css` and reference them in `RestaurantCard.tsx:28–33`. This turns an arbitrary rainbow into a documented semantic system.

**QW4. Add a `--color-rating-warm` / `--color-rating-neutral` pair to `globals.css`.**
Even two semantic rating tones (≥4.0 gold-warm, <3.5 muted gray) would make the ratings dashboard on `restaurant-desktop.png` readable at a glance. No new colors needed — `--color-primary` works as the warm tone.

**QW5. Tie shimmer skeleton colors to the brand palette.**
`globals.css:82–85` — the shimmer animation uses `#f5f0ea → #ede5d8`, which are actually on-brand warm creams. Promote these to tokens (`--color-shimmer-base`, `--color-shimmer-highlight`) so they're intentional and reusable rather than anonymous hex strings.

---

## 2 Bigger Bets

**BB1. Implement a brand-warm editorial header/hero treatment for marketing surfaces.**
Onboarding, the city landing pages, and the Explore Categories strip are all marketing moments dressed in product-neutral white. A gradient from `--color-secondary` (#2C3E50) to near-black with a food-texture overlay — already partially present in the Home collections photography — would give these surfaces the authority of a food publication. This requires a design system decision: which surfaces are "editorial" (dark, warm, textured) vs. "product" (light, airy, functional).

**BB2. Audit and consolidate every color that appears in the rendered app against the `globals.css` token set.**
The current state is a dual-system: `globals.css` defines the Luxe Moderne palette, but components use raw Tailwind utilities (`emerald-*`, `gray-*`, `red-400`, `amber-400`, `pink-400`). A full color audit — `grep -r "text-emerald\|bg-emerald\|border-l-red\|border-l-amber\|border-l-pink" src/` — would surface every deviation. The fix is a Tailwind theme extension that maps `primary`, `accent`, `accolade-michelin`, etc. onto the CSS vars, making every utility class on-brand by default. Without this, any new component written by any engineer defaults back to emerald.

---

## Alarming

**The product and its brand tokens have diverged so completely that the design system is effectively inoperative.** `globals.css` documents a warm, editorial "Luxe Moderne" identity; the rendered product is a standard emerald-and-gray Tailwind app. New components will continue inheriting the generic defaults. The gap will compound with every sprint until a deliberate reconciliation pass forces every interactive color through the token system.
