# UI/UX Sweep v3 — 2026-05-26 — Primer (RE-SWEEP)

This is a **re-sweep** taken right after a large fix session that
addressed most of the v2 findings. Your job is to evaluate the CURRENT
state and, for each finding, tag it:
- **[RESOLVED]** — a v2 issue that now looks fixed (confirm it).
- **[REGRESSION]** — something the fixes made worse.
- **[STILL-OPEN]** — a v2 issue not yet addressed.
- **[NEW]** — something not previously flagged.

## App summary

Gastronome aggregates restaurant ratings (Google, Yelp, Michelin, James
Beard, Eater 38, The Infatuation, TikTok, Instagram) into one
per-restaurant profile with unified ratings, trending, and editorial
collections. Surfaces: home, explore, cities, recent, search, restaurant
detail, community, profile, onboarding.

## What shipped since v2 (verify these)

- **Gastronome Score** — a unified 0–10 score now leads the restaurant
  hero (was a sourceless "4.3 ★"), with a methodology tooltip.
- **Google Maps error fixed** — the raw "API rejected" panel is gone;
  detail pages now show a static neighborhood tile + "Get Directions" /
  "View on Maps" when no embed key is set.
- **Dishes/menus now load** — an RLS gap that blocked anon reads was
  fixed; "Signature Dishes" renders (or shows a graceful "Menu coming
  soon" with a link when empty).
- **Infinite scroll** — cities + search now auto-load on scroll (no
  "Load more" button); the NYC mobile page went ~126,000px → ~9,000px.
- **Breadcrumbs** on restaurant + city pages (Cities › City › Name).
- **Save button on cards** (both variants) via stretched-link pattern.
- **Compact cards** now have an 80×80 thumbnail + price chip.
- **Nav**: Cities added to top nav; Search added to mobile bottom nav;
  mobile header shrunk (h-28 → h-16); "Log in"→"Sign in" consistency.
- **Home**: city-aware ("Suggestions in <city>"), search hero, "Saved
  Collections" renamed "Editorial Picks", empty rails reworded.
- **Search**: quality-sorted (was alphabetical), result count, broken
  JBF "Nominee" filter removed, SSR shell (was blank).
- **Onboarding**: sign-in escape on every pane, city step no longer
  hard-blocks, sr-only step labels.
- **A11y**: focus ring → slate (was invisible gold-on-gold), sign-in
  modal focus trap, prefers-reduced-motion, skip link, aria-current,
  descriptive alt text.
- **Logo** fixed (middleware was redirecting /public assets).
- `is_critic: true` hardcode on signup removed.

## Screenshots (design/sweep-2026-05-26-v3/screenshots/)

Desktop (10): home, explore, restaurant, search, cities, cities-newyork,
recent, community, profile, onboarding-1 — all `*-desktop.png`.
Mobile (9): home, explore, restaurant, search, cities, cities-newyork,
recent, profile, onboarding-1 — all `*-mobile.png`.

Sample restaurant = JoJo (NYC, 1 Michelin star). Pages were captured via
a temporary auth bypass that has been reverted.

## Source files

Same layout as v2. Key files:
- Home `src/app/page.tsx`; Explore `src/app/explore/page.tsx` +
  `src/components/explore/Top10Trending.tsx`
- Restaurant `src/app/restaurants/[id]/page.tsx` +
  `src/components/GastronomeScoreBadge.tsx`, `Breadcrumb.tsx`
- Search `src/app/search/page.tsx` + `SearchBar.tsx`,
  `search/SearchFiltersSidebar.tsx`
- Cities `src/app/cities/page.tsx`, `src/app/cities/[slug]/page.tsx` +
  `src/components/cities/CityRestaurantGrid.tsx`
- Cards `src/components/RestaurantCard.tsx`, `SourceBadge.tsx`,
  `AccoladesBadges.tsx`, `BookmarkButton.tsx`
- Shared `src/app/layout.tsx`, `globals.css`, `Navigation.tsx`,
  `BottomNav.tsx`, `lib/score.ts`, `lib/collections.ts`
- Onboarding `src/components/OnboardingFlow.tsx`

## Routing table — specialist → screenshots (desktop + mobile)

Per request, mobile is routed to every specialist whose lens touches a
mobile-rendered surface.

| # | Specialist | Screenshots |
|---|---|---|
| 1 | the-critic | restaurant-desktop, restaurant-mobile, home-desktop, cities-newyork-desktop |
| 2 | the-diner | home-desktop, home-mobile, restaurant-desktop, restaurant-mobile, search-desktop |
| 3 | the-chef | restaurant-desktop, restaurant-mobile, community-desktop |
| 4 | information-architecture | home-desktop, cities-desktop, explore-desktop, profile-desktop |
| 5 | navigation | home-desktop, home-mobile, restaurant-mobile, cities-newyork-mobile |
| 6 | search | search-desktop, search-mobile, home-mobile |
| 7 | discovery | home-desktop, explore-desktop, recent-desktop, recent-mobile |
| 8 | filtering | search-desktop, search-mobile, cities-newyork-mobile |
| 9 | ranking-visualization | explore-desktop, cities-newyork-desktop, cities-newyork-mobile, recent-desktop |
| 10 | restaurant-card | explore-desktop, explore-mobile, cities-newyork-mobile, home-mobile |
| 11 | restaurant-detail | restaurant-desktop, restaurant-mobile |
| 12 | dish-level-ux | restaurant-desktop, restaurant-mobile |
| 13 | map-location-ux | restaurant-desktop, restaurant-mobile, cities-newyork-desktop |
| 14 | source-attribution | restaurant-desktop, restaurant-mobile, explore-desktop, home-desktop |
| 15 | saving-lists | restaurant-desktop, explore-mobile, profile-desktop, profile-mobile |
| 16 | onboarding | onboarding-1-desktop, onboarding-1-mobile, home-desktop |
| 17 | empty-states | search-desktop, profile-desktop, profile-mobile, community-desktop, recent-mobile |
| 18 | loading-states | search-desktop, search-mobile, cities-newyork-mobile |
| 19 | error-states | restaurant-desktop, cities-desktop, community-desktop |
| 20 | microcopy | home-desktop, home-mobile, onboarding-1-desktop, search-desktop |
| 21 | typography | restaurant-desktop, restaurant-mobile, home-mobile, cities-newyork-desktop |
| 22 | color-visual-identity | home-desktop, restaurant-desktop, explore-mobile, onboarding-1-desktop |
| 23 | food-photography | explore-desktop, explore-mobile, cities-newyork-mobile, restaurant-desktop |
| 24 | mobile-responsive | home-mobile, explore-mobile, restaurant-mobile, search-mobile, cities-newyork-mobile, recent-mobile, profile-mobile, onboarding-1-mobile |
| 25 | accessibility | home-desktop, home-mobile, restaurant-desktop, onboarding-1-desktop, search-mobile |

## Notes

- v2 synthesis is at `design/sweep-2026-05-26-v2/SYNTHESIS.md` for
  comparison — form your own judgment, but tag against it.
- Profile/community may render minimal/empty (unauth bypass session) —
  evaluate that state itself.
