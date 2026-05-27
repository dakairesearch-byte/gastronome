# loading-states

**Lens:** How loading states communicate progress and prevent layout shift (unexpected page movement as content loads) on the search page.
**Reviewed:** screenshot (search-desktop.png) + LoadingSkeleton.tsx + search/page.tsx.

## Top 3 findings

1. [P1] **What's wrong:** Only 3 skeleton cards are shown during loading (page.tsx:529), but the filter sidebar loads instantly with full content — creating a jarring half-skeleton, half-real layout where the sidebar is fully interactive but the result area is a stub.
   **Why it matters:** Users see an inconsistent page: a complete, usable filter panel next to placeholder content. This breaks the mental model that the page is loading uniformly, and may prompt users to interact with filters before the first result set even resolves.
   **What to do:** Match skeleton count to a realistic result count (8–12) or use a single taller skeleton block that fills the expected results viewport height so the page "feels full" during load.
   **Why you'd want to do this:** Reduces perceived wait time — research consistently shows filling the viewport with skeletons makes loads feel faster even when the actual duration is identical.
   (effort: S)

2. [P1] **What's wrong:** The `Suspense` fallback at the page level (page.tsx:755) is `<div className="min-h-screen" />` — a completely blank white screen. This is the first thing users see on every hard navigation to `/search` before client hydration.
   **Why it matters:** A blank full-screen div gives zero signal that anything is happening. Users with slower connections (mobile, throttled networks) see a white void for a measurable period with no loading indicator of any kind — no spinner, no skeleton, no progress bar.
   **What to do:** Replace the Suspense fallback with a shell that matches the real page structure: header, empty sidebar outline, and skeleton cards in the main column.
   **Why you'd want to do this:** Time-to-meaningful-paint (the point at which content appears that lets users orient themselves) improves immediately at zero runtime cost — it's pure HTML that streams before any JS executes.
   (effort: S)

3. [P2] **What's wrong:** The skeleton card (LoadingSkeleton.tsx:1–15) has a fixed `h-32` image area and three placeholder rows, but real `RestaurantCard` components include rating badges, cuisine tags, accolade chips (Michelin star, Eater 38, James Beard), and city — all of different heights. The skeleton dimensions do not match the real card, causing layout shift (CLS — cumulative layout shift, the page "jumping" as real content pushes elements down) when results replace skeletons.
   **Why it matters:** Layout shift after a search query is one of the most disorienting loading experiences. Users may click a card that has shifted position, landing on the wrong restaurant.
   **What to do:** Audit a real `RestaurantCard` at its min and max heights (no accolades vs. full accolade set) and make the skeleton match the common case. A single consistent height prevents CLS without needing to know the exact data.
   **Why you'd want to do this:** Google's Core Web Vitals include CLS as a ranking signal; improving it can benefit SEO in addition to UX.
   (effort: S)

## Quick wins (<=3, no severity tag)

1. **What's wrong:** There is no loading microcopy (text that explains what's happening) during the skeleton phase — the search bar sits above three grey rectangles with nothing to say "Searching…" or "Loading results."
   **Why it matters:** Users with slower connections see skeletons for several seconds with no confirmation their action (applying filters) was registered.
   **What to do:** Add a one-liner below the active filter summary bar during load, e.g., "Finding restaurants…" — 2–3 words, muted style, disappears with the skeletons.
   **Why you'd want to do this:** Micro-feedback reduces abandonment on slow loads; it costs one conditional text node.
   (effort: S)

2. **What's wrong:** Filter changes trigger a 300 ms debounce then a full re-fetch (page.tsx:429), but the loading state resets the entire skeleton every time — including when the user is still adjusting sliders (e.g., dragging a rating threshold).
   **Why it matters:** Rapid filter interactions cause the result area to flicker in and out of skeleton state repeatedly, which is visually noisy and reads as an unstable UI.
   **What to do:** Keep the previous results visible and dimmed (opacity: 0.4, pointer-events: none) during re-fetch instead of replacing them with skeletons. Swap in fresh results only on settle.
   **Why you'd want to do this:** "Stale-while-revalidate" (showing old data while new data loads) is a standard pattern that preserves spatial context for the user.
   (effort: M)

3. **What's wrong:** The sidebar filter options (cities, cuisines) are fetched in a separate `loadFacets` effect (page.tsx:226) with no loading state of their own — dropdowns appear empty then populate, which is a silent layout shift inside the sidebar.
   **Why it matters:** A user who opens the city dropdown immediately may see an empty list, conclude no cities are available, and abandon the filter.
   **What to do:** Add a small inline spinner or "Loading…" placeholder inside each dropdown until `availableCities` and `availableCuisines` resolve.
   **Why you'd want to do this:** Prevents false-empty states from being mistaken for real empty states.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** The page uses a single boolean `loading` flag (page.tsx:75) that gates the entire result area. There is no concept of partial or progressive loading — results, dishes, and Google Places suggestions all hide behind the same flag even though they resolve from different data sources at different times.
**Why it matters:** Restaurants from Supabase may resolve in 200 ms while Google Places autocomplete takes 800 ms. Holding the full result render until the slowest source finishes makes the page feel slower than it is.
**What to do:** Split into `loadingRestaurants`, `loadingDishes`, and `loadingGooglePlaces` flags. Render each section as it resolves with its own skeleton, using section headers ("Restaurants", "Dishes", "From Google") as stable anchors so the page fills progressively without layout shift.
**Why you'd want to do this:** Progressive disclosure of results mirrors how users actually scan — they want to act on the first match, not wait for all sources.
**The tradeoff:** Three loading states adds state complexity and requires the result list section separators (currently conditional on data presence) to be visible even before data arrives — requires some design coordination with the empty-states and section-divider logic.
(effort: L)
