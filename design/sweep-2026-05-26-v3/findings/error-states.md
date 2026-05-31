# Error States — v3 Re-Sweep Findings

**Lens:** network errors, 404s, auth failures, geolocation, map tile failures, Supabase error handling.

---

## Status tags

### [RESOLVED] Restaurant detail Maps iframe gating
The restaurant page now checks `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` exclusively (restaurant `[id]/page.tsx` line 889). If absent, a static neighborhood tile + "Get Directions" / "View on Maps" renders instead. No raw API error leaks on the detail page. Confirmed in restaurant-desktop screenshot.

### [RESOLVED] Cities page Supabase error swallowing
`cities/page.tsx` lines 43-45 now log `citiesError` to the server console, and lines 83-86 log per-page `pageError` during paginated restaurant fetches, then break the loop cleanly. Previously both silently produced empty/partial data indistinguishable from "no restaurants yet."

### [STILL-OPEN] Top 10 Trending map panel renders raw Google Maps API error
`Top10Trending.tsx` lines 540-542 replicate the exact bug the restaurant page was fixed for: the component falls back to `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` when no dedicated Maps Embed key is set. That Places key almost never has the Maps Embed API enabled. The result is visible in explore-desktop.png — the map panel contains the Google Maps Platform rejection error banner as rendered page content, overlaid by the numbered pins. The SVG grid fallback (lines 572-596) is never reached because `mapsKey` is truthy (the Places key exists) even though it is the wrong key. Source: `Top10Trending.tsx:540-544`, explore-desktop.png.
**[P0] Effort: 5 minutes — remove the `|| process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` fallback on line 542, or mirror the restaurant page's single-key guard. The SVG grid fallback already exists and looks fine.**

### [STILL-OPEN] Cities page error state shows no user-facing message
When `citiesError` fires, the code logs to the server and falls through to render an empty `visibleCities` array, which surfaces the "Cities coming soon" copy (`page.tsx` line 289). That copy reads as a product promise, not an error indicator. A DB outage looks identical to "we haven't launched yet." No toast, no retry link, no distinguishable state.
**[P1] Effort: small — pass an `isError` flag into the JSX branch and render distinct copy ("Something went wrong loading cities — try refreshing") when the Supabase error path was hit.**

### [NEW] Community page has no auth-failure path — "Coming Soon" is the only state
`community/page.tsx` is a static placeholder with no Supabase call and no sign-in prompt. Unauthenticated users see "Members Only / Coming Soon" (community-desktop.png), which is intentional for now. However there is no CTA — no "Sign in to join" link, no email capture. If a future build gates this behind auth and the session check fails, the page has no error branch at all, making silent auth failures invisible.
**[P2] Effort: small — add a "Sign in" link or email waitlist CTA to the Coming Soon state before the feature ships.**

---

## Top 5

1. **[STILL-OPEN] Explore Top 10 map — raw Google API error rendered** (`Top10Trending.tsx:542`, explore-desktop.png)
   The Places API key is used as a fallback for the Maps Embed API; the embed is rejected and the error text appears in the map panel as page content, on top of the interactive pins. Identical to the bug fixed on the restaurant detail page — the fix just wasn't applied here.
   [P0] Effort: 5 minutes.

2. **[STILL-OPEN] Cities DB error is server-only — user sees misleading "Coming Soon"** (`cities/page.tsx:43-47`)
   Supabase error is logged but not surfaced; the empty-state copy reads as a product placeholder, masking infrastructure failures from users.
   [P1] Effort: low.

3. **[RESOLVED] Restaurant detail Maps iframe gating** (`[id]/page.tsx:888-970`)
   Correctly gates on `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` only; no fallback to the Places key; static tile renders cleanly when key absent. Confirmed in screenshot.
   [RESOLVED]

4. **[RESOLVED] Cities Supabase error logging** (`cities/page.tsx:43-45, 83-86`)
   Both the cities fetch and each paginated restaurant page now log errors explicitly and handle partial-fetch failure safely.
   [RESOLVED]

5. **[NEW] Community page no auth-error branch or sign-in CTA** (`community/page.tsx`)
   Static placeholder has no fallback for auth failure and no sign-in affordance; will need a real error state before the feature ships.
   [P2] Effort: low.

---

## Quick Wins (≤5)

- **Top 10 map fix** — remove `|| process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` at `Top10Trending.tsx:542`. One line.
- **Cities error copy** — add `if (citiesError) return <ErrorState />` before the JSX in `cities/page.tsx` so a DB outage shows a retry message, not "coming soon."
- **Community sign-in CTA** — one `<Link href="/sign-in">` under the description in `community/page.tsx` costs nothing and eliminates a dead end.
- **Explore page missing `Suspense` error boundary** — `Top10Trending` is a client component with no `ErrorBoundary` wrapping it in `explore/page.tsx`; a runtime error inside it white-screens the section silently.
- **Restaurant 404 is handled** (`notFound()` at `[id]/page.tsx:278`) — verified, no issue.

---

## 2 Bigger Bets

1. **Unified Supabase error boundary pattern.** Every server component that queries Supabase makes the same mistake: errors are either swallowed or logged but not shown to users. A shared `<DatabaseError>` component + a helper `assertData(data, error)` that throws on error (caught by the nearest Next.js error boundary) would fix this once across all pages instead of patching each page individually.

2. **Client-side network error recovery.** Infinite-scroll in cities and search (`CityRestaurantGrid`, search page) fetches client-side on scroll. Neither wraps the fetch in a try/catch with a retry UI. A failed page-load mid-scroll silently stops adding results, indistinguishable from "no more restaurants." Adding a `fetchError` state with a "Retry" button would close this gap.

---

## Alarming

**The Top 10 map error (P0) is the same bug that nine v2 specialists flagged as their single most alarming finding — it was fixed on the restaurant page but not on the Explore page.** The fix is one line. The visible Google error banner sits directly inside the editorial flagship section of the app and reads as a broken product.

Source: `Top10Trending.tsx:540-542`, `explore-desktop.png`.
