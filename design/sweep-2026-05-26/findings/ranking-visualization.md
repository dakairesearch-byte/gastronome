# ranking-visualization

**Lens:** How rank and score are displayed — numeric badges, ordered lists, methodology visibility, and whether the visual hierarchy lets users understand why one restaurant outranks another.
**Reviewed:** `explore-desktop.png` + `src/components/explore/Top10Trending.tsx`, `src/app/explore/page.tsx`, `src/lib/ranking/trending.ts`.

## Top 3 findings

1. [P0] **What's wrong:** The trending score (a computed, normalized number that drives the entire rank order) is never shown to the user. The list displays Google + Yelp ratings on the right side of each row, but those are *input signals*, not the ranking signal. A user sees #3 has a 4.4 Google rating and #4 has a 4.5 — and rightly concludes the order makes no sense. (`Top10Trending.tsx` lines 410–440; screenshot: rating cluster on each row.)
   **Why it matters:** The ranking loses credibility the moment a user spots a lower-rated restaurant sitting above a higher-rated one. They have no way to understand that "trending" weighs recent videos, reviews, and photos — not raw ratings.
   **What to do:** Add a one-line "why trending" caption per row: e.g., "12 new videos · 30d" pulled from the `trending_counts` prop already available on `TrendingRestaurant` (see `trending.ts` line 36–39). Even a simple "trending" pill without the numbers is better than naked rating scores that contradict the order.
   **Why you'd want to do this:** Transparent ranking signals are the primary reason to use an aggregator over a single-source app. Hiding them removes the product's core value proposition.
   (effort: S)

2. [P1] **What's wrong:** The map panel renders a Google Maps API rejection error in plain text (visible in `explore-desktop.png`, upper-right of the map panel). The fallback SVG grid was the design intent for this state (`Top10Trending.tsx` lines 517–538), but the rejected-key iframe loads first and overlays it. Users see an error banner inside a "Top 10 Trending" feature panel.
   **Why it matters:** An error message inside a flagship content module destroys trust faster than an empty state. It implies the data itself may be broken, not just the map.
   **What to do:** Gate the iframe on a runtime health-check or catch the Maps `STATUS` error via `postMessage` and swap to the SVG fallback. Short-term: remove the iframe when the key is invalid so the graceful fallback always shows.
   **Why you'd want to do this:** The fallback grid is tasteful and functional — it just needs to actually appear.
   (effort: S)

3. [P1] **What's wrong:** The filtered restaurant grid (accolade and cuisine views) sorts by `google_rating` descending (`page.tsx` line 350–354) but shows no rank numbers, no score, and no sort label — the user cannot tell this is a sorted list or by what criterion. The Top 10 list uses rank circles; the filtered grid uses none.
   **Why it matters:** Without a visible sort signal (an "ordered by: Google rating" label or position numbers), users treat the grid as editorial or arbitrary, weakening trust in recommendations.
   **What to do:** Add a sort-indicator label above the grid — e.g., "Sorted by Google rating" — matching the existing `activeSort` state already threaded through `page.tsx` (line 184). A–Z is already labeled implicitly but "top" is silent.
   **Why you'd want to do this:** Surfaces the algorithm's logic at the moment users are evaluating options, which is exactly when they need to trust it.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The section header reads "Top 10 Trending" even when fewer than 10 restaurants have a non-zero score (`Top10Trending.tsx` lines 282–286 handle this for the title, but the "Top 10" in the `<SectionHeader label>` is always the city name, not the count — the dynamic title only applies inside the component). If the list shows 7 items, "Top 10" is factually wrong.
   **Why it matters:** A user who counts 7 rows and reads "Top 10" loses trust in the entire section's accuracy.
   **What to do:** The component already conditionally renders `Top ${items.length} Trending` — confirm `SectionHeader`'s `title` prop (not `label`) carries this dynamic value and that it renders prominently enough to read as the heading, not the label.
   **Why you'd want to do this:** Takes 5 minutes and prevents a factual error on the flagship section.
   (effort: S)

2. **What's wrong:** Accolade badges (Michelin rosette, Bib Gourmand, James Beard, Eater E) appear without text labels at list scale (`Top10Trending.tsx` lines 121–187). They rely entirely on `title` / `aria-label` tooltip text, which is invisible until hover and absent on mobile.
   **Why it matters:** A Michelin star is a ranking differentiator, but users unfamiliar with the rosette icon get no signal. Accolades are part of *why* a restaurant is prestigious.
   **What to do:** Show a short text label ("Michelin ★", "Bib", "JBF") inline next to the icon on the list rows, or reserve badge-only display for cases where a legend is visible nearby.
   **Why you'd want to do this:** Accolades directly justify a restaurant's ranking position; making them readable reinforces algorithm credibility.
   (effort: S)

3. **What's wrong:** The rank circle (1–10) uses a near-invisible beige background (`var(--color-surface-alt, #F3EFE7)`) with secondary-text gray numerals at rest (`Top10Trending.tsx` lines 319–329). The position number — the primary ranking signal — is the least visually prominent element in each row.
   **Why it matters:** Rank is the central organizing idea of the "Top 10" section. When it reads lighter than the restaurant name and the rating digits, the hierarchy (rank → name → cuisine → score) is inverted.
   **What to do:** Darken the resting circle to at least a medium-contrast fill, or increase the numeral weight to `font-weight: 700`, so rank reads first before the eye reaches the name.
   **Why you'd want to do this:** Reinforces that this is a *ranked* list, not a flat editorial list with decorative numbers.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** The trending methodology (30-day window; weighted videos + reviews + photos; city-median normalization) lives entirely in source code and is invisible to users. No "How we rank" tooltip, no methodology page, no hover explanation on the section header.
**Why it matters:** Aggregator apps live and die by trust in the algorithm. Users who don't understand the ranking have no reason to trust it over a single-source app like Yelp.
**What to do:** Add a "?" icon next to "Top 10 Trending" that opens a popover (tooltip-like overlay) explaining the ranking in one sentence: "Ranked by recent activity — new videos, reviews, and photos in the last 30 days, normalized for your city." Link to a `/about/ranking` page for more depth.
**Why you'd want to do this:** Transparency is a differentiator. It also sets the expectation that a great place with no recent activity may rank lower — pre-answering the main user objection.
**The tradeoff:** Adds UI chrome and a new page to maintain. If the algorithm changes, the explanation must be updated in sync or it becomes a liability.
(effort: M)

## Alarming (optional)

The Google Maps API rejection error is rendering as visible browser-rendered text inside the flagship "Top 10 Trending" map panel in production (`explore-desktop.png`), not silently failing — users see a Google error notice where a map should be.
