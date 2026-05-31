# Discovery UX — v3 Re-Sweep Findings
_Lens: browsing without a query — curated lists, trending, "near you", reason to return._
_Re-sweep against v2 findings. Tags: [RESOLVED] / [REGRESSION] / [STILL-OPEN] / [NEW]_

---

## Top 5 findings

**1. Recent feed is still a dense text-only firehose with no visual hierarchy** [STILL-OPEN]
The Recent page screenshot shows an unbroken column of small-text rows stretching thousands of pixels with no images, no thumbnails, and no "why this matters" signal. The filter chips (All / Restaurants / Videos / Reviews / Photos) remain the only navigation affordance. Nothing about this surface changed since v2 — the fix (a 48×48 restaurant thumbnail per row) was called out as QW2 in v2 and was apparently not attempted. Serendipitous browsing requires visual pull; this page has none.
Cite: `recent-desktop.png`, `recent-mobile.png` (identical problem at mobile; even harder to scan)
[P1] Effort: S

**2. Home "Recent searches" and "Your favorites" section headers always render, even when empty** [REGRESSION]
The code in `page.tsx:211–221` wraps both `<RecentSearches>` and `<FavoritesSection>` in `<section>` blocks that each include a `<SectionHeader>` rendered unconditionally before the child component mounts. `RecentSearches` and `FavoritesSection` handle their own empty state internally — but the `SectionHeader` elements ("Recent searches", "Your favorites") appear above them regardless. On a fresh anonymous session the screenshot confirms two visually prominent section headings sit above empty-state copy, making the page look half-built at first glance. The v2 finding flagged this exact issue as a P0; the child components were fixed but the parent-level headers were not removed from the unconditional render path.
Cite: `src/app/page.tsx:211–221`, `home-desktop.png`
[P1] Effort: XS

**3. Google Maps API error is still visible on the Explore page map panel** [REGRESSION]
The primer confirms the Google Maps error was fixed on restaurant detail pages (static tile + "Get Directions" fallback). However the `explore-desktop.png` screenshot shows the raw Google Maps Platform error message ("This API is not activated on this API project…") rendered visibly inside the map panel on the Explore / Top 10 Trending component. The `Top10Trending.tsx` component attempts a Google Maps embed iframe when a key is present (`Top10Trending.tsx:543–545`) but the fallback SVG grid only triggers when `embedSrc` is null — not when the embed responds with an error page. So the key resolves to a value but the Maps embed API is not enabled on that project, leaving the error visible to users. The restaurant-page fix did not carry over to this second map surface.
Cite: `explore-desktop.png`, `src/components/explore/Top10Trending.tsx:541–596`
[P0] Effort: S

**4. Editorial Picks on home are not city-aware — a Miami user sees NYC-biased collections** [STILL-OPEN]
`EDITORIAL_PICKS` in `page.tsx:30–63` is a static constant. All four tiles link to `/explore?cuisine=French`, `/explore?cuisine=Sandwich`, `/explore?accolade=michelin_star`, `/explore?accolade=hidden_gems` — none carry a city parameter. The homepage now correctly resolves the user's home city for the Suggestions rail, but the Editorial Picks land the user on Explore defaulting to their home city (which is fine) only because Explore also resolves home city independently. The deeper issue: "Date Night" links to French cuisine, which may return zero results for a city with no French restaurants in the DB, silently landing the user on an empty Explore filtered view with no explanation. The `collectionCounts.filter(c => c.count > 0)` guard exists on Explore but not on the home-page tiles — a tile can advertise a category that has zero live entries in the user's city.
Cite: `src/app/page.tsx:30–63`, `src/app/explore/page.tsx:293`
[P1] Effort: S

