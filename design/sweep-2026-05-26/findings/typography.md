# typography

**Lens:** Type hierarchy (the visual ranking of text by size, weight, and style), font choices, line height, contrast, and readability at distance (map pin label) and density (search result list).
**Reviewed:** `restaurant-desktop.png` screenshot + `src/app/globals.css`, `src/app/layout.tsx`, `src/app/restaurants/[id]/page.tsx`, `src/components/RestaurantCard.tsx`.

## Top 3 findings

1. [P1] **What's wrong:** The secondary text color `#757575` on white `#FFFEFB` background yields a contrast ratio of approximately 4.5:1 — barely at the WCAG AA threshold and below AA Large for small text. At `text-[10px]` and `text-[11px]` (used for source labels, review counts, and dish count badges in `page.tsx` lines 904–913 and 940–949), this fails AA for body text outright (requires 4.5:1 minimum at normal size, but those sizes are below 18px regular / 14px bold). The `globals.css` line 20 definition `--color-text-secondary: #757575` propagates everywhere.
   **Why it matters:** Users scanning dense rating cells or tiny source labels — especially on a laptop screen at arm's length — will strain to read labels like "1,247 reviews" and "GOOGLE / YELP". Older users and those with moderate low vision are effectively locked out of the secondary information layer.
   **What to do:** Darken `--color-text-secondary` to `#5E5E5E` (contrast ~5.9:1 on white). Audit all `text-[10px]` / `text-[11px]` uses and bump the minimum non-decorative label to `text-xs` (12px).
   **Why you'd want to do this:** Contrast fixes are zero-regression — no layout changes — and they directly reduce user frustration on the page that converts browsers into engaged users (the ratings dashboard is the core value proposition).
   (effort: S)

2. [P1] **What's wrong:** The `h1` (restaurant name) uses `text-2xl sm:text-3xl` — that's 24px on mobile and 30px on desktop (`page.tsx` lines 345–354). The `h2` section headings ("Ratings Dashboard," "On Social," "The Story") are all also `text-2xl` at 24px (`page.tsx` lines 461–471). The restaurant name and section labels are visually the same size, collapsing the heading hierarchy (the ordered ranking of h1 > h2 > h3 that orients a reader). In the screenshot, "JoJo" and "Ratings Dashboard" look nearly identical in weight and scale, so the eye has no natural anchor.
   **Why it matters:** A non-designer scanning the page cannot instantly tell "this is the restaurant, these are sections about it." Every new section requires a mental reset rather than a smooth visual flow — increasing cognitive load on a page already dense with numbers.
   **What to do:** Increase the `h1` to `text-4xl sm:text-5xl` (36–48px) and keep `h2` at `text-2xl`. Alternatively keep `h1` at 30px and reduce `h2` to `text-xl` (20px). Either creates a clear two-level distinction.
   **Why you'd want to do this:** A clear hierarchy is how premium restaurant guides (Eater, Michelin's own site) signal authority; matching that visual grammar builds trust that Gastronome is a serious aggregator.
   (effort: S)

3. [P2] **What's wrong:** The "The Story" description paragraph uses `font-family: var(--font-heading)` (Spectral, a serif) at `fontWeight: 300` italic, 18px, `lineHeight: 1.65` (`page.tsx` lines 762–773). Spectral weight 300 is extremely thin in a light-on-white setting — the strokes disappear on non-retina monitors and on OLED displays that crush near-whites. The italic posture compounds the issue (italic serifs are narrower). The `globals.css` rule at lines 51–53 only applies `font-heading` to `h1, h2, h3`, so this paragraph breaks the implicit rule that Spectral is reserved for display.
   **Why it matters:** This is the editorial moment where a user decides whether the restaurant is "theirs." If the prose is hard to read (faint, cramped strokes), they leave without forming the emotional connection the "Story" section is designed to create.
   **What to do:** Change the paragraph to `fontWeight: 400` (still Spectral for the serif warmth) or switch to `var(--font-body)` DM Sans at weight 400, 17px, `lineHeight: 1.7`. Drop the italic — it reads as emphasis rather than body prose at this length.
   **Why you'd want to do this:** Readability directly correlates with time-on-page; a legible story paragraph increases the chance a user bookmarks the restaurant.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The `AGGREGATED REVIEWS` / `TIKTOK & INSTAGRAM` eyebrow labels use `letterSpacing: '0.18em'` at `text-xs` (12px) uppercase (`page.tsx` lines 455–457). That tracking (space between letters) is very wide for 12px text — it stretches the label beyond the width of the `h2` below it, making the relationship between eyebrow and heading feel loose rather than anchored.
   **Why it matters:** Loose eyebrow labels look like captions from a different section; users may miss that they label the heading beneath them.
   **What to do:** Reduce to `letterSpacing: '0.12em'` — still clearly spaced-caps, but visually tethered to the heading width.
   **Why you'd want to do this:** Tighter eyebrow tracking is the industry standard in editorial design and instantly reads more polished.
   (effort: S)

