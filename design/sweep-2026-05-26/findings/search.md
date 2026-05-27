# search

**Lens:** Evaluate search input affordance, autocomplete, result scoping (dish vs restaurant vs cuisine vs neighborhood), zero-results handling, and any analytics signals surfaced in the UI.
**Reviewed:** screenshot (search-desktop.png) + src/app/search/page.tsx + src/components/SearchBar.tsx.

## Top 3 findings

1. [P0] **What's wrong:** The search bar has no search icon visible on the left — the icon sits flush right alongside the clear button, making the field look like a plain text input with no affordance (visual cue signaling a field's purpose) that it is a search box. No label, no left-hand magnifier. (SearchBar.tsx line 48–49; confirmed in screenshot: input is visually unlabeled on the left.)
   **Why it matters:** Users scanning quickly — especially first-timers — may not register the field as a search entry point, reducing search engagement.
   **What to do:** Move the Search icon to the left-inside position (pl-10, icon at left-3) and remove it from the submit button row; keep the submit button only as the X-clear target.
   **Why you'd want to do this:** Standard search affordance (left icon + placeholder) is the single most-recognized pattern on the web; matching it removes decision friction for new users.
   (effort: S)

2. [P1] **What's wrong:** There is no inline autocomplete or typeahead dropdown. The component fires `onSearch` on every keystroke (SearchBar.tsx line 44–45), which triggers a 300ms-debounced database query (page.tsx line 429), but results replace the full list — there is no suggestion dropdown that lets users see and pick a match before committing. Google Places autocomplete is wired (page.tsx lines 151–219) but only runs after facet filters are cleared; it never surfaces as an in-field suggestion.
   **Why it matters:** Without typeahead, a user who types "Taco" sees a full re-render of the result list rather than focused suggestions, making it hard to discover restaurants by partial name.
   **What to do:** Add a suggestion dropdown inside SearchBar that shows top 3–5 Supabase restaurant name matches and (when available) Google Places predictions; dismiss on selection or Escape.
   **Why you'd want to do this:** Autocomplete is the primary trust signal that a search is "smart"; it also surfaces Gastronome's unique dish search scope — a natural place to show a "Dishes matching 'ramen'" suggestion row.
   (effort: L)

3. [P1] **What's wrong:** The search scope toggle (restaurants / dishes / all) lives inside the filter sidebar, not adjacent to the search bar. A user who wants to search dishes must first open the sidebar to find the mode toggle. The placeholder text changes contextually (page.tsx lines 480–484) but does not teach the user that a mode exists or how to reach it.
   **Why it matters:** Dish-level search is a differentiating feature of Gastronome; hiding its entry point in the sidebar means most users will never discover it.
   **What to do:** Promote a "Restaurants | Dishes" pill toggle (segmented control) directly above or below the search bar, making scope selection a first-class interaction rather than a filter setting.
   **Why you'd want to do this:** Scope clarity is the #1 search usability factor on multi-entity apps; surfacing it above the fold also demonstrates product depth to new visitors.
   (effort: M)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** Zero-results copy says "Try relaxing a filter or adjusting your search terms" (page.tsx line 549) but does not tell the user which specific filter is likely the culprit — e.g., the screenshot shows Miami + Google ≥4.1 + Yelp ≥3.0 active simultaneously.
   **Why it matters:** Vague recovery guidance leaves users to guess which of three active filters to remove, increasing abandonment.
   **What to do:** When `activeFilterCount > 0` and results are zero, dynamically name the most-restrictive filter (e.g., "Try removing the Google ≥4.1 rating filter").
   **Why you'd want to do this:** Guided recovery raises search re-engagement rates and reduces dead-end exits.
   (effort: S)

2. **What's wrong:** The loading state shows three skeleton cards (page.tsx line 529–532) even when the user has only typed one character and results are instant on fast connections; on slow connections skeletons persist with no progress signal.
   **Why it matters:** Skeleton loaders (placeholder shapes shown while content loads) with no timeout fallback or count estimation feel like a frozen UI on slow connections.
   **What to do:** Show a single slim progress bar at the top of the result column for fast queries, and cap skeletons to the previous result count if known.
   **Why you'd want to do this:** Matching skeleton count to expected results prevents the jarring re-layout when fewer cards appear than skeleton slots.
   (effort: S)

3. **What's wrong:** "From Google" result rows (page.tsx lines 618–657) link to `/review/new?name=...` — a create-review flow — rather than a detail page. The distinction between an in-database restaurant and a Google-only suggestion is not explained anywhere in the UI.
   **Why it matters:** A user clicking a "From Google" result expecting to read reviews will be dropped into a create-review form with no context.
   **What to do:** Add a one-line subtext below the "From Google" label: "Not yet in Gastronome — tap to add it." This sets correct expectations.
   **Why you'd want to do this:** Correct expectations prevent surprise drop-offs and reframe the link as an invitation, not a broken result.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** No recent-searches or search-history affordance exists. The URL-sync and localStorage filter persistence (page.tsx lines 82–117) preserve filters across sessions but the search query is not stored, so returning users start cold every visit.
**Why it matters:** Repeat searches for the same dish or neighborhood are the core habit loop for a review aggregator; cold-start every session breaks that loop.
**What to do:** Store the last 5 search queries in localStorage; render them as chips below an empty search bar on focus, labeled "Recent searches."
**Why you'd want to do this:** Recent searches are the single highest-ROI search feature for returning users — zero server cost, high activation.
**The tradeoff:** If a user shares a device, another person sees their search history; adds a "Clear history" affordance requirement to keep it trustworthy.
(effort: M)

## Alarming (optional, 1 line)

The Google Places API key is exposed client-side via `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` (page.tsx line 126) and loaded in a dynamically injected script tag — any visitor can extract it from DevTools with zero effort; restrict this key to your production domain in the Google Cloud Console immediately.
