# UI/UX Sweep — 2026-05-26 — Primer

## App summary

Gastronome aggregates restaurant ratings from Google, Yelp, Michelin, James Beard, Eater 38, The Infatuation, TikTok, and Instagram into a single per-restaurant profile with unified ratings, trending scores, and curated editorial collections. The app surfaces this data through city pages, an explore/search experience, restaurant detail pages, and a social layer (reviews, bookmarks, collections).

## Screens reviewed (4)

| Slug | Route | Purpose |
|---|---|---|
| `home` | `/` | Logged-in landing — discovery + recent activity entry point |
| `explore` | `/explore` | Browse/discovery hub — curated lists, trending, cuisine filters |
| `restaurant` | `/restaurants/[id]` | Per-restaurant detail page (screenshot: JoJo, NYC, 1 Michelin star) |
| `search` | `/search` | Search + filter experience (active filters: Miami, Google ≥4.1, Yelp ≥3.0) |

## Screenshots (8 = 4 routes × 2 viewports)

All saved to `design/sweep-2026-05-26/screenshots/`. Full-page PNGs.

| Filename | Screen | Viewport |
|---|---|---|
| `home-desktop.png` | Home | 1440×900 |
| `home-mobile.png` | Home | 390×844 |
| `explore-desktop.png` | Explore | 1440×900 |
| `explore-mobile.png` | Explore | 390×844 |
| `restaurant-desktop.png` | Restaurant detail (JoJo) | 1440×900 |
| `restaurant-mobile.png` | Restaurant detail (JoJo) | 390×844 |
| `search-desktop.png` | Search | 1440×900 |
| `search-mobile.png` | Search | 390×844 |

## Source files per screen

| Screen | Primary file | Key components |
|---|---|---|
| Home | `src/app/page.tsx` | `src/components/Footer.tsx`, `src/components/cards/*`, layout in `src/app/layout.tsx` |
| Explore | `src/app/explore/page.tsx` | `src/components/explore/CategoryFilters.tsx`, `src/components/explore/Top10Trending.tsx`, `src/components/cards/ExploreCollectionCard.tsx`, `src/components/RestaurantCard.tsx` |
| Restaurant detail | `src/app/restaurants/[id]/page.tsx` | `src/components/VideoGallery.tsx`, `src/components/VideoEmbed.tsx`, `src/components/BookmarkButton.tsx`, ratings-dashboard subcomponents |
| Search | `src/app/search/page.tsx` | `src/components/SearchBar.tsx`, filter UI inline in page |
| Shared | `src/components/Navbar.tsx` (top nav), `src/app/globals.css` (design tokens), `src/lib/restaurant.ts` (photo URL fallback) | — |

## Routing table — specialist → assigned screenshot

Each specialist reviews ONE screenshot (the most relevant to their lens) + the relevant source files above.

### Tier 1 — Foodie panel (Opus)

| # | Specialist | Screenshot |
|---|---|---|
| 1 | the-critic | `restaurant-desktop.png` |
| 2 | the-diner | `home-desktop.png` |
| 3 | the-chef | `restaurant-desktop.png` |

### Tier 2 — UX specialists (Sonnet)

| # | Specialist | Screenshot |
|---|---|---|
| 4 | information-architecture | `home-desktop.png` |
| 5 | navigation | `explore-desktop.png` |
| 6 | search | `search-desktop.png` |
| 7 | discovery | `home-desktop.png` |
| 8 | filtering | `search-desktop.png` |
| 9 | ranking-visualization | `explore-desktop.png` |
| 10 | restaurant-card | `explore-desktop.png` |
| 11 | restaurant-detail | `restaurant-desktop.png` |
| 12 | dish-level-ux | `restaurant-desktop.png` |
| 13 | map-location-ux | `restaurant-desktop.png` |
| 14 | source-attribution | `restaurant-desktop.png` |
| 15 | saving-lists | `restaurant-desktop.png` |
| 16 | onboarding | `home-desktop.png` |
| 17 | empty-states | `search-desktop.png` |
| 18 | loading-states | `search-desktop.png` |
| 19 | error-states | `restaurant-desktop.png` |
| 20 | microcopy | `home-desktop.png` |
| 21 | typography | `restaurant-desktop.png` |
| 22 | color-visual-identity | `home-desktop.png` |
| 23 | food-photography | `explore-desktop.png` |
| 24 | mobile-responsive | `home-mobile.png` |
| 25 | accessibility | `home-desktop.png` |

## Notes for specialists

- A live Google Maps API error is visible on `restaurant-desktop.png` mid-page (Google Maps Platform "Reject API key" notice). Real production issue — surface it if your lens applies.
- Search screenshot was captured with 3 filters active (Miami city, Google rating ≥4.1, Yelp rating ≥3.0) — note the loading skeletons rather than results.
- All screenshots taken against production (`gastronome.vercel.app`) via a temporary auth bypass that has been reverted.