2. **What's wrong:** The `ScoreCell` rating number (`page.tsx` line 921) is `fontSize: '1.875rem'` (30px) in Spectral, but the denominator `/5` or `/10` drops to `fontSize: '14px'` (`page.tsx` line 931). The jump from 30px to 14px is a ratio of 2.1:1 within a single compound token — far larger than the ~1.3:1 ratio used in editorial design for number/denominator pairs.
   **Why it matters:** The denominator looks like a footnote rather than a unit, making the score harder to parse at a glance — the core action of the ratings dashboard.
   **What to do:** Raise the denominator to `fontSize: '18px'` (ratio ~1.67:1) and keep the same `color: var(--color-text-secondary)` for contrast.
   **Why you'd want to do this:** Better-proportioned denominators are a hallmark of sports scoreboards and financial dashboards — genres users already trust to display comparative numbers.
   (effort: S)

3. **What's wrong:** The "Similar Restaurants" sidebar `h3` (`page.tsx` lines 846–854) is styled as `text-[11px] uppercase` with `fontFamily: var(--font-body)` — identical style to the inline score-cell source labels inside the main column. These are structurally different (one is a section title; the other is a data label) but look identical.
   **Why it matters:** When navigational headings and data labels share the same typographic style, the visual grammar breaks down — users may not register "Similar Restaurants" as a new section.
   **What to do:** Give the sidebar heading `text-xs font-semibold` (600 weight) at `letterSpacing: '0.10em'` to distinguish it from the 500-weight data labels.
   **Why you'd want to do this:** Differentiated sidebar headings help users with low vision (who rely on heading weight to orient) and speed up scanning for sighted users.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** The app runs two Google Fonts — DM Sans (body) and Spectral (headings) — both loaded via `next/font/google` in `layout.tsx` lines 16–28. While self-hosted, both are loaded at 5 weights each (300–700), totaling 10 font face declarations. However, the Spectral faces used in practice are weight 300 (story paragraph), 400 (empty rating dash), and 500 (headings and score numbers). Weights 600 and 700 are declared but unused across the restaurant page.
**Why it matters:** Unused font weights add ~30–50 KB of font data per weight variant and a font parse cost, reducing Largest Contentful Paint (LCP) — the metric Google uses for search ranking. The text itself also relies heavily on inline `style` attributes for font assignment rather than the CSS class system, making future global type changes a file-by-file hunt.
**What to do:** Limit Spectral to `weight: ['300', '400', '500']` and DM Sans to `weight: ['400', '500', '600']`. Migrate repeated inline `fontFamily: var(--font-heading)` declarations to a Tailwind utility class via `@layer utilities { .font-heading { font-family: var(--font-heading); } }` in `globals.css`.
**Why you'd want to do this:** Smaller font payloads improve mobile LCP and Core Web Vitals; a utility class reduces inline style noise and makes a future rebrand a one-line change.
**The tradeoff:** Removing weight 700 from DM Sans means bold interactive elements (navbar, buttons) must stay at 600 — verify no Tailwind `font-bold` class on DM Sans text requires 700 before cutting the weight.
(effort: M)

## Alarming (optional)

The Google Maps Platform "Reject API key" error visible mid-page in the screenshot (`restaurant-desktop.png`) renders as a prominent gray error block inside the map `iframe`, replacing what should be the restaurant's neighborhood map — a confirmed production key misconfiguration that breaks a core UI element for all restaurant detail page visitors.
