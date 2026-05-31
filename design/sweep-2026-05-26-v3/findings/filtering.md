# Filtering — v3 Re-sweep Findings
_Lens: filter discoverability, multi-select clarity, applied chips, reset, zero-result combos, persistence, mobile filter sheet (live count)._

---

## Status recap on v2 items

- **[RESOLVED]** Escape-closes FilterChips dropdown — confirmed in `FilterChips.tsx:32-43`.
- **[RESOLVED]** X-button aria-labels on cuisine pills — `aria-label="Remove ${cuisine} filter"` at line 104.
- **[RESOLVED]** "Reset all" no longer wipes search query — `handleResetAll` preserves `q=` at `page.tsx:449-452`.
- **[RESOLVED]** Mobile Apply button shows live result count — `page.tsx:804-809` reads `totalRestaurants + dishes.length`.
- **[RESOLVED]** Broken JBF "Nominee" filter removed from UI — sidebar now shows only `Any / Winner`.

---

## Top 5 Findings

### 1. JBF "nominee" still accepted in URL and silently treated as "winner" [STILL-OPEN]
`filterState.ts:59` parses `jb=nominee` as valid and passes it through; the query at `page.tsx:299-303` then applies `james_beard_winner = true` for both `winner` and `nominee`. A shared link or bookmark with `?jb=nominee` returns winners while labelling itself "nominee" — a silent lie. The v2 fix only removed the UI button; the data path was never corrected.
**[P1] Effort: S** — Drop `nominee` from the parse allowlist in `filtersFromURL`; map it to `'any'`.

### 2. MultiSelect dropdown has no Escape-to-close [NEW]
`FilterChips.tsx` (the city-page component) has Escape handling. The search sidebar's `MultiSelect` component (`SearchFiltersSidebar.tsx:502-507`) only closes on click-outside — there is no `keydown` listener. A keyboard user who opens the City or Cuisine dropdown and presses Escape is trapped until they click outside, which may be impossible without a mouse.
**[P1] Effort: S** — Mirror `FilterChips.tsx:32-43`'s keydown handler into `MultiSelect`'s `useEffect`.

### 3. City page filter chips have no result-count preview [NEW]
On `cities-newyork-mobile.png` the accolade chips (Michelin, Bib Gourmand, James Beard, Eater 38) and cuisine row are plain links with no indication of how many restaurants each will produce. NYC has 172 Michelin and 90 James Beard entries (visible in the header badges) but a user looking at "Eater 38" or "Burger" gets no count until after navigation. The search sidebar's MultiSelect shows selected state but no counts either. Compare to the header which does surface the right totals.
**[P1] Effort: M** — Compute per-chip counts server-side (already have `all[]`) and render inline on city page; add option-count badges to MultiSelect.

### 4. Cuisine filter in MultiSelect uses exact-string `.in()` match; case mismatch produces silent zero results [NEW]
`page.tsx:275` runs `rq.in('cuisine', filters.cuisines)`. Cuisine values in the database can have inconsistent casing (e.g. "Japanese" vs "japanese"). The `availableCuisines` list is pulled as-is and de-duped case-sensitively (`page.tsx:234-237`), so if two rows disagree on case both variants appear in the dropdown. Selecting one silently excludes restaurants with the other casing — a zero-result combo with no explanation. The city page uses `.ilike()` and avoids this; search does not.
**[P1] Effort: S** — Normalise cuisine casing at select time (`LOWER()` in the facet query) or use `.ilike()` per value in the filter query.

### 5. "N filters active · filters persist across visits until you reset" banner is shown only when filters are active, but there is no persistent hint that filters ARE stored when the page loads with them silently applied [STILL-OPEN]
When localStorage has filters and the user navigates to /search cold, the filters restore and results narrow — but the banner only appears because `activeFilterCount > 0`, not because it explains the restoration. The copy "filters persist across visits until you reset" is informative, but it appears in the same element as the count, so a first-time user whose filters were set last week may not understand why results look narrow. Screenshot `search-mobile.png` shows 12 restaurants with no zero-state explanation of persistence.
**[P2] Effort: S** — Add a one-time "Restored your last filters" toast or a subtle inline note on first hydration with stored filters (the `readStoredFilters` path at `page.tsx:91`).

---

## Quick Wins (≤5)

1. **MultiSelect trigger has no `aria-expanded`** (`SearchFiltersSidebar.tsx:518`) — add `aria-expanded={open}` and `aria-haspopup="listbox"` to the button. One-liner. [NEW]

2. **City filter chip active state is conveyed only by color** (`cities/[slug]/page.tsx:239-246`) — active chips use `bg-emerald-600 text-white` with no `aria-pressed` or `aria-current`. Screen readers can't tell which filter is active. [NEW]

3. **"Clear all filters" link on city page is visually small and far from the chips** — it appears below the result count (`page.tsx:303-310`) rather than near the chips themselves, breaking spatial proximity. Move it into the chip bar. [NEW]

4. **Review-count slider `accent-emerald-600` class on Google slider is overridden by inline `background` style** (`SearchFiltersSidebar.tsx:429`) — the `accent-*` Tailwind class controls the thumb color on some browsers but the custom gradient overrides it. The result is an inconsistent thumb color across browsers. Remove the redundant `accent-*` class. [NEW]

5. **FilterChips "Clear" button has no `aria-label` on the parent button** (`FilterChips.tsx:111-124`) — the inline `aria-label="Clear all cuisine filters"` is correct but the button also triggers `onClearAll` which resets all cuisines; the tooltip and focus label are fine. Already fixed in v2 (contrast lifted to `text-gray-600`). [RESOLVED] — confirm only, no action needed.

---

## Bigger Bets

### A. Accolade + cuisine filter combination across both surfaces (search + city pages) should share a single filter layer
Currently the search page has a full sidebar filter system (URL + localStorage, 11 dimensions) while city pages use a thin URL-only chip layer (2 dimensions: one accolade + one cuisine at a time — truly single-select despite looking like a multi-select row). A user who discovers "James Beard Winners" on a city page and wants to also filter by cuisine faces a single-select constraint that's invisible: selecting a cuisine deselects the accolade silently, and vice versa is prevented only by URL construction at `page.tsx:231-234`. Unified filter state (allowing multiple accolades AND multiple cuisines simultaneously) across both surfaces would make the mental model consistent and unlock genuinely useful combinations.

### B. Zero-result state for filter combos should identify the offending combination, not just the "most restrictive" single filter
`page.tsx:463-475` surfaces the most restrictive filter heuristically (review count > rating > Michelin > JBF > Eater > cuisine > city). But common zero-result combos involve two reasonable filters that are individually fine — e.g. "Michelin 2-star" + "Burger cuisine" — where neither alone would zero out. The empty-state copy ("the Michelin stars filter is the most restrictive") misdirects the user toward removing Michelin when removing "Burger" would also work. Showing both conflicting filters — and offering a one-tap remove for each — would save more sessions than the current single-label heuristic.

---

## Alarming

None. No critical regressions detected. The v2 mobile sheet fix (live count) is correctly implemented. The JBF nominee silent-winner substitution (finding #1) is the most deceptive issue but it requires a deliberate URL craft to trigger from current UI.
