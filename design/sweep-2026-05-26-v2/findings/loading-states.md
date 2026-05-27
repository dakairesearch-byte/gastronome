# Loading States — Findings
Specialist: loading-states | Sweep: 2026-05-26-v2

---

## Top 5 Findings

**1. Skeleton count is fixed at 3, regardless of prior result count**
The search skeleton always renders exactly 3 `RestaurantCardSkeleton` rows (`page.tsx:528–533`). When the user had 20+ results on the previous query and refines a filter, the skeleton momentarily collapses the list to 3 short rows before expanding — a jarring downward-then-upward layout shift. The skeleton count should match the previous result count (clamped to a max) or at minimum reflect a plausible expectation.
`src/app/search/page.tsx:528–533`, `src/components/LoadingSkeleton.tsx:1–15`

**2. Skeleton morphology doesn't match the actual card it stands in for**
`RestaurantCardSkeleton` renders a 128px image placeholder, a title bar, and two small metadata lines (`LoadingSkeleton.tsx:3–14`). The real `RestaurantCard` in search results is a horizontal list-item layout (not a card-with-thumbnail). The skeleton pops into a different shape on resolve — a direct cause of Cumulative Layout Shift. Search desktop screenshot shows 3 card-shaped skeletons where list rows will appear.
`src/components/LoadingSkeleton.tsx:3–14`, `search-desktop.png`

**3. No loading state on Explore's above-the-fold map area**
Explore renders server-side (`revalidate = 60`), but the Google Maps iframe in the right-side pane clearly fails and shows an API error banner mid-load (`explore-desktop.png`). There is no skeleton or placeholder for the map region — the layout collapses to an error text block with no visual continuity. Even a gray `aspect-video` placeholder would prevent the raw error from being the first thing users see in that column.
`src/app/explore/page.tsx`, `explore-desktop.png`

**4. Cities page has no loading skeleton at all — sequential DB round-trips block paint**
`CitiesPage` is a server component (`revalidate = 60`) that runs a paginated loop of sequential Supabase queries before returning any HTML (`cities/page.tsx:64–73`). On a cold cache or revalidation, the user sees a blank screen until all queries complete. No `loading.tsx` sibling exists, and there is no `Suspense` boundary wrapping the city cards. The cities screenshot shows a fully-rendered page only because the cache was warm.
`src/app/cities/page.tsx:64–73`, `cities-desktop.png`

**5. `setLoading(true)` fires on every filter change — no debounce between loading flash and debounced query**
Search fires `setLoading(true)` immediately inside `performSearch`, which is itself wrapped in a 300ms `setTimeout` (`page.tsx:429`). However, the outer `useEffect` runs synchronously on every `filters` / `searchQuery` change, meaning `setLoading` is set before the 300ms debounce resolves. Rapid successive keystrokes or slider moves cause the skeleton to flash on/off repeatedly. `setLoading(true)` should move inside the `setTimeout` callback so the skeleton only appears if the debounce actually fires.
`src/app/search/page.tsx:258–434`

---

## 5 Quick Wins

**QW1. Add a result-count line beneath the active-filter bar while loading**
Show "Searching Miami · Google ≥4.1 · Yelp ≥3.0…" as greyed microcopy so users know what's being fetched. Cost: one conditional text node. Cite: `page.tsx:504–524`.

**QW2. Skeleton shimmer uses a custom `animate-shimmer` class — verify it degrades on `prefers-reduced-motion`**
`LoadingSkeleton.tsx` uses `animate-shimmer` throughout with no reduced-motion guard. Add `motion-safe:animate-shimmer` or a `@media (prefers-reduced-motion)` override in `globals.css` to stop animation for motion-sensitive users.
`src/components/LoadingSkeleton.tsx`, `src/app/globals.css`

**QW3. Explore's `CategoryFilters` Suspense fallback is `aria-hidden`**
The fallback div is marked `aria-hidden` (`explore/page.tsx:483`), which is correct for a visual-only shimmer — but the fallback has no visible loading affordance at all (it's just a blank 56px bar). Adding a subtle pulse to the fallback would signal to sighted users that the filter rail is loading, not broken.
`src/app/explore/page.tsx:474–496`

**QW4. Remove the `Suspense` fallback's blank `min-h-screen` on the Search page**
`SearchPage` wraps `SearchContent` in `<Suspense fallback={<div className="min-h-screen" />}>` (`page.tsx:755`). This blank full-height div means SSR returns a completely empty shell — no header, no search bar outline. Replace with a real skeleton that at least renders the SearchBar placeholder and 3 card skeletons so SSR has meaningful above-the-fold content.
`src/app/search/page.tsx:753–758`

**QW5. Missing `loading.tsx` for the `/cities` route**
Next.js App Router will automatically stream a `loading.tsx` fallback during server-component data fetching. Adding a `loading.tsx` at `src/app/cities/loading.tsx` with a city-card skeleton would give users instant above-the-fold feedback on cold loads without any query restructuring.
`src/app/cities/` (file absent)

---

## 2 Bigger Bets

**BB1. Split Search into a streaming architecture — resolve filter UI instantly, stream results**
Currently the entire search result column blocks on a single `useEffect` + Supabase round-trip. Restructuring `SearchContent` so the sidebar and search bar hydrate immediately (already client-rendered), then streaming restaurant rows via an async Server Action or Route Handler, would allow partial results to appear as data arrives. The first result would paint before the full 40-row query completes — especially important for users on slower connections where the 300ms debounce + query round-trip adds up to a multi-second blank state.
`src/app/search/page.tsx`

**BB2. Introduce a skeleton design system with layout-matched variants**
`LoadingSkeleton.tsx` contains only `RestaurantCardSkeleton` and it doesn't match the actual rendered layout in any of the three screens examined. A design-system-level effort would produce: (a) `RestaurantListRowSkeleton` matching the horizontal search result layout; (b) `CityCardSkeleton` for the cities list; (c) `ExploreCollectionCardSkeleton` for the Explore categories grid. Each variant should derive its dimensions from the real component's CSS so that skeleton → content transitions produce zero measurable CLS.
`src/components/LoadingSkeleton.tsx`

---

## Alarming

**The SSR fallback for `/search` is a featureless blank div** (`page.tsx:755`). On any slow connection or cold serverless function start, users navigating directly to `/search` (e.g. from a shared link with filters in the URL) will see a completely empty page — no nav, no heading, no search bar — until the client JS hydrates. This is a crawlability and first-impression failure: bots see no content, and real users with slow 3G see nothing meaningful for several seconds. Minimum fix: move the `<SearchBar>` and heading outside the Suspense boundary so they render from the server shell.
`src/app/search/page.tsx:451–459, 753–758`
