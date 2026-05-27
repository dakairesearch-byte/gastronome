# Error States — Sweep v2 findings

Lens: network errors, 404s, closed restaurants, auth failures, geolocation denied, map tile failures, API cascade. Is recovery one tap?

---

## Top 5 Findings

**1. Google Maps iframe fails silently with a raw error page — no fallback UI**
The map widget in the sidebar renders a full-browser Google error ("Google Maps Platform rejected your request…") directly inside the `<iframe>`. The error is visible as a mid-page content island on `restaurant-desktop.png`. There is no catch, no skeleton, no fallback to a static image or a direct "Open in Google Maps" link. Users have no recovery path besides the faint link below the iframe.
`src/app/restaurants/[id]/page.tsx` lines 799–816 (bare `<iframe>` with no `onerror`, no `onload` state, no fallback branch).

**2. `notFound()` is the only restaurant-not-found recovery — no soft 404 with suggestions**
When `getRestaurantData` returns null (bad ID, deleted restaurant, DB timeout), the page calls Next.js `notFound()` at line 275, which throws to the nearest `not-found.tsx`. There is no bespoke "restaurant not found" surface: no message explaining why, no link back to Explore or the referring city, no similar-restaurant suggestions. A user who clicked a dead shared link hits a cold dead end.
`src/app/restaurants/[id]/page.tsx` line 275.

**3. Cities page renders silently empty if Supabase returns no rows — zero error signal**
`citiesData` is destructured with no `error` check (line 32). If the DB call fails or returns zero active cities, `visibleCities` is empty and the page shows the generic "Cities coming soon — we're adding restaurants every day." card (lines 266–270). A Supabase outage is indistinguishable from "no data yet." There is no retry, no error boundary, no status message. `cities-desktop.png` renders correctly in the happy path — but upstream failure is silent.
`src/app/cities/page.tsx` lines 32–38, 264–270.

**4. `BookmarkButton` renders on the restaurant page for unauthenticated users — auth failure is invisible**
The bookmark button (`<BookmarkButton restaurantId={restaurant.id} />`) appears in the hero for all visitors (line 313). No auth gate is shown pre-click. If the user is unauthenticated, the click will silently fail or redirect to login with no prior signal. There is no tooltip, no lock icon, no "sign in to save" affordance before interaction.
`src/app/restaurants/[id]/page.tsx` line 313.

**5. Paginated restaurant fetch in cities has no error guard — partial data is mistaken for complete**
The cities page paginates restaurants in a `for` loop (lines 64–73) but only reads `data`, discarding `error`. A Supabase error mid-loop returns an empty `page`, which the `rows.length < PAGE_SIZE` check treats as "last page reached." Stats then silently reflect a partial dataset — e.g. Michelin or accolade counts are under-reported — with no indication to the user.
`src/app/cities/page.tsx` lines 64–73.

---

## 5 Quick Wins

**QW1. Add `<noscript>` or `onError` fallback on the map iframe.**
When the iframe fails to load, swap in a static Google Maps link button. One `onError` handler on the iframe container or an error event listener eliminates the raw error island. `src/app/restaurants/[id]/page.tsx` line 807.

**QW2. Wrap the Supabase cities fetch in an `error` check and show a real error message.**
Destructure `error` alongside `data` on line 32; if truthy, render "Unable to load cities right now — try refreshing" instead of "Cities coming soon." Distinguishes outage from genuinely empty state.
`src/app/cities/page.tsx` line 32.

**QW3. Add a `title` attribute tooltip to `BookmarkButton` when user is unauthenticated.**
"Sign in to bookmark" on hover costs one prop and prevents silent failure surprise. `src/app/restaurants/[id]/page.tsx` line 313.

**QW4. Add `error` guard to the paginated restaurant loop in cities.**
Break out of the loop and surface a partial-data warning banner if any page returns an error. `src/app/cities/page.tsx` lines 64–73.

**QW5. Harden the `VideoGallery` component against fetch failures.**
The `<VideoGallery restaurantId={restaurant.id} />` call at line 727 has no visible error state in the source. A failed video fetch should show "No videos yet" rather than blank space or a spinner that never resolves. `src/app/restaurants/[id]/page.tsx` line 727.

---

## 2 Bigger Bets

**BB1. Global error boundary + retry surface for the restaurant detail page.**
The entire restaurant page is a single async server component with no React error boundary. A transient Supabase error (DB timeout, rate limit) during any of the four parallel `Promise.all` fetches at line 98 will throw and bubble to the root Next.js error page. A dedicated `error.tsx` for the `[id]` route with "Something went wrong — try again" and a single Retry button would contain the blast radius and keep the user on-page. This is a full shell-plus-error-file addition.
`src/app/restaurants/[id]/page.tsx` line 98.

**BB2. Structured stale-data disclosure for closed/moved restaurants.**
The app has no "this restaurant may have closed" signal. `revalidate = 60` (line 15) means data can be up to 60 seconds stale, but there is no timestamp shown, no "last updated" line, and no mechanism to flag a restaurant as closed in the DB schema surfaced to users. When Google marks a place closed and the data hasn't synced, users see confident ratings with no caveat. A "Data last refreshed X ago — report an issue" footer on the restaurant card, paired with a `is_closed` or `last_verified_at` field, would close this trust gap end-to-end.

---

## Alarming

**Live Google Maps API key error visible in production screenshot.** The `restaurant-desktop.png` screenshot shows the Google Maps Platform error banner rendered inside the live map iframe — meaning this was a real production failure at capture time, not a dev artifact. The error text references the API project being paused. The `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` or `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` env var falling back (line 801) into the embed URL means the embed key inherits whatever billing/quota state the places key has. If the project is re-paused, every restaurant with coordinates shows a broken map widget to every user, with no fallback. This needs a key-health check in CI or a static-map fallback.
`src/app/restaurants/[id]/page.tsx` lines 800–816; `restaurant-desktop.png` sidebar.
