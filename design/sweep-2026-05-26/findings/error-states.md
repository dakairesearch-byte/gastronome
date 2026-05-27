# error-states

**Lens:** Network errors, API failures, closed restaurants, auth failures, and map errors — is recovery one tap?
**Reviewed:** screenshot (restaurant-desktop.png) + source file (src/app/restaurants/[id]/page.tsx).

## Top 3 findings

1. [P0] **What's wrong:** The Google Maps iframe silently renders a raw developer error message — "Google Maps Platform rejected your request. This API is not activated on your API project..." — in production, visible to all users in the sidebar map widget.
   **Why it matters:** The error exposes internal API key configuration details and a Google-hosted troubleshooting URL directly to end users (screenshot: sidebar map area). There is no fallback UI; the iframe simply shows Google's debug page inside the map container. Users cannot act on this, and it reads as broken product, not a transient glitch.
   **What to do:** Wrap the iframe in a client component that listens for the `error` event on the `<iframe>` element (or detects blank/error load via `onLoad` + content inspection); on failure render a fallback div with the restaurant address, a static map placeholder image, and a direct "Open in Google Maps" link using the coordinate-based fallback URL already present at page.tsx:822–825.
   **Why you'd want to do this:** A production API error surfaced raw to users erodes trust in Gastronome's data quality — the core brand promise. The fix also provides a usable location anchor even when Maps is unavailable.
   (effort: M)

2. [P1] **What's wrong:** The page has no 404-equivalent state (an error boundary — a React mechanism that catches render failures and shows fallback UI) for the map section when coordinates exist but the API key is misconfigured. The `notFound()` call at page.tsx:275 handles missing restaurants, but partial-data failures (bad API key, Maps quota exceeded, missing `google_place_id`) render nothing or a broken iframe without any user-visible signal.
   **Why it matters:** A user looking for location info sees a broken map with no explanation, no address fallback, and no action. The "View on Google Maps" link below the iframe (page.tsx:820–838) is visually separated from the broken map and easy to miss when the eye is drawn to the error notice above it.
   **What to do:** Move the "View on Google Maps" link to render as a prominent fallback inside the map container when the iframe fails — not below it. Add a one-line message: "Map unavailable — view directions on Google Maps."
   **Why you'd want to do this:** Keeps the user path to location intact even under infra failure; turns a dead end into a one-tap recovery.
   (effort: S)

3. [P1] **What's wrong:** The API key fallback logic at page.tsx:801–802 silently falls back from `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` to `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` with no guard for the case where both are absent or restricted. The screenshot confirms this fallback is live in production and is the root cause of the Maps Platform rejection — the Places key likely lacks Maps Embed API scope.
   **Why it matters:** The silent key substitution means the wrong key reaches Google, producing the rejection error users see. There is no logging, no alert, and no UI signal that the wrong key was used — so the team has no passive monitoring that this is happening across all restaurant pages.
   **What to do:** Add a server-side guard: if neither key is set, skip the iframe entirely and render the static fallback from finding #2 at build time (no client JS needed). Log a `console.error` on the server with the restaurant ID so the issue appears in Vercel function logs.
   **Why you'd want to do this:** Prevents the broken iframe from rendering in the first place for the common "key not set" case; makes the misconfiguration visible in observability tooling rather than only in user screenshots.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The `BookmarkButton` (page.tsx:313) and `ShareButton` (page.tsx:315) have no visible error states — if the bookmark Supabase call fails (e.g., auth session expired), the button gives no feedback.
   **Why it matters:** Users silently lose their saves with no retry path; for a social/collection-centric app this is high friction.
   **What to do:** Add a toast (a brief non-blocking notification that auto-dismisses) on bookmark failure with a "Try again" action. One line of state in the existing `BookmarkButton` component.
   **Why you'd want to do this:** Saves are a primary engagement action; silent failures undermine the list-building feature.
   (effort: S)

2. **What's wrong:** If `VideoGallery` (page.tsx:727) fails to load — network timeout, Supabase cold start — the "On Social" section renders its header and section chrome but no content and no message.
   **Why it matters:** Users see a labelled section with nothing in it, indistinguishable from "this restaurant has no social content."
   **What to do:** Add a one-line error state inside `VideoGallery`: "Couldn't load videos — try refreshing." Hide the section header when `videoCount === 0` already handles the empty case; this covers the error case.
   **Why you'd want to do this:** Avoids confusing empty section with data failure; cheap to add in `VideoGallery.tsx`.
   (effort: S)

3. **What's wrong:** The `getRestaurantData` function (page.tsx:83–213) uses `Promise.all` for four parallel queries. If the dishes or video queries fail, the entire page's data fetch throws and falls through to `notFound()` — a complete page-level 404 for a sidebar enrichment failure.
   **Why it matters:** A Supabase quota spike on the dishes table could make an otherwise-complete restaurant page return 404, which is worse than partial data.
   **What to do:** Wrap each secondary query in `Promise.allSettled` or individual try/catch; treat null results as empty rather than fatal.
   **Why you'd want to do this:** Increases resilience; a restaurant page with no dish chips is better than a 404.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** There is no "this restaurant may be permanently closed" state anywhere in the page. Google Places returns a `business_status` field; if it is `CLOSED_PERMANENTLY` the page renders identically to an open restaurant.
**Why it matters:** Users who navigate to a closed restaurant's page get full ratings, a map, social videos, and contact links — then show up to a shuttered venue. For an aggregator whose credibility rests on data freshness, this is a trust-destroying scenario.
**What to do:** Surface `business_status` from the database (or re-fetch from Places) and render a prominent amber banner at the top of the page: "This restaurant may be permanently closed. Verify before visiting." with a link to Google Maps for confirmation.
**Why you'd want to do this:** Directly protects the core user promise — don't waste my dinner plans. Differentiates Gastronome from static lists that never update.
**The tradeoff:** Requires a schema addition or enrichment pipeline pass to populate `business_status`; stale status data could incorrectly flag open restaurants.
(effort: L)

## Alarming (optional, 1 line)

Raw Google API credentials and troubleshooting URLs are visible to every user on every restaurant page with coordinates — screenshot confirms this is live in production right now.
