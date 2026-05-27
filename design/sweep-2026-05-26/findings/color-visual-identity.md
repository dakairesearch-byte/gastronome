# color-visual-identity

**Lens:** Does the palette feel like a curated food publication, or a generic data dashboard?
**Reviewed:** `home-desktop.png` screenshot + `src/app/globals.css`, `src/components/RestaurantCard.tsx`, `src/components/Navigation.tsx`, `src/components/SectionHeader.tsx`, `src/components/Footer.tsx`, `src/app/page.tsx`.

## Top 3 findings

1. [P1] **What's wrong:** Cuisine pills and card hover states use hardcoded `emerald-600`/`emerald-50`/`emerald-700` Tailwind classes (`RestaurantCard.tsx` lines 104, 109, 217, 261), a color that does not appear anywhere in the design token system (`globals.css` lines 13–35). The brand accent is `--color-accent: #6B95A8` (a muted steel-blue), yet the most visually prominent interactive element — the card hover and the cuisine tag — fires a vivid food-app green with zero connection to the defined palette.
   **Why it matters:** Users see an identity split: warm caramel (`--color-primary`) on CTAs, cold blue (`--color-accent`) on nav underlines and section dividers, and a third rogue green on every card interaction. The app reads as three brands stapled together.
   **What to do:** Replace `text-emerald-600`, `bg-emerald-50`, `text-emerald-700` in `RestaurantCard.tsx` with `var(--color-primary)` / `var(--color-primary)` at low opacity. Add a `--color-primary-subtle` token (`#FAF0E6` or similar) to `globals.css` for the pill background.
   **Why you'd want to do this:** A consistent accent converts the palette from "accidental" to "intentional" — a basic bar for a publication that charges trust on restaurant recommendations.
   (effort: S)

2. [P1] **What's wrong:** There are zero `dark:` Tailwind variants in the entire codebase (confirmed: `grep -rn "dark:" src/` returns 0 results). The token system in `globals.css` defines only light-mode values with no `@media (prefers-color-scheme: dark)` block. The shimmer skeleton (`globals.css` lines 82–85) bakes `#f5f0ea`/`#ede5d8` — warm cream tones that become invisible noise on a dark OS.
   **Why it matters:** A growing share of users run system dark mode. They will see full white surfaces, a cream nav (`rgba(255,255,255,0.97)`, `Navigation.tsx` line 53), and bleached shimmer placeholders — an unintentional blinding experience.
   **What to do:** Add `@media (prefers-color-scheme: dark)` overrides to `:root` in `globals.css` with at minimum: `--color-background: #1A1714`, `--color-surface: #221F1C`, `--color-text: #F0EBE3`, `--color-border: #333`.
   **Why you'd want to do this:** Dark mode parity is table-stakes for 2026; without it, night-browsing users (a core dining-decision scenario) experience eye strain and may abandon.
   (effort: M)

3. [P2] **What's wrong:** Accolade border accents on `RestaurantCard.tsx` (lines 28–32) use raw Tailwind semantic colors — `border-l-red-400` for Michelin, `border-l-amber-400` for James Beard, `border-l-pink-400` for Eater 38 — bypassing the token system entirely. These colors carry no semantic meaning in the brand dictionary and conflict with any future token update.
   **Why it matters:** If the Michelin red accidentally matches an error state in a future design iteration, the visual language breaks. Untokenized colors are also invisible to design tooling.
   **What to do:** Add named tokens to `globals.css`: `--color-accolade-michelin`, `--color-accolade-jbf`, `--color-accolade-eater38`, and update `getBorderAccent()` in `RestaurantCard.tsx` to reference them.
   **Why you'd want to do this:** Consistent token discipline means future palette changes (brand refresh, seasonal theme) propagate everywhere without a file-by-file grep.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The footer (`Footer.tsx` lines 30, 56) uses raw `rgba(255,255,255,0.4)` and `rgba(255,255,255,0.6)` for link text, bypassing tokens.
   **Why it matters:** If `--color-secondary` (#2C3E50) ever changes, the overlaid text contrast may silently fail WCAG AA.
   **What to do:** Add `--color-footer-text: rgba(255,255,255,0.4)` and `--color-footer-label: rgba(255,255,255,0.6)` tokens to `globals.css`; reference them from `Footer.tsx`.
   **Why you'd want to do this:** Centralizes the only dark-surface text values in the app so a brand update won't create invisible footer links.
   (effort: S)

2. **What's wrong:** The `--color-accent` (#6B95A8 steel-blue, `globals.css` line 15) is used simultaneously for the active nav underline (`Navigation.tsx` line 97), the section-header eyebrow and divider (`SectionHeader.tsx` lines 36, 56), and favorites cuisine labels (`FavoritesSection.tsx` line 131) — three very different semantic roles.
   **Why it matters:** A single hue carrying "navigation state," "editorial label," and "taxonomy tag" dilutes each signal; none reads with authority.
   **What to do:** Introduce `--color-nav-active` (can alias accent for now) and `--color-editorial-accent` as separate tokens so they can diverge when the design matures.
   **Why you'd want to do this:** Named semantic tokens make intent explicit and future-proof role splits without a visual change today.
   (effort: S)

3. **What's wrong:** The star in `FavoritesSection.tsx` (line 151) renders in `--color-primary` (caramel gold), while `StarRating.tsx` (line 35) renders stars in `amber-400` — two different gold tones for the same rating metaphor.
   **Why it matters:** Users see mismatched star colors across surfaces, signaling inconsistency rather than a polished system.
   **What to do:** Standardize on a single token (`--color-rating-star`) used in both components.
   **Why you'd want to do this:** Visual consistency in rating stars directly supports trust — the core value proposition of an aggregator app.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** The palette (`globals.css` lines 13–24) is technically "Luxe Moderne" but reads as a database on the home screenshot: the warm cream background (`#FFFEFB`) is undermined by pure-white cards (`--color-surface: #FFFFFF`) and zero use of `--color-primary` as a hero wash or photography overlay. The caramel gold never appears as a background or gradient — only as focus rings, a CTA button, and a star icon.
**Why it matters:** Competitors like Eater and The Infatuation use color boldly as a food-identity signal. Gastronome's homepage looks like a list app.
**What to do:** Apply `--color-primary` at 8–12% opacity as a tinted surface for the "Suggestions" section header band, and use it as a photo-overlay gradient on collection tiles (currently `bg-black/30`), grounding the warm food-publication feeling in the most prominent section of the home page (`page.tsx` line 83).
**Why you'd want to do this:** One targeted primary-color wash would immediately push the visual identity from "aggregator" to "editorial food publication" — the brand aspiration — without touching the token architecture.
**The tradeoff:** Tinted section bands reduce photo contrast and could make restaurant images feel warm-shifted; test with dark photography first.
(effort: M)
