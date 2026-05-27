# map-location-ux

**Lens:** How well does the restaurant detail page orient users spatially — map rendering, location affordances, and navigation handoffs?
**Reviewed:** screenshot (`restaurant-desktop.png`) + `src/app/restaurants/[id]/page.tsx`.

## Top 3 findings

1. [P0] **What's wrong:** The Google Maps Embed iframe is broken in production — the screenshot shows a "Google Maps Platform rejected your request" error notice in place of the map, alongside a "Click to enable Google Maps" overlay.
   **Why it matters:** Every user arriving at a restaurant detail page sees a broken map widget. The sidebar's most actionable orientation feature is completely non-functional, replacing a trust signal with a visible API failure.
   **What to do:** Add a dedicated `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` env var in Vercel with "Maps Embed API" enabled (separate from the Places key). The code at line 801 already falls back to `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`, but the Places API key likely lacks Embed API permission. Confirm via Google Cloud Console → APIs & Services.
   **Why you'd want to do this:** A functional map is table-stakes for a restaurant aggregator — it anchors neighborhood context and drives "get directions" intent. Fixing one env var restores the feature for 100% of users.
   (effort: S)

2. [P1] **What's wrong:** There is no "get directions" affordance (a deep-link — a URL that opens a mapping app directly to a destination) on the page. The "View on Google Maps" link (line 827) opens Google Maps to the restaurant pin, but there is no native maps deep-link (`maps://`, Apple Maps, Waze), especially critical on mobile.
   **Why it matters:** A user planning to visit wants one tap to directions, not a browser tab context-switch. The current link is desktop-appropriate but ignores the mobile use case where the map widget is below the fold and competing with the social feed.
   **What to do:** Wrap the existing Google Maps link in platform detection: on iOS/Android link to `maps://` or `geo:` URIs respectively, and offer a "Directions" CTA alongside "View on Google Maps." On desktop, the current link is fine.
   **Why you'd want to do this:** Directions handoff is the conversion event that turns browsing into a visit — reducing friction there directly increases foot traffic attribution.
   (effort: M)

3. [P1] **What's wrong:** The map is conditionally rendered only when `restaurant.latitude && restaurant.longitude` exist (line 781), but there is no fallback when coordinates are missing. Users with incomplete restaurant records see the entire sidebar map section silently absent, with no address-search alternative.
   **Why it matters:** Users don't know whether the restaurant has no location data or whether there's a bug — both look identical (empty space). The address text in the hero (`restaurant.neighborhood || restaurant.city`, line 359) is their only spatial anchor, and it's not linkable.
   **What to do:** When coordinates are absent but `restaurant.address` or `restaurant.google_url` exist, render a fallback state: a static map placeholder (Google Static Maps with `q=address` parameter, no JS SDK needed) or at minimum a styled "See on Google Maps" button linking via `google_url`. Make the address text in the hero a tap-to-maps link unconditionally.
   **Why you'd want to do this:** Restaurants missing coordinates are disproportionately new additions — exactly the ones users want to explore. A linkable address costs nothing and works without coordinates.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The map `<iframe>` uses `aspect-video` (16:9, line 791), which renders tall and narrow in the 1-column sidebar — wasted vertical space for a map context where width matters more than height.
   **Why it matters:** A pinched map tile shows almost no street context, reducing its utility for neighborhood orientation.
   **What to do:** Change the sidebar map container to `aspect-[4/3]` or a fixed `h-44` — wide enough to show a few surrounding blocks.
   **Why you'd want to do this:** More geographic context per pixel makes the map actually useful rather than decorative.
   (effort: S)

2. **What's wrong:** The `<iframe>` `title` attribute is `Map of ${restaurant.name}` (line 808) — correct, but the map section has no visible label heading. The sidebar jumps from the map directly to "Similar Restaurants" (line 847) with no "Location" or "Find Us" heading.
   **Why it matters:** Screen-reader users (assistive technology users navigating by headings) cannot find the map section, and the address/directions affordance lacks a landmark.
   **What to do:** Add a small `<h3>` or labeled `<section aria-label="Location">` wrapping the map block, consistent with the "Similar Restaurants" heading pattern already in the sidebar.
   **Why you'd want to do this:** One line of markup improves accessibility and adds visual structure at no design cost.
   (effort: S)

3. **What's wrong:** The fallback `view` embed URL (line 805) uses a fixed `zoom=15`, which may under- or over-zoom depending on the neighborhood density (a rural restaurant vs. a Manhattan block).
   **Why it matters:** A zoom=15 map of a dense NYC block shows little street context; for a suburban location it zooms in on empty roads.
   **What to do:** Use the `place` embed type whenever `google_place_id` is available (already done), but for the lat/lng fallback consider `zoom=16` for urban restaurants (detectable via city) or let the Embed API default (omit `zoom` to let Google choose).
   **Why you'd want to do this:** Letting Google calibrate zoom for known place IDs produces better default views without any coordination overhead.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** The restaurant detail page has no neighborhood context — no "other restaurants in [neighborhood]" spatial grouping, no "you are 0.3 mi away" proximity signal, no map cluster (a grouped map pin representing multiple nearby locations) for browsing nearby options.
**Why it matters:** "What else is good nearby?" is a primary user intent after reading a restaurant profile. The "Similar Restaurants" sidebar serves cuisine affinity but not geographic proximity — two entirely different needs.
**What to do:** Add a mini explore strip — "More in [neighborhood]" — filtered by `neighborhood` field, below "Similar Restaurants." On mobile, consider a "Explore the neighborhood" CTA that deep-links to `/explore?neighborhood=X`. This does not require a map — a horizontal card scroll works.
**Why you'd want to do this:** Proximity browsing increases session depth and surfaces the aggregator's breadth organically — each restaurant becomes an entry point to a neighborhood cluster.
**The tradeoff:** Adds a fourth Supabase query per page load (or requires denormalized neighborhood counts), and the neighborhood field coverage may be incomplete — sections would render empty for restaurants with only a `city` field.
(effort: M)

## Alarming (optional, 1 line)

The `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` is being used as a Maps Embed API key (line 801) in production — if this key has broad API permissions enabled without HTTP-referrer restrictions, it is exposed to the browser and may be subject to quota theft.