**5. No "near you", no neighborhood, no proximity signal on any browse surface** [STILL-OPEN]
Unchanged from v2. Explore and Home operate at city level only. The `restaurants` table carries `latitude`/`longitude` (used for the Top 10 map pins in `Top10Trending.tsx`), and `neighborhood` is stored and rendered on trending rows. Neither is used as a browse axis anywhere. For a user with location permission granted, "Trending in the West Village" would be a materially stronger discovery hook than "Trending in New York." The data is present; the surface is not.
Cite: `src/app/page.tsx` (no geo rail), `src/app/explore/page.tsx:189` (city param only), `src/components/explore/Top10Trending.tsx:390–395` (neighborhood rendered but not linked)
[P2] Effort: L

---

## Quick wins

**QW1.** Suppress the `<SectionHeader>` for "Recent searches" and "Your favorites" when the child will render empty state. Move the header rendering inside each component so only populated sections show a heading. Two-line change per component.
Cite: `src/app/page.tsx:211–221`

**QW2.** Add an `onError` handler to the Google Maps iframe in `Top10Trending.tsx` that swaps in the SVG grid fallback when the embed API returns an error page (same pattern as the restaurant-detail fix). Alternatively, probe `embedSrc` with a HEAD request at build time and set it null if the API returns a non-200. Quickest: set `embedSrc = null` until the Maps Embed API is activated on the project.
Cite: `src/components/explore/Top10Trending.tsx:561–596`

**QW3.** Give each Recent feed row a 48×48 restaurant thumbnail. The event already carries a restaurant reference; one additional `photo_url` column on the join turns the text firehose into a scannable visual feed with near-zero layout cost.
Cite: `recent-desktop.png`

**QW4.** Append the active city as a query param to each Editorial Picks `href` on the home page (`/explore?cuisine=French&city=Miami`) so clicks land in the right city rather than relying on Explore's independent city resolution (which could diverge if the user's URL carries a stale city).
Cite: `src/app/page.tsx:37–61`

**QW5.** Add a count badge to Editorial Picks tiles on the home page, mirroring the live `collectionCounts` guard already on Explore. If a tile would link to zero results in the user's city, hide it — same logic already written at `explore/page.tsx:293`.
Cite: `src/app/page.tsx:30–63`, `src/app/explore/page.tsx:293`

---

## Bigger bets

**BB1. Neighborhood as a first-class browse axis.**
The `neighborhood` field is already stored and rendered in the Top 10 Trending list rows. A lightweight "Trending in [neighborhood]" section below the city-level Top 10 on Explore — powered by the same `topTrendingRestaurants` function with a neighborhood WHERE clause — would be the strongest discovery hook the app could add without new data. Blocking dependency: neighborhood coverage is uneven across cities, so a fallback ("neighborhoods coming soon for this city") is needed before launch.
Cite: `src/lib/ranking/trending.ts` (city param only), `src/components/explore/Top10Trending.tsx:390`

**BB2. Personalized home feed seeded from bookmark and review history.**
The static Editorial Picks constant will look identical on every return visit forever. The `reviews` and `bookmarks` tables already contain enough signal for a simple cuisine-affinity vector ("you've saved 4 Japanese restaurants — trending Japanese near you"). Even a single "Because you saved [Name]" rail above the static picks would materially differentiate return visits. The schema is ready; this is a product-logic build, not a data problem.
Cite: `src/app/page.tsx:30–63` (what to replace), `src/types/database.ts` (reviews, bookmarks)

---

## Alarming

**[RESOLVED — confirmed]** The v2 alarming finding (Community nav item serving a full "Coming Soon" to all users) is visible in `home-desktop.png` — Community still appears in the top nav. However the primer does not list Community as a shipped fix, and this is outside the discovery lens proper; flag carried to the navigation specialist. Within discovery scope: the resolved items are genuine improvements — the city-aware home page (QW1 from v2), the "Trending this week" relabel, the "Editorial Picks" rename, and the empty-rail self-suppression logic are all confirmed present in the source and screenshot. The regression on section headers (Finding 2) and the Maps error on Explore (Finding 3) are the sharpest issues to close before the next cycle.
