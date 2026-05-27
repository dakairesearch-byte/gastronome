# filtering

**Lens:** Evaluate filter discoverability, multi-select clarity, applied-filter chips (visual indicators of active selections), reset affordances, zero-result combos, and filter persistence across navigation.
**Reviewed:** screenshot (`search-desktop.png`, 3 active filters: Miami, Google ≥4.1, Yelp ≥3.0) + `src/app/search/page.tsx`, `src/components/FilterChips.tsx`, `src/components/search/SearchFiltersSidebar.tsx`, `src/components/search/filterState.ts`.

## Top 3 findings

1. [P0] **What's wrong:** The "James Beard Nominee" filter silently behaves identically to "James Beard Winner." The `james_beard_nominated` column was dropped; `page.tsx:344–347` maps both `nominee` and `winner` to `eq('james_beard_winner', true)`. A user who selects "Nominee" sees the same (narrower) results as "Winner" with no warning.
   **Why it matters:** Users who intentionally want semifinalists or nominees — a materially different, larger set — get silently incorrect results. They cannot tell the filter is broken.
   **What to do:** Either (a) hide the "Nominee" option and show only "Winner" until `restaurant_jbf_history` is wired, or (b) show a tooltip/caption: "Nominee data coming soon — showing winners only." Do not surface a filter that cannot be honored.
   **Why you'd want to do this:** Broken filters erode trust faster than missing features; users blame the data, not the UI.
   (effort: S)

2. [P1] **What's wrong:** Filters persist silently via localStorage (`filterState.ts:146–157`), and the only disclosure is a small grey caption in the active-filter banner: "filters persist across visits until you reset" (`page.tsx:512`). This banner is only visible when at least one filter is already active — a first-time visitor who lands on /search with stale filters from a prior session sees no banner and no explanation for why results look odd.
   **Why it matters:** Unexplained filter persistence causes confusion ("why am I only seeing Miami restaurants?") and erodes confidence in results quality.
   **What to do:** On page load, if filters were restored from localStorage rather than the URL, briefly surface a dismissible notice: "Showing your last search filters — [Reset]." Place it above results, not only in the filter sidebar.
   **Why you'd want to do this:** Transparent persistence feels like a feature; invisible persistence feels like a bug.
   (effort: S)

3. [P1] **What's wrong:** There is no zero-result warning before the search fires. Combining, for example, Michelin 3-star + Eater 38 + Yelp ≥4.5 across a single city almost certainly returns nothing, yet the UI shows loading skeletons (`page.tsx:527–533`) and then drops into the generic "No results found" empty state with only "Try relaxing a filter" copy. There is no indication of which filter is causing the zero-result condition.
   **Why it matters:** Users who hit a dead-end with 5+ active filters don't know which one to relax; many will abandon rather than experiment.
   **What to do:** After a zero-result search with 2+ active filters, highlight the most restrictive filter(s) with a callout in the sidebar (e.g., a yellow border on the Michelin section) and add actionable copy: "No restaurants match all filters — try removing [Michelin Stars]."
   **Why you'd want to do this:** Guided recovery from dead-ends is a proven retention driver in faceted search (e.g., Airbnb's filter relaxation prompts).
   (effort: M)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** `FilterChips.tsx` (the cuisine chip component used on Explore) has a "Clear" button (`FilterChips.tsx:99–106`) with `text-gray-400` styling — very low contrast, near-invisible against white. Desktop users may miss it entirely.
   **Why it matters:** Users who want to clear all cuisine chips must find an affordance that is visually subordinate to the chips themselves.
   **What to do:** Style "Clear" as a link with emerald text to match the "Reset all" button in the sidebar, or replace it with a "Clear all" chip that appears inline with the active cuisine chips.
   **Why you'd want to do this:** Consistent clear affordances reduce support friction and align with the sidebar's "Reset all" pattern.
   (effort: S)

2. **What's wrong:** The mobile filter sheet ("Filters" drawer) has an "Apply filters" button (`page.tsx:701–706`) that closes the sheet, but filters already apply live (no apply step needed — `onChange` fires immediately). The button label implies a two-step commit workflow that does not exist, potentially confusing users who tap away without pressing "Apply."
   **Why it matters:** Users may not trust that their filter selections are active until they see results, especially if the sheet closes without visual feedback.
   **What to do:** Rename the button to "See results (N)" where N is a live result count estimate, or "Done" if count polling is too costly — anything that doesn't imply uncommitted state.
   **Why you'd want to do this:** Live-apply patterns are faster but only if users know filters are already taking effect.
   (effort: S)

3. **What's wrong:** The active-filter summary banner (`page.tsx:505–524`) counts total active filters (e.g., "3 filters active") but does not enumerate them by name. On desktop, a user who scrolled the sidebar can't quickly see at a glance which 3 filters are on without scrolling back.
   **Why it matters:** Filter chips (visual pills showing which filters are active, common in search UIs) are a standard navigation aid for faceted search; the current banner provides a count but not the names.
   **What to do:** Render named pills (e.g., "Miami ×", "Google ≥4.1 ×", "Yelp ≥3.0 ×") inline in the banner row, each individually dismissible without opening the sidebar.
   **Why you'd want to do this:** Individual chip dismissal reduces round-trips through the sidebar and matches the pattern already implemented in `FilterChips.tsx`.
   (effort: M)

## One bigger bet (optional)

**What's wrong:** The filter panel has 11 independent dimensions (mode, city, cuisine, Google rating, Google reviews, Yelp rating, Yelp reviews, Michelin stars, Bib Gourmand, James Beard, Eater 38) with no visual grouping of "will these combine to produce results?" The sidebar (`SearchFiltersSidebar.tsx:88–319`) stacks all sections vertically with equal weight; high-cardinality filters (rating sliders) sit next to rare-data filters (Michelin, Eater 38) with no hierarchy.
**Why it matters:** Power users building nuanced queries have no map of filter relationships and no feedback until results (or non-results) appear.
**What to do:** Introduce a "smart filter" layer: after 2+ filters are active, query estimated result counts per remaining filter option and display them inline (e.g., "Italian (12)", "French (3)") — graying out zero-result options before they are selected. This is standard in e-commerce faceted search (Shopify, ASOS, Booking.com).
**Why you'd want to do this:** Estimated counts make filter exploration feel safe and purposeful; zero-result dead-ends drop sharply.
**The tradeoff:** Requires N+1 count queries per filter panel render — adds latency and Supabase read cost. Can be throttled/debounced (fire only when the sidebar is open and filters change), and should be feature-flagged behind a DB cost analysis.
(effort: L)

## Alarming (optional, 1 line)

The "James Beard Nominee" filter is silently broken in production — it returns identical results to "Winner" with no disclosure (`page.tsx:344–347`); remove or label it before the next marketing push featuring awards filtering.
