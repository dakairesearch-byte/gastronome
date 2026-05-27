# Search — UX Findings
Sweep: 2026-05-26-v2 | Specialist: search

---

## Top 5 Findings

**F1 — No autocomplete / typeahead in the search input**
The `SearchBar` component is a plain controlled `<input>` with no dropdown suggestions. The Google Places autocomplete service is wired in `page.tsx` and resolves results, but only after a full 300 ms debounce fires and results appear in the main list — users get no inline suggestions while typing.
Source: `SearchBar.tsx` (entire file — no suggestion list rendered); `search/page.tsx:429` (debounce timer only, no dropdown state).
Impact: High — users must commit a full query and wait; there is no guided completion for dish names, cuisine types, or neighborhood names that are native to the data model.
Fix: Expose a `suggestions` prop from `page.tsx` and render a positioned `<ul>` below the input with the top 3–5 matches (restaurants + dishes + cuisines) as the user types.

**F2 — Dish search is mode-gated, not a first-class scope in the input**
Dish results only appear when `filters.mode` is `'dishes'` or `'all'` (`page.tsx:263-264`). The input placeholder contextually changes (`page.tsx:480-485`), but there is no visible scope selector — tabs, a pill toggle, or a leading icon — attached to the search bar itself. A user who wants "best ramen in Miami" must first discover the hidden mode filter in the sidebar.
Source: `search/page.tsx:263-264`, `SearchBar.tsx` (no scope UI); `search-desktop.png` (sidebar is visually subordinate to the input).
Impact: High — dish-level search is a key differentiator of this aggregator and it is invisible at the point of input.
Fix: Add a compact scope toggle (Restaurant / Dish / All) directly inside or immediately below the search bar.

**F3 — Result list is sorted alphabetically, not by relevance or quality**
`page.tsx:317` orders restaurant results by `name ASC`. A search for "pizza" returns "A16" before "Roberta's" regardless of Google rating, Michelin stars, or trending score. Dish results are sorted by `mention_count DESC` (`page.tsx:393`), creating an inconsistency in sort logic across the two result types.
Source: `search/page.tsx:317` (`.order('name', { ascending: true })`); `search/page.tsx:393` (dish order).
Impact: High — alphabetical ordering surfaces no signal quality; defeats the platform's core value of aggregated ranking.
Fix: Order by a composite score (google_rating × log(review_count)) as a default, with a sort control for users who want alphabetical.

**F4 — Hard limit of 40 results with no pagination or "load more"**
Both the restaurant query (`page.tsx:317`) and the dish query (`page.tsx:394`) cap at `.limit(40)`. The bib-gourmand union appends up to 40 more rows (`page.tsx:349`) but there is no UI indication that results are truncated, and no way to retrieve further matches.
Source: `search/page.tsx:317`, `search/page.tsx:394`, `search/page.tsx:349`.
Impact: Medium-High — a user filtering "Italian in New York" with no query may have 80+ valid results; they will see an arbitrary 40 ordered A–Z and never know they are missing options.
Fix: Add a result count ("Showing 40 of 123") and an infinite-scroll or "Load more" trigger.

**F5 — Persisted filters create invisible search scope on return visits**
Filters are written to `localStorage` and restored on every visit (`page.tsx:82-98`). The active-filter banner ("3 filters active · filters persist across visits") only appears when `activeFilterCount > 0`, which is correct — but on mobile the banner is easy to miss above the skeleton cards, and a user who filtered to Miami weeks ago will silently see only Miami results with no city context in the page title or URL on first glance.
Source: `search/page.tsx:504-524` (banner); `search-mobile.png` (banner is narrow, low contrast above loading skeletons).
Impact: Medium — filter persistence is a power feature but it creates a disorienting blank-slate experience for returning users who don't remember their last session.
Fix: Surface city/cuisine scope in the page heading ("Search · Miami") and make the banner higher-contrast on mobile.

---

## 5 Quick Wins

**QW1 — Missing search icon leading the input**
`SearchBar.tsx:48` sets `pl-4` (no icon padding) — the magnifying glass icon is only in the trailing position as a submit button. A leading icon reinforces affordance, especially on mobile.
Source: `SearchBar.tsx:48`; `search-mobile.png` (bare input leading edge).

**QW2 — Placeholder text mismatches between nav search and /search page**
`SearchBar.tsx:14` default placeholder is "Search restaurants, dishes, cuisines..." but on `/search` the dishes mode overrides to "Search dishes — try 'ramen'…". The home-page nav bar (if it reuses `SearchBar`) keeps the generic copy. Align to a single, intentional voice.
Source: `SearchBar.tsx:14`; `search/page.tsx:480-484`.

**QW3 — "From Google" section has no explanation for users**
Google Places results are shown with a `MapPin` icon and a blue rating pill but no explanatory label about what "From Google" means or how to add them to Gastronome. The CTA destination is `/review/new` — that is useful but invisible.
Source: `search/page.tsx:623-624` (section label); `search/page.tsx:630` (href to `/review/new`).

**QW4 — No `inputmode="search"` or `enterKeyHint="search"` on mobile input**
`SearchBar.tsx:40-48` — the `<input type="text">` lacks `inputmode="search"` and `enterKeyHint="search"`, so iOS/Android shows a generic keyboard and a "Return" key rather than a search-optimized keyboard with a "Search" action key.
Source: `SearchBar.tsx:40`.

**QW5 — Empty state CTA is "Discover" (links to /explore) even with an active query**
`page.tsx:553-554`: when there are no results and `activeFilterCount === 0` but a query is present, the CTA reads "Discover" and navigates away. Users with a typed query need suggestions to refine, not a redirect.
Source: `search/page.tsx:540-555`.

---

## 2 Bigger Bets

**BB1 — Unified typeahead with scoped result groups (restaurant / dish / cuisine / neighborhood)**
Today the search model forces a binary: full-page load of restaurant results, or switch to dish mode. A single typeahead dropdown grouping "Restaurants", "Dishes", "Cuisines", and "Neighborhoods" would let users navigate directly to the right entity without touching filters. This requires a lightweight API layer (or client-side trie over cuisine/city lists, plus debounced Supabase prefix queries) and a keyboard-navigable dropdown component. This is the single highest-leverage change for the search affordance.

**BB2 — Recent searches with recency signal in ranking**
The home screen shows a "Recent Searches" section (`home-desktop.png`) that appears empty ("Your recent searches will appear here"). No recency data is written or read by `SearchBar` or `page.tsx` — there is no `localStorage` or server-side history for search terms. Wiring recent searches into the typeahead (BB1) and using them as a personalization signal (boost recently-viewed restaurants in results) would close the loop between home page intent and search page execution.

---

## Alarming

**James Beard "nominee" filter silently degrades to "winner"** — `page.tsx:309-312` and `page.tsx:343-347` both map `jamesBeard === 'nominee'` to `james_beard_winner === true`. The UI presumably offers a "Nominee" option that returns only winners. This is a data-integrity issue masquerading as a filter: users selecting "Nominee" get a subset of what they asked for with no warning. A comment (`james_beard_nominated was dropped`) is present but there is no user-visible degradation notice.
Source: `search/page.tsx:309-312`, `search/page.tsx:343-347`.
