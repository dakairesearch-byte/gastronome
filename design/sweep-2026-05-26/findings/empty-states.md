# empty-states

**Lens:** Every empty state in the app is either a dead end or a recoverable opportunity — this review assesses which is which.
**Reviewed:** search-desktop.png + EmptyState.tsx + search/page.tsx.

## Top 3 findings

1. [P1] **What's wrong:** The "No results found" empty state fires a single generic CTA — either "Reset filters" or "Discover" — but never both at the same time. A user who typed a query *and* has active filters active gets only "Reset filters," losing the escape hatch to browse curated content entirely. `search/page.tsx:553-558` makes these mutually exclusive: `ctaText={activeFilterCount > 0 ? 'Reset filters' : 'Discover'}`.
   **Why it matters:** Users who hit a zero-results wall with both a query and filters have nowhere useful to go except manually clearing each filter — the most likely response is abandonment.
   **What to do:** Show both actions (a primary "Reset filters" button and a secondary "Browse Explore" link) when `searchQuery && activeFilterCount > 0`. `EmptyState.tsx` supports only one CTA; add an optional `secondaryCta` prop.
   **Why you'd want to do this:** Reduces search dead-ends and drives users toward the Explore page (discovery loop), rather than a browser back-button exit.
   (effort: S)

2. [P1] **What's wrong:** The screenshot shows the search page with 3 active filters (Miami, Google ≥4.1, Yelp ≥3.0) displaying loading skeletons — the primer confirms results were never shown. There is no empty state for "filters active but still loading," and if results do come back empty, the description copy says only "Try relaxing a filter or adjusting your search terms" (`search/page.tsx:549`). It never names *which* filter combination is likely to blame (e.g., "Miami + Google ≥4.1 + Yelp ≥3.0 returned 0 restaurants").
   **Why it matters:** Users don't know whether to loosen the city, drop a rating threshold, or change something else — the message is a shrug, not a diagnosis.
   **What to do:** When `activeFilterCount > 0 && !hasAnyResults`, enumerate the active filter labels inline in the description: "No restaurants match Miami · Google ≥4.1 · Yelp ≥3.0. Try widening a rating filter."
   **Why you'd want to do this:** Precise dead-end messaging cuts "trial-and-error" filter adjustments and shortens time-to-first-result.
   (effort: S)

3. [P2] **What's wrong:** The "virgin" empty state (no query, no filters) shows icon + headline "Start searching" with description and a "Discover" CTA (`search/page.tsx:541-554`). The screenshot confirms this is the page's initial view — a blank search box with no ambient suggestions, trending terms, or recently searched items to seed intent.
   **Why it matters:** A blank slate requires users to arrive with a specific restaurant or dish in mind. Users in discovery mode (the majority visiting a food aggregator) bounce because there's no prompt to get started.
   **What to do:** Populate the empty-state (or the space above it) with 3–5 trending searches or recently viewed restaurants from `localStorage`. This requires no server call for returning users.
   **Why you'd want to do this:** Converts a passive waiting screen into an active discovery prompt, increasing search engagement from cold visits.
   (effort: M)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The `EmptyState` component icon always renders in emerald (`text-emerald-500`, `EmptyState.tsx:31`). For a "No results" state this reads as optimistic-green, which is tonally mismatched to user frustration.
   **Why it matters:** Color carries emotional signal; green on a failure state creates cognitive dissonance (unintended contradiction between visual tone and meaning).
   **What to do:** Accept an optional `iconColor` prop (defaults to `emerald-500`) and pass `gray-400` for dead-end states, emerald for invitational ones ("Start searching").
   **Why you'd want to do this:** Small color change, meaningful emotional alignment — zero new UI surface area.
   (effort: S)

2. **What's wrong:** When in "Dishes" mode with no results, the CTA renders as "Discover" linking to `/explore` (`search/page.tsx:553-554`). The Explore page is restaurant-level, not dish-level — the link does not continue the user's dish-search intent.
   **Why it matters:** A user searching for "ramen" who sees "Discover" and lands on a restaurant browse page gets a context switch — the app appears to have forgotten what they wanted.
   **What to do:** When `filters.mode === 'dishes'` and no results, CTA copy should be "Try a restaurant search" and switch mode to `'restaurants'` via `setFilters`, not navigate away.
   **Why you'd want to do this:** Keeps the user within search intent and increases the chance they find something.
   (effort: S)

3. **What's wrong:** The "From Google" result section (`search/page.tsx:618-657`) appears only when Gastronome returns local results AND Google Places are found. There is no empty state specific to "we don't have this restaurant yet, but Google does" — if local results are empty and Google Places API fails silently (error at line 214 `catch { return [] }`), the user sees only a dead-end empty state with no hint that the restaurant might exist outside Gastronome's database.
   **Why it matters:** A restaurant that exists on Google but not in Gastronome is an acquisition opportunity; the silent catch discards both the result and the suggestion to submit/request it.
   **What to do:** When `restaurants.length === 0 && googlePlaces.length === 0 && searchQuery.trim()`, add a secondary line: "Not in Gastronome yet? Suggest a restaurant." linking to `/review/new`.
   **Why you'd want to do this:** Turns a zero-result dead end into a user-growth funnel (UGC = user-generated content).
   (effort: S)

## One bigger bet (optional)

**What's wrong:** There is no area-coverage empty state for city-scoped searches. If a user picks a city not in the `cities` table, they get the same generic "No results found" state as a bad search query — there's no messaging explaining that Gastronome doesn't cover that city yet.
**Why it matters:** Users who search for restaurants in an unsupported city get no explanation, no expectation-setting, and no path forward — they just assume Gastronome is broken.
**What to do:** After a zero-result city-filtered search, check whether `filters.cities` contains values absent from `availableCities`. If so, render a bespoke empty state: "Gastronome doesn't cover [City] yet — we're in [list of covered cities]. Explore one of those instead?" with city quick-links.
**Why you'd want to do this:** Converts coverage confusion into an explicit expansion signal; covered-city quick-links drive exploration in supported markets.
**The tradeoff:** Requires a client-side diff between `filters.cities` and `availableCities` on every empty result — minor logic overhead, and the city quick-links require design decisions about how many to show without overwhelming.
(effort: M)

## Alarming (optional)

The Google Places API error visible in the restaurant screenshot (noted in primer) and the silent `catch { return [] }` at `search/page.tsx:214` mean that API failures are entirely invisible to the user — no fallback message, no retry affordance, and no signal to the team that the feature is broken in production.
