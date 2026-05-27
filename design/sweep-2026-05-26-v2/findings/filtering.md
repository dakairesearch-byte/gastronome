# Filtering — UX Findings
Sweep: 2026-05-26-v2 | Specialist: filtering

---

## Top 5 Findings

**F1. Filter sidebar is invisible until you know to look left**
The sidebar lives in a `hidden lg:block` div with no heading visible in the result column — a first-time user on desktop sees only a search bar and a wall of results with no affordance that ~10 filter dimensions exist. The "Filters" label only appears as a sticky sidebar label after scrolling, which is already off-screen on load.
`search/page.tsx:464` | `search-desktop.png`

**F2. "James Beard Nominee" filter silently degrades to winner-only**
The UI exposes a Nominee option, but the backend maps both `nominee` and `winner` to `james_beard_winner = true` because `james_beard_nominated` was dropped. Users who select Nominee get winners instead of the stated behavior — a silent lie with no disclosure.
`search/page.tsx:308-312`, `matchesFilters:744-748`

**F3. Active filter summary banner conflates count with identity**
The banner reads "3 filters active · filters persist across visits until you reset" but names none of the active filters. A user returning after days cannot tell what is active without opening the sidebar. The persistence disclosure is text-buried in gray and not scannable.
`search/page.tsx:505-524` | `search-desktop.png`

**F4. Zero-result combos offer no filter-relaxation guidance**
When filters combine to produce no results, the empty state says "Try relaxing a filter or adjusting your search terms" but does not indicate which filter is the likely culprit, nor does it offer one-tap relief (e.g. "Remove Google ≥4.1"). The CTA only resets everything.
`search/page.tsx:536-559`

**F5. Mobile filter sheet has no result count feedback**
The bottom "Apply filters" button closes the sheet but shows no result count (e.g. "Show 12 restaurants"). Users close the sheet blind, then must scan the results list to know if their selections found anything — a round-trip that is especially painful when the answer is zero.
`search/page.tsx:699-709` | `search-mobile.png`

---

## 5 Quick Wins

**QW1. FilterChips chip X button has no accessible label**
The X inside each selected-cuisine pill has no `aria-label`. Screen readers announce "button" with no context.
`FilterChips.tsx:88-92`

**QW2. FilterChips dropdown has no keyboard close (Escape)**
Clicking outside closes it via `mousedown`, but pressing Escape does nothing — keyboard users are trapped.
`FilterChips.tsx:23-31`

**QW3. Filter count badge on mobile "Filters" button disappears when sidebar resets**
`handleResetAll` calls `router.replace(pathname)` which drops the badge, but only after a re-render cycle — the badge can flash the old count briefly.
`search/page.tsx:440-445`

**QW4. Explore page category filters (Categories section) have no multi-select state**
The explore page shows category chips (Connoisseur Picks, Hidden Gems, Michelin Stars, etc.) with no visual selected/active state in the screenshot — it is unclear if they are tappable filters or navigation links.
`explore-desktop.png` | `src/components/explore/CategoryFilters.tsx`

**QW5. "Reset all" also clears the search query**
`handleResetAll` calls `setSearchQuery('')`, so resetting filters wipes the user's typed query. A reset should only clear filter state, not the search intent.
`search/page.tsx:441`

---

## 2 Bigger Bets

**BB1. Replace the count banner with named applied-filter chips**
Instead of "3 filters active", render removable chips like `Miami ×`, `Google ≥4.1 ×`, `Yelp ≥3.0 ×` inline above results. Each chip removes exactly one filter; a "Clear all" sits at the end. This eliminates the sidebar round-trip for minor adjustments, surfaces filter state without language, and sidesteps the persistence-disclosure clutter.
`search/page.tsx:504-524` — new component needed

**BB2. Smart zero-result handling: identify the culprit filter and offer surgical relief**
When `!hasAnyResults`, diff the active filter set one at a time (client-side, no extra queries) to find which single filter removal would re-open results. Surface it as "Remove Google ≥4.1 to see 8 more restaurants" alongside the existing Reset all. This turns a dead end into a guided narrowing experience and prevents users from abandoning the filter system entirely.
`search/page.tsx:536-559` | requires result-count probing logic

---

## Alarming

**A1. Persist-across-visits behavior is opt-out with no session scoping**
`writeStoredFilters` writes to `localStorage` on every filter change and restores silently on next visit — including weeks later. The gray inline disclosure ("filters persist across visits until you reset") is the only signal. A user who filtered to "Miami, Yelp ≥4.5" last month will land on a zero-result page next time they open Search from a different context, with no explanation why. This is a silent data-staleness trap with real UX cost.
`search/page.tsx:82-98`, `writeStoredFilters` call at line 117
