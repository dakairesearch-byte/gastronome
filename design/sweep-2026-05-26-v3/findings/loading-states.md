# Loading States — Findings
Specialist: loading-states | Sweep: 2026-05-26-v3 (RE-SWEEP)

---

## Top 5 Findings

**1. Search shell layout shifts on hydration — padding and heading size don't match SearchContent** [REGRESSION]
`SearchShell` uses `px-6 lg:px-8 py-12` and an `h1` styled via inline `style={}` at `text-3xl`. `SearchContent` uses `px-4 sm:px-6 py-6 sm:py-10` and an `h1` at `text-2xl font-bold`. When JS hydrates and swaps shell for content, the heading jumps down in size and the left edge shifts inward — a visible CLS event on every cold load. The shell was added to fix the v2 blank-div Alarming, but the measurements weren't matched to the live page. Fix: align both padding and heading class to the real component values.
`src/app/search/page.tsx:515 (SearchContent) vs 870 (SearchShell)` | [P1] | Effort: XS

**2. Fixed 3-skeleton count still present on search refetch — jarring downward CLS on filter change** [STILL-OPEN]
When loading triggers on a refined query (user already sees 12+ results), `loading && <div><RestaurantCardSkeleton×3></div>` collapses the list to ~400px before re-expanding. The count was not fixed to reflect prior result length. This is a direct CLS cause on every filter interaction.
`src/app/search/page.tsx:589–594` | [P1] | Effort: S

**3. City grid sentinel shows 0 skeletons when only 1–2 restaurants remain to load** [NEW]
`CityRestaurantGrid` renders `Math.min(3, restaurants.length - visible)` skeleton placeholders in the sentinel. When 1 or 2 restaurants remain, only 1–2 `h-28` skeleton divs appear — but they are in a 3-column grid, leaving empty columns. On mobile (1-col) this is fine, but on desktop the ghost slots leave a lopsided shimmer row followed by an instant snap to real cards. More critically, when `restaurants.length - visible === 0` the sentinel `div` still renders (because `hasMore` is true until after that batch loads) but with zero children — it becomes an invisible 0px div that still triggers the IntersectionObserver, causing an immediate re-fire with 0 visual feedback.
`src/components/cities/CityRestaurantGrid.tsx:99–103` | [P2] | Effort: S

**4. `setLoading(true)` fires before the 300ms debounce resolves — skeleton flashes on rapid keystrokes** [STILL-OPEN]
`performSearch` calls `setLoading(true)` at line 253, inside the `setTimeout` callback at line 428. On inspection, `setLoading(true)` is correctly inside the `setTimeout` — the v2 finding was partially wrong about placement. However the effect dependency array includes `searchQuery`, so every keystroke re-registers a new 300ms timer; the old timer is cancelled but the state never resets. The real issue: if the user types quickly enough that multiple timers fire near-simultaneously, two `setLoading(true)` calls can arrive without a `setLoading(false)` in between, leaving a stuck skeleton until the slower promise resolves. Low probability but not zero.
`src/app/search/page.tsx:249–433` | [P2] | Effort: S

**5. Search shell renders no sidebar skeleton — desktop layout shifts from 1-column to 2-column on hydration** [NEW]
`SearchShell` renders only the header + a single centered search-bar shimmer. The real `SearchContent` has a `lg:flex-row gap-8` layout with a `hidden lg:block` sidebar on the left. On desktop, the shell paints a full-width column, then hydration snaps in a ~256px sidebar on the left and pushes the content column right — a large horizontal CLS. Even a static sidebar-width placeholder div would eliminate the shift.
`src/app/search/page.tsx:524–535 (SearchContent layout), 869–894 (SearchShell)` | `search-desktop.png` | [P1] | Effort: S

---

## Quick Wins

**QW1. [RESOLVED] Blank Suspense fallback replaced by real SearchShell** — the v2 Alarming (completely empty SSR shell) is fixed. Shell now renders heading + description + shimmer bar. Tagging resolved, but see Finding 1 and 5 for remaining CLS issues it introduced.

**QW2. [RESOLVED] `prefers-reduced-motion` guard on shimmer** — `globals.css:70–83` correctly stops animation and pins background color. QW2 from v2 is done.

**QW3. [STILL-OPEN] No `loading.tsx` for `/cities` route** — `src/app/cities/` still has no `loading.tsx`. Cold loads of the cities index page (server component with `revalidate = 60`) still paint a blank screen until HTML is ready. Two-line fix: create `src/app/cities/loading.tsx` returning a placeholder grid.

**QW4. [NEW] City skeleton height (h-28) doesn't match the real card height** — The city grid card `rounded-xl border bg-white p-4` renders to roughly 96–112px depending on content; the skeleton is `h-28` (112px). Close enough on desktop but the sentinel skeletons appear slightly taller than real cards on mobile, causing a downward snap when content loads. Change to `h-24` or derive from a shared constant.
`src/components/cities/CityRestaurantGrid.tsx:100`

**QW5. [NEW] Search skeleton uses card morphology (image block + metadata lines) but search renders horizontal list rows** — `RestaurantCardSkeleton` has a `h-32` image block on top, then text lines below (`LoadingSkeleton.tsx:3–14`). Actual search results in the screenshots are compact horizontal rows with a small thumbnail on the left, not tall card blocks. The skeleton resolves to a completely different shape. Add a `RestaurantListRowSkeleton` variant (44px tall, thumbnail + 2 text lines side by side) and use it in the search loading block. `search-desktop.png` shows the mismatch clearly.

---

## 2 Bigger Bets

**BB1. Layout-locked skeleton variants per surface** — `LoadingSkeleton.tsx` has one component that fits none of its three use sites precisely (search list, city grid, infinite-scroll sentinel). A proper skeleton system would have: `RestaurantListRowSkeleton` (search), `CityCardSkeleton` (city grid, matching the real card's exact height by sharing a CSS variable), and a `SentinelSkeletonRow` that matches the grid's `grid-cols-*` column count. Each variant should share its height/width from the real component via a CSS custom property or Tailwind config token so they never drift again.

**BB2. Optimistic search result count in skeleton phase** — while the debounced query runs, the UI shows a blank skeleton with no sense of scale. A simple optimistic display — "Searching for [query]…" with the previous result count greyed out — would dramatically reduce perceived wait time. Pair this with moving `setLoading(true)` inside the debounce timer (not at effect registration) so rapid typing doesn't strobe the skeleton: the shimmer only appears if the pause lasts longer than 300ms.

---

## Alarming

None. The v2 Alarming (blank SSR shell) is resolved. New issues are P1/P2 CLS regressions introduced by the shell fix itself — real, but not alarming.
