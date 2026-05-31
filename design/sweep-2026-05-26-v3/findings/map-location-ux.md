# Map / Location UX — Sweep v3 Findings

Specialist: map-location-ux
Screenshots reviewed: restaurant-desktop, restaurant-mobile, cities-newyork-desktop
Source reviewed: src/app/restaurants/[id]/page.tsx

---

## v2 Finding Status

**[RESOLVED] Google Maps API error on restaurant page.** The raw "Google Maps Platform rejected your request" panel is confirmed gone. The code now gates the iframe on `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` (page.tsx:889) and falls back to a static gray tile with a pin emoji when the key is absent. Both screenshots show the static tile rendering cleanly — no API error text visible anywhere on the page. This was the most-alarming finding in v2; it is definitively fixed.

---

## Top 5 Findings

### 1. Static tile has zero geographic signal — it is a decorative placeholder, not a map [NEW]
**P1 · Effort: medium**

The fallback tile is a flat gray-blue gradient with a centered pin emoji and the neighborhood name (page.tsx:929–969). It conveys no spatial information — no street grid, no surrounding landmarks, no scale. A user cannot glean anything about where the restaurant sits relative to transit, a park, or another landmark they know. At small sidebar width (~300px on desktop) the tile is roughly square, so the full "map" area communicates only "somewhere in Lower East Side." This is technically not a regression — it is the intended fallback — but the UX cost of an uninformative map-shaped region is real: users who most need location context (first visit, unfamiliar neighborhood) get the least. The restaurant-desktop screenshot confirms this state is what production shows.

Source: page.tsx:929–969. Screenshot: restaurant-desktop sidebar.

### 2. Static tile is a large click target that opens the wrong URL for first-time visitors [NEW]
**P1 · Effort: low**

The entire square tile is wrapped in an `<a>` pointing to `viewUrl` — the Google Maps listing page (page.tsx:929). The two buttons below are "Get Directions" and "View on Maps." A user tapping the tile and a user tapping "View on Maps" reach the identical destination. The "Get Directions" deep-link (page.tsx:898: `maps/dir/?api=1&destination=`) is the genuinely useful action for mobile users about to travel to the restaurant, but it is deprioritized to the smaller bottom-left button. The tile click should either (a) go to the directions URL on mobile, or (b) go to the maps listing — but in either case it duplicates one of the two explicit buttons, making the tile click feel redundant rather than purposeful.

Source: page.tsx:929, 976–1003. Screenshot: restaurant-mobile map block.

### 3. "Get Directions" button lacks visual icon — low discoverability on mobile [NEW]
**P2 · Effort: low**

Both "Get Directions" and "View on Maps" are plain text links with `text-xs uppercase` styling (page.tsx:982–1001). No navigation arrow, compass, or map-pin icon accompanies either action. On a 375px screen these render as ~44px-tall tap targets with small, all-caps text. The Lucide `Navigation` or `ExternalLink` icon used elsewhere in the file (page.tsx:10) would make the intent immediately parseable without reading the label — especially relevant in a right-sidebar context where the user's eye skims rather than reads. The restaurant-mobile screenshot shows the buttons are functional but visually thin compared to the rest of the UI's icon+label patterns (phone, globe icons in the hero at page.tsx:400–435 are paired).

Source: page.tsx:976–1001. Screenshot: restaurant-mobile.

### 4. Map block disappears entirely when latitude/longitude is null — no fallback address display [STILL-OPEN]
**P2 · Effort: low**

The entire map block is conditionally rendered on `restaurant.latitude && restaurant.longitude` (page.tsx:888). When coordinates are missing the sidebar contains only "Similar Restaurants." The address is already available as `restaurant.address` (displayed in the hero at page.tsx:379) — a simple text address card in the sidebar would at minimum give users something to copy-paste or search. This was not flagged explicitly in v2 but the cities-newyork page shows restaurants without coordinates are in the data set.

Source: page.tsx:888. Hero address reference: page.tsx:379.

### 5. Directions deep-link does not prefer the Place ID when available [NEW]
**P2 · Effort: low**

`directionsUrl` is always built from `lat,lng` as the destination (page.tsx:898). The code already has `google_place_id` and uses it for the embed and the view URL (`placeQuery` at page.tsx:893). Using `destination_place_id` in the directions link produces more reliable navigation (especially for restaurants inside complexes or malls where a coordinate drops the pin in a parking lot). The fix is one line: when `restaurant.google_place_id` is present, build the URL as `destination=&destination_place_id=<id>` instead.

Source: page.tsx:898–899.

---

## Quick Wins (≤5)

1. **Add a `Navigation` icon to "Get Directions" and an `ExternalLink` to "View on Maps"** — two `import` additions and two JSX changes. page.tsx:976–1001.
2. **Wire the tile click to `directionsUrl` instead of `viewUrl`** on mobile (or set tile href to `directionsUrl` unconditionally) — removes the redundant duplicate and promotes the higher-value action. One attribute change.
3. **Add `title` attribute to the static tile `<a>`** — currently `aria-label` is set (page.tsx:939) but no `title` tooltip shows on hover. Rename `aria-label` to both, or add a tooltip. Trivially reduces confusion about what the click does.
4. **Show a plain-text address card when lat/lng is null** — render `restaurant.address` in a small bordered card in the sidebar position where the map would appear, so location info is never completely absent.
5. **Use `destination_place_id` in the directions URL** when `google_place_id` is set — one conditional string change at page.tsx:898.

---

## Bigger Bets

**A. Integrate a real static map image (no API key required).**
Services like OpenStreetMap's Static Maps API or Stadia Maps are free-tier and keyless for reasonable request volumes. A 600x600 PNG centered on the restaurant coordinates would make the sidebar genuinely useful — users can see the street grid and orient before navigating. This sidesteps the Google embed-key requirement entirely and avoids the "decorative tile" problem permanently. Effort: medium (one `<img>` tag + server-side URL construction; no auth complexity).

**B. Sticky "Get Directions" button on mobile restaurant page.**
On mobile the map block sits well below the fold (confirmed in restaurant-mobile screenshot — the block appears after Signature Dishes, On Social, The Story, and the contact row). By the time a user scrolls to it they have read the full page. A floating bottom action bar with "Get Directions" + "Reserve" (when reservation URL is available) that appears after the hero scrolls out of view would dramatically improve conversion for users in trip-planning mode. This is a layout-level change but well-scoped.

---

## Alarming

None. The v2 alarming finding — the raw API error rendering as page content — is confirmed resolved. The static fallback tile is unpolished but not harmful.
