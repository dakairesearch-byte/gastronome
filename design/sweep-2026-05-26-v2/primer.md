# UI/UX Sweep v2 — 2026-05-26 — Primer

## App summary

Gastronome aggregates restaurant ratings from Google, Yelp, Michelin, James Beard, Eater 38, The Infatuation, TikTok, and Instagram into a single per-restaurant profile with unified ratings, trending scores, and curated editorial collections. The app surfaces this data through home/explore/cities/recent feeds, search with rich filtering, restaurant detail pages with dish-level recommendations, and a social layer (profile, community, reviews, bookmarks, collections).

## Screens reviewed (15 routes, 21 screenshots)

| Slug | Route | Purpose |
|---|---|---|
| `home` | `/` | Logged-in landing — suggestions grid + recent activity entry points |
| `explore` | `/explore` | Browse/discovery hub — curated lists, trending, category filters |
| `restaurant` | `/restaurants/[id]` | Per-restaurant detail page (sample: JoJo, NYC, 1 Michelin star) |
| `search` | `/search` | Search + filter experience with active filters (Miami + Google ≥4.1 + Yelp ≥3.0) |
| `cities` | `/cities` | All-cities index with per-city stats |
| `cities-newyork` | `/cities/new-york` | Single-city landing — NYC restaurants and neighborhood overview |
| `recent` | `/recent` | Recent activity / new arrivals feed |
| `community` | `/community` | Social feed — reviews from other users |
| `profile` | `/profile` | User profile (no specific id) |
| `review-new` | `/review/new` | Write-a-review form |
| `auth-login` | `/auth/login` | Sign-in modal |
| `onboarding-1` | `/onboarding` (pane 1) | "The Problem" pitch — scattered reviews |
| `onboarding-2` | `/onboarding` (pane 2) | "The Solution" pitch — unified aggregator |
| `onboarding-3` | `/onboarding` (pane 3) | City selection step |

(Pane 4 of onboarding — signup form — not captured because pane 3 requires a city selection to enable Continue; the signup surface is covered by `auth-login-desktop.png`.)

## Screenshots (21 total)

All saved as full-page PNGs to `design/sweep-2026-05-26-v2/screenshots/`.

| Filename | Screen | Viewport |
|---|---|---|
| `home-desktop.png` | Home | 1440 |
| `home-mobile.png` | Home | 390 |
| `explore-desktop.png` | Explore | 1440 |
| `explore-mobile.png` | Explore | 390 |
| `restaurant-desktop.png` | Restaurant detail (JoJo) | 1440 |
| `restaurant-mobile.png` | Restaurant detail (JoJo) | 390 |
| `search-desktop.png` | Search w/ active filters | 1440 |
| `search-mobile.png` | Search w/ active filters | 390 |
| `cities-desktop.png` | All cities | 1440 |
| `cities-mobile.png` | All cities | 390 |
| `cities-newyork-desktop.png` | Single city (NYC) | 1440 |
| `cities-newyork-mobile.png` | Single city (NYC) | 390 |
| `recent-desktop.png` | Recent feed | 1440 |
| `community-desktop.png` | Community feed | 1440 |
| `profile-desktop.png` | User profile | 1440 |
| `review-new-desktop.png` | Write a review | 1440 |
| `auth-login-desktop.png` | Sign in modal | 1440 |
| `onboarding-1-desktop.png` | Onboarding pane 1 (Problem) | 1440 |
| `onboarding-1-mobile.png` | Onboarding pane 1 (Problem) | 390 |
| `onboarding-2-desktop.png` | Onboarding pane 2 (Solution) | 1440 |
| `onboarding-3-desktop.png` | Onboarding pane 3 (City) | 1440 |

## Source files per screen

| Screen | Primary file | Key components |
|---|---|---|
| Home | `src/app/page.tsx` | `src/components/Navigation.tsx`, `src/components/Footer.tsx`, `src/components/RestaurantCard.tsx` |
| Explore | `src/app/explore/page.tsx` | `src/components/explore/CategoryFilters.tsx`, `src/components/explore/Top10Trending.tsx`, `src/components/cards/ExploreCollectionCard.tsx`, `src/components/RestaurantCard.tsx` |
| Restaurant | `src/app/restaurants/[id]/page.tsx` | `src/components/VideoGallery.tsx`, `src/components/VideoEmbed.tsx`, `src/components/BookmarkButton.tsx`, `src/components/AccoladesBadges.tsx`, `src/components/SourceBadge.tsx`, `src/components/SourceRatingsBar.tsx` |
| Search | `src/app/search/page.tsx` | `src/components/SearchBar.tsx`, `src/components/FilterChips.tsx`, `src/components/EmptyState.tsx`, `src/components/LoadingSkeleton.tsx` |
| Cities | `src/app/cities/page.tsx` | (no dedicated components) |
| City slug | `src/app/cities/[slug]/page.tsx` | `src/components/RestaurantCard.tsx` |
| Recent | `src/app/recent/page.tsx` | `src/components/RestaurantCard.tsx` |
| Community | `src/app/community/page.tsx` | shared review components |
| Profile | `src/app/profile/page.tsx`, `src/app/profile/[id]/page.tsx` | `src/components/BookmarkButton.tsx` |
| Review new | `src/app/review/new/page.tsx` | review form |
| Auth login | `src/app/auth/login/page.tsx` | `src/components/auth/SignInModal.tsx` |
| Onboarding | `src/app/onboarding/page.tsx` | `src/components/OnboardingFlow.tsx`, `src/components/auth/OnboardingSteps.tsx`, `src/components/OnboardingRestaurantPreview.tsx` |
| Shared | `src/app/layout.tsx`, `src/app/globals.css`, `src/components/Navigation.tsx`, `src/components/BottomNav.tsx`, `src/lib/restaurant.ts` | — |

