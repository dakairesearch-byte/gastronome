# Map & Location UX — Findings
**Specialist:** map-location-ux | **Sweep:** 2026-05-26-v2

---

## Top 5 Issues

**1. Google Maps API error kills the single map surface (ALARMING)**
The sidebar map on the restaurant detail page throws a visible Google Maps Platform error: "This API project is not authorized…" and renders a blank gray box with an error overlay. The embed key (`NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY`) is either missing from the production env or the Embed API is not enabled on the GCP project. The fallback is the plain-text "View on Google Maps" link — which still works — but the visual map is the primary spatial affordance and it is completely broken for all users.
`restaurant-desktop.png` sidebar (top of right column); `src/app/restaurants/[id]/page.tsx` lines 799–816

**2. No map anywhere on the city page — 519 restaurants, zero spatial context**
`/cities/new-york` lists hundreds of restaurants in a flat text grid with no neighborhood map, no bounding box, no "show on map" control. Users cannot develop any spatial intuition about where the restaurants are relative to each other or to their location. Neighborhood names appear as text metadata on cards but there is no visual layer connecting them.
`cities-newyork-desktop.png` (entire body); `src/app/cities/[slug]/page.tsx` — no map component referenced

**3. No "Get Directions" affordance on restaurant detail**
The sidebar offers "View on Google Maps" (line 827) but that opens the restaurant's listing page, not turn-by-turn navigation. There is no `maps://` deep-link, no Google Maps directions URL (`?dirflg=d`), and no Apple Maps fallback. On mobile this is the primary pre-visit action. The link also uses `restaurant.google_url` (the review page) rather than a maps intent URL, so even the label "View on Google Maps" misrepresents the destination.
`src/app/restaurants/[id]/page.tsx` lines 819–838; `restaurant-desktop.png` sidebar

**4. Cities index has no map — geographically blind city selection**
`/cities` shows 6 cities as a text list ranked by restaurant count. There is no map showing where these cities are, no visual grouping (West Coast / East Coast), and no "near me" affordance. A user visiting for the first time cannot tell at a glance whether Gastronome covers their metro area without reading all six city names.
`cities-desktop.png`; `src/app/cities/page.tsx` (no map component — separate file, not provided but confirmed absent by screenshot)

**5. Map aspect ratio is `aspect-video` (16:9) — wrong shape for a location map**
The sidebar iframe is forced to `aspect-video` (line 791, class `aspect-video`). A 16:9 landscape ratio is good for video; for a neighborhood location map the ideal is closer to square or portrait (the map needs vertical room to show nearby streets). The current shape crops the map so heavily that the restaurant pin can be near the top or bottom edge, hiding the surrounding context.
`src/app/restaurants/[id]/page.tsx` line 791; `restaurant-desktop.png` sidebar

---

## 5 Quick Wins

**QW1. Add a "Get Directions" link beneath "View on Google Maps"**
Construct `https://www.google.com/maps/dir/?api=1&destination=lat,lng` (or `maps:?daddr=lat,lng` for iOS). One `<a>` tag addition. Zero backend work.
`src/app/restaurants/[id]/page.tsx` lines 818–838

**QW2. Fix "View on Google Maps" URL to use the maps listing, not the reviews page**
When `google_url` points to the reviews tab (`/place/…/reviews`), strip the `/reviews` suffix or build a clean `https://www.google.com/maps/place/?q=place_id:${google_place_id}` URL. One-line change.
`src/app/restaurants/[id]/page.tsx` line 822

**QW3. Add `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` check and graceful fallback**
If the key is falsy, skip the iframe and render the address + a styled "Open in Google Maps" button instead of a blank gray box. Prevents the broken-map state regardless of API key status.
`src/app/restaurants/[id]/page.tsx` lines 799–816

**QW4. Change map container from `aspect-video` to `aspect-square`**
One Tailwind class change. A square map centered on the restaurant's coordinates gives 33% more vertical context with zero layout disruption in the sidebar.
`src/app/restaurants/[id]/page.tsx` line 791

**QW5. Show neighborhood name as a filter chip link on restaurant detail**
The neighborhood string is already rendered in the hero (`lines 358–360`). Make it a link to `/cities/[slug]?cuisine=…` or `/search?neighborhood=…` so users can jump to nearby restaurants spatially. Zero new data needed.
`src/app/restaurants/[id]/page.tsx` lines 357–361

---

## 2 Bigger Bets

**BB1. City page: neighborhood mini-map with count overlays**
Add a lightweight static map (Google Maps Static API or Mapbox Static) above the restaurant grid on `/cities/[slug]`, with labeled neighborhood circles sized by restaurant count. Clicking a circle scrolls to that neighborhood group or filters the list. This transforms a 500-row text dump into a spatial discovery surface and directly enables the neighborhood browsing mental model that restaurant-dense cities require. Data is already present (`neighborhood` field on every restaurant row).

**BB2. "Map view" toggle on city and search pages**
Add a split-pane layout (list left, interactive map right) as an opt-in toggle. Restaurant cards highlight when their pin is hovered on the map; the map re-centers as the user scrolls the list. This is the canonical pattern for restaurant aggregators (Yelp, Google Maps, OpenTable) and is conspicuously absent. The existing lat/lng data on every restaurant row makes pin placement free — the investment is purely in the map component and the sync logic.

---

## Alarming

**Google Maps iframe is broken in production.** The embed renders a full-width error state ("This API project is not authorized…") where the map should be. Every restaurant detail page with coordinates shows this broken surface. Fix by enabling the Maps Embed API in GCP and ensuring `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` is set in the Vercel production environment — or remove the iframe and fall back to the static address block until the key is confirmed working.
`restaurant-desktop.png`; `src/app/restaurants/[id]/page.tsx` lines 799–816
