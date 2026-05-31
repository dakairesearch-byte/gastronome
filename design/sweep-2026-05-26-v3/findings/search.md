# Search — v3 Re-Sweep Findings

Lens: input affordance, autocomplete, scope, zero-results, result count,
ordering, infinite scroll — desktop and mobile.

---

## v2 Fixes — Verification

- [RESOLVED] **Leading magnifier icon** — present in SearchBar.tsx:43; visible in both screenshots.
- [RESOLVED] **inputMode / enterKeyHint** — set to "search" on the input (SearchBar.tsx:53–54).
- [RESOLVED] **Quality sort** — results ordered by google_rating then google_review_count (page.tsx:313–314), not alphabetical.
- [RESOLVED] **Result count** — "Showing N of M restaurants" line renders above results (page.tsx:683–692).
- [RESOLVED] **Infinite scroll** — IntersectionObserver sentinel fires 600px early, no Load-more button (page.tsx:496–511).
- [RESOLVED] **SSR shell** — SearchShell component renders heading + shimmer bar before hydration (page.tsx:867–893).
- [RESOLVED] **Zero-state** — EmptyState with named most-restrictive filter + "Browse all" escape (page.tsx:602–627).
- [RESOLVED] **Broken JBF Nominee filter** — UI now shows only "Any / Winner"; nominee option removed with explanatory comment (SearchFiltersSidebar.tsx:286–294).

---

## Top 5 Findings

### 1. Hard cap at 40 results — infinite scroll is theater [STILL-OPEN] [P1] effort: medium

The query is `.limit(40)` (page.tsx:315). The infinite scroll sentinel loads
12 rows at a time from the already-fetched 40, so "Showing 12 of 40+" is the
maximum. A city-only search (e.g. "New York") should return hundreds of
restaurants, but users see at most 40. The "+" suffix acknowledges the cap but
the dataset is still silently truncated. Fix: paginate via `.range()` or a
cursor, fetching the next batch when the sentinel fires.
Screenshot: search-desktop.png shows the shimmer skeleton below the 40-cap list.

### 2. SearchBar live-typing does not update URL — back-button breaks [NEW] [P1] effort: medium

SearchBar.tsx onChange fires onSearch (page.tsx:58) which calls setSearchQuery,
which updates the URL via the filter-sync effect (page.tsx:104–117). But the
SearchBar component holds its own `query` state (SearchBar.tsx:18) that is only
initialised from `initialValue` once. If a user types, then clicks a restaurant
link, then hits Back, the input re-mounts with the stale initialValue from the
original URL but the displayed results re-run from the URL query. The two fall
out of sync in practice because the URL does update, but initialValue is not
re-read on remount. Symptom: clearing the input on return does not re-query
because setQuery('') fires onSearch('') but the URL already has the query
string, causing a flicker. Fix: derive input value from URL rather than local
state, or key the SearchBar on the URL query.

### 3. JBF "Nominee" filter silently returns winners-only [STILL-OPEN] [P1] effort: large

The `jamesBeard` filter type still includes `'nominee'` as a valid value
(SearchFiltersSidebar.tsx:39). The UI hides the option, but filterState
deserialization can restore `jamesBeard: 'nominee'` from localStorage or a
shared URL. When that happens, the query treats it as `winner` (page.tsx:299–301
and 341–345) — returning winner restaurants while the filter chip implies nominee
scope. A user who saved a "Nominee" filtered session or received a shared link
will see winners labelled as nominees. Fix: strip `'nominee'` from the type, add
a migration in filterState that rewrites stored `nominee` → `any`.

### 4. Mobile search bar has no visible "Go" button when keyboard is up [NEW] [P2] effort: small

On mobile (search-mobile.png), the input takes nearly full width. The "Go"
submit button (SearchBar.tsx:75–83) sits inside the input's right padding at
`pr-20`. On small phones (≤375px) the button can be clipped by the keyboard
shelf or by the clear (X) button appearing simultaneously, leaving no visible
affordance to submit. The button also has no visible background contrast —
`style={{ backgroundColor: 'var(--color-primary)' }}` — but in the screenshot
the pill appears very small relative to the input. The `enterKeyHint="search"`
partially mitigates this, but a tap-target audit is warranted. Effort: check at
375px, add min-width or move button outside the input.

### 5. "From Google" suggestions appear without score — no trust signal [NEW] [P2] effort: small

Google Places autocomplete hits rendered at the bottom of results
(page.tsx:727–754) show only name and city — `place.rating` is always
`undefined` because the code intentionally skips Place Details calls
(page.tsx:167–172) to save API cost. The "From Google" section therefore shows
unlabelled blue-icon cards with no rating or price level, unlike every Gastronome
card which has rating chips. Users cannot tell if the suggested external
restaurant is a 4.8 institution or a 2.1 greasy spoon. Fix: at minimum show a
"Not yet rated on Gastronome" microcopy or use the structured_formatting snippet
(address) as a trust proxy. Screenshot: search-desktop.png, bottom of results.

---

## Quick Wins (≤5)

1. **Result count microcopy precision** — "Showing N of 40+" implies unlimited results but the database cap is 40. Change to "Showing N of 40 (use filters to narrow)" until proper pagination lands. (page.tsx:688–691)

2. **SearchBar initialValue stale on mode switch** — switching "Looking for" between All / Places / Dishes clears the placeholder but not the displayed query because SearchBar holds its own state. Passing `key={filters.mode}` to SearchBar would reset it. (page.tsx:541–549)

3. **Mobile filter sheet close button too small** — the X button at the top right of the mobile filter sheet is `p-1` with an 18px icon, giving a ~26px tap target. Bump to `p-2` for 44px minimum. (page.tsx:779–784)

4. **Cuisine multiselect case-sensitive mismatch** — the filter uses `.in('cuisine', filters.cuisines)` (page.tsx:274) which is exact-match. But cuisine values in the DB can have inconsistent casing. Add `.ilike` or normalize values on write. (SearchFiltersSidebar.tsx:163–179)

5. **Home mobile search uses SearchAutocomplete, not SearchBar** — home-mobile.png shows the hero search with a leading magnifier (SearchAutocomplete.tsx:238). SearchAutocomplete has no `inputMode` or `enterKeyHint` attributes (SearchAutocomplete.tsx:164–188), so mobile keyboards show the default "return" key, not "search". Add both attributes.

---

## Bigger Bets

**Full-text search with relevance ranking.** The current `ilike` approach (page.tsx:264–266) matches any substring in name, cuisine, or city — so "bar" matches "Barbuto", "Barua Korean Bar", and every city containing "bar". There is no relevance score, so a restaurant named exactly "Bar" ranks below one named "Craft Omakase Bar" only if it has a lower Google rating. A Postgres `tsvector`/`tsquery` index or a Supabase full-text search column would enable relevance-ranked results, "did you mean?" corrections, and stemming (searching "italian" finds "Italy"). This is the single biggest UX gap in search.

**Scope: search across dishes natively, not as a mode toggle.** Right now dishes and restaurants live in separate result sections divided by a visual rule. Users looking for "cacio e pepe" must know to toggle "Dishes" mode; in "All" mode dishes appear below restaurants, and on mobile the dish section is far off-screen. An interleaved, relevance-merged result list — restaurants that are known for the dish floated near the top — would be far more discoverable and matches how competitive apps handle this (Google Maps, Yelp). This would require a joined query or a unified search index.

---

## Alarming

None. No v2 findings regressed. Core search path (input → filter → result → scroll) is functionally stable.