## Routing table — specialist → assigned screenshots

Each specialist gets 1-4 screenshots most relevant to their lens. **Expanded scope this run**: top 5 findings + 5 quick wins + 2 bigger bets, 500-word cap.

### Tier 1 — Foodie panel (Opus)

| # | Specialist | Assigned screenshots |
|---|---|---|
| 1 | the-critic | `restaurant-desktop`, `home-desktop`, `cities-newyork-desktop`, `explore-desktop` |
| 2 | the-diner | `home-desktop`, `home-mobile`, `restaurant-desktop`, `search-desktop` |
| 3 | the-chef | `restaurant-desktop`, `review-new-desktop`, `community-desktop` |

### Tier 2 — UX specialists (Sonnet)

| # | Specialist | Assigned screenshots |
|---|---|---|
| 4 | information-architecture | `home-desktop`, `cities-desktop`, `explore-desktop`, `profile-desktop` |
| 5 | navigation | `home-desktop`, `home-mobile`, `restaurant-desktop`, `cities-newyork-desktop` |
| 6 | search | `search-desktop`, `search-mobile`, `home-desktop` |
| 7 | discovery | `home-desktop`, `explore-desktop`, `recent-desktop`, `community-desktop` |
| 8 | filtering | `search-desktop`, `search-mobile`, `explore-desktop` |
| 9 | ranking-visualization | `explore-desktop`, `cities-desktop`, `cities-newyork-desktop`, `recent-desktop` |
| 10 | restaurant-card | `explore-desktop`, `cities-newyork-desktop`, `home-desktop`, `recent-desktop` |
| 11 | restaurant-detail | `restaurant-desktop`, `restaurant-mobile` |
| 12 | dish-level-ux | `restaurant-desktop`, `review-new-desktop` |
| 13 | map-location-ux | `restaurant-desktop`, `cities-newyork-desktop`, `cities-desktop` |
| 14 | source-attribution | `restaurant-desktop`, `cities-newyork-desktop`, `explore-desktop`, `home-desktop` |
| 15 | saving-lists | `restaurant-desktop`, `profile-desktop`, `home-desktop` |
| 16 | onboarding | `onboarding-1-desktop`, `onboarding-2-desktop`, `onboarding-3-desktop`, `onboarding-1-mobile`, `auth-login-desktop`, `home-desktop` |
| 17 | empty-states | `search-desktop`, `home-desktop`, `profile-desktop`, `community-desktop`, `recent-desktop` |
| 18 | loading-states | `search-desktop`, `explore-desktop`, `cities-desktop` |
| 19 | error-states | `restaurant-desktop`, `cities-desktop` |
| 20 | microcopy | `home-desktop`, `onboarding-1-desktop`, `onboarding-2-desktop`, `auth-login-desktop`, `review-new-desktop` |
| 21 | typography | `restaurant-desktop`, `home-desktop`, `cities-newyork-desktop` |
| 22 | color-visual-identity | `home-desktop`, `restaurant-desktop`, `onboarding-1-desktop`, `explore-desktop` |
| 23 | food-photography | `explore-desktop`, `cities-newyork-desktop`, `restaurant-desktop`, `recent-desktop` |
| 24 | mobile-responsive | `home-mobile`, `explore-mobile`, `restaurant-mobile`, `search-mobile`, `cities-mobile`, `cities-newyork-mobile`, `onboarding-1-mobile` |
| 25 | accessibility | `home-desktop`, `restaurant-desktop`, `onboarding-1-desktop`, `auth-login-desktop`, `search-desktop` |

## Notes for specialists

- **Live Google Maps API error** is visible on `restaurant-desktop.png` mid-page sidebar. Real production issue (or was — the project was paused at the time of capture; current state may differ).
- **Search screenshot** captured with 3 filters active (Miami + Google ≥4.1 + Yelp ≥3.0) — loading skeletons visible.
- **Profile and Community** may render empty/minimal since the bypassed session is unauthenticated — examine that state itself as a UX surface.
- All screenshots taken against production (`gastronome.vercel.app`) via a temporary auth bypass that has been reverted.
- **v1 sweep findings exist** at `design/sweep-2026-05-26/` for reference — but you should form independent conclusions.
