# Typography findings — sweep 2026-05-26-v3

## Status on v2 issues

- **T1 (h1 undersized)** — [RESOLVED]. Hero h1 is now `text-3xl sm:text-4xl` at `fontWeight: 700`, clearly outweighs the "By the Numbers" h2 below it. Confirmed in `page.tsx:359–366` and `restaurant-desktop.png`.
- **T2 (secondary-text #757575 contrast)** — [RESOLVED]. `--color-text-secondary` bumped to `#5E5E5E` in `globals.css:22`. That's ~6.5:1 on the cream background — passes WCAG AA at all sizes.
- **T3 (Spectral over-loaded weights)** — [RESOLVED]. Weights 300/600 dropped; now loads 400/500/700 only. `layout.tsx:32–37`.
- **T4 (nav labels too small/tracked)** — [STILL-OPEN]. Nav links remain `text-xs uppercase` at `letterSpacing: 0.12em` (desktop) and `0.16em` (mobile drawer). Tightening from 0.16em → 0.12em was the stated fix; the desktop nav was already 0.12em in v2, so net change is minimal. 12 px all-caps still requires deliberate reading. `Navigation.tsx:100–103`, `restaurant-mobile.png`.
- **T5 (11 px chip floor)** — [STILL-OPEN]. `text-[11px]` persists at 9 distinct locations in `page.tsx` (lines 547, 575, 594, 685, 800, 1013, 1108) plus a `text-[10px]` label at line 1071 and `text-[9px]` badge numbers at lines 648/665 — the 9 px cases are new and worse than what was flagged in v2.
- **Spectral italic (Alarming)** — [RESOLVED]. `style: ['normal', 'italic']` is now declared in `layout.tsx:34`. The description paragraph at `page.tsx:851` uses `className="italic"` on a Spectral element — the true italic now renders correctly instead of browser-synthesised faux-italic.
- **QW3 (overline tracking inconsistency)** — [STILL-OPEN]. Section overlines in the restaurant page use `letterSpacing: '0.18em'` (lines 472, 528, 712, 828) while nav uses 0.12em/0.16em. Three separate values with no shared token.

---

## Top 5

**T1 — text-[9px] badge numbers are below any legible floor** [STILL-OPEN] [P0] [S]
The dish-mention count badges render at 9 px (`text-[9px]`, lines 648 and 665 of `page.tsx`). On any non-retina screen — or with OS font scaling — this is physically unreadable. It was not flagged in v2 (only 11 px was). Raise to `text-[11px]` minimum; consider replacing the count with a simple dot or pill that doesn't need a number at that size.
`src/app/restaurants/[id]/page.tsx:648,665` · `screenshot: restaurant-desktop`

**T2 — RestaurantCard ignores the design token system entirely** [NEW] [P1] [M]
Cards use raw Tailwind utilities — `text-gray-900`, `text-gray-500`, `text-gray-400`, `text-emerald-700`, `text-emerald-600` — with no reference to `--color-text`, `--color-text-secondary`, or `--font-heading`/`--font-body` (except the h3 which correctly uses `var(--font-heading)`). The cuisine pill renders `bg-emerald-50 text-emerald-700`, a hard-coded green that clashes with the "Luxe Moderne" gold/slate palette visible everywhere else. On `cities-newyork-desktop.png` the card grid looks like a different app from the restaurant detail hero.
`src/components/RestaurantCard.tsx:191,198,210,215` · `screenshot: cities-newyork-desktop`

**T3 — City page h1 uses `font-extrabold` (800) in plain Tailwind, not Spectral** [NEW] [P1] [S]
`<h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">` at `cities/[slug]/page.tsx:186`. This renders in DM Sans (the body font), not Spectral, and at weight 800 which is not loaded. The browser synthesises a faked bold. The restaurant hero h1 correctly uses Spectral at 700; the city h1 does not — two hero headings with different typefaces breaks the typographic system.
`src/app/cities/[slug]/page.tsx:186` · `screenshot: cities-newyork-desktop`

**T4 — Nav all-caps 12 px still requires deliberate reading** [STILL-OPEN] [P1] [M]
Despite the v2 fix narrowing letter-spacing to 0.12em, nav items remain `text-xs uppercase` — 12 px all-caps at arm's length. "COMMUNITY" is 9 characters at that size; peripheral recognition fails. The mobile drawer compounds this: the "Sign in" CTA drops to `text-xs uppercase tracking-wider` (line 241 of `Navigation.tsx`) next to links of the same size, collapsing the CTA/nav hierarchy on mobile.
`src/components/Navigation.tsx:100,241` · `screenshot: restaurant-mobile`

**T5 — "The Story" body is set in Spectral weight 300, which is not loaded** [NEW] [P1] [S]
`page.tsx:855` sets `fontWeight: 300` on the description paragraph. Spectral is now loaded at weights 400/500/700 only — 300 is gone (correctly removed in v2). The browser will synthesise a thin weight, producing inconsistent rendering across OS/browser. Change to `fontWeight: 400` (regular) to use the loaded weight.
`src/app/restaurants/[id]/page.tsx:855` · `screenshot: restaurant-desktop`

---

## Quick wins

**QW1 — Raise text-[9px] to text-[11px] in two lines** Dish badge numbers at lines 648 and 665 are the worst offenders; a two-line change fixes the floor. `page.tsx:648,665`

**QW2 — Fix "The Story" fontWeight 300 → 400** One-line change; prevents browser weight synthesis on a key editorial moment. `page.tsx:855`

**QW3 — Add `fontFamily: 'var(--font-heading)'` to city h1** Aligns the city hero with the restaurant hero. Remove `font-extrabold`; use `font-bold` (700 is loaded). `cities/[slug]/page.tsx:186`

**QW4 — Unify overline tracking to one value** Three values (0.12em, 0.16em, 0.18em) for the same overline pattern. Promote `--tracking-overline: 0.14em` to `globals.css` and reference it from section overlines and nav. `page.tsx:472,528,712,828`, `Navigation.tsx:103`

**QW5 — Replace raw `text-gray-*` with design tokens on card secondary text** Swap `text-gray-500` / `text-gray-400` for `color: var(--color-text-secondary)` in RestaurantCard to unify contrast guarantees and palette. `RestaurantCard.tsx:210,215`

---

## Bigger bets

**BB1 — Formalize a type-scale token layer in globals.css**
Font sizes are still scattered across `text-xs`, `text-sm`, `text-base`, `text-2xl`, `text-3xl`, `text-4xl`, `text-[9px]`, `text-[10px]`, `text-[11px]`, and raw `fontSize: '18px'` inline styles — no shared semantic names and no enforced floor. A 6-step scale with a CSS `max()` guard (e.g. `--type-caption: max(11px, 0.75rem)`) in `globals.css` would eliminate the 9 px regression and prevent future sub-floor sizes without per-component audits. Applies across ~15 files.

**BB2 — Migrate RestaurantCard to the design token palette**
Cards are the highest-frequency surface (cities, explore, search, home all render them) yet they reference a parallel emerald/gray palette disconnected from the gold/slate/cream system. Replacing `text-emerald-*`, `bg-emerald-*`, and `text-gray-*` with design tokens would unify the visual system and make theme changes (dark mode, brand refresh) a single-file edit instead of hunting through card markup. Medium effort; high visual payoff on every list surface.
