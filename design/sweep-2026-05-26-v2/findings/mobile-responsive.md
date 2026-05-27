# Mobile-Responsive Findings
_Specialist: mobile-responsive | Sweep v2 2026-05-26_

---

## Top 5 Findings

**1. Dual nav conflict — hamburger + bottom bar both present on mobile**
The `Navigation.tsx` renders a top-bar hamburger that slides in a right-drawer panel (lines 142–154, 160–276), while `BottomNav.tsx` provides a persistent bottom tab bar. Both coexist on `<md` viewports. The drawer duplicates all four routes already in the bottom bar, creating redundant controls. `onboarding-1-mobile.png` shows the hamburger in the top-right alongside the visible bottom bar — two nav systems for four destinations is confusing and wastes screen real estate.

**2. Top header eats 112 px of viewport on mobile (h-28 = 7rem)**
`Navigation.tsx` line 58: `h-28` is 112 px. On a 390×844 device this is 13% of viewport height consumed by the sticky header before any content renders. `home-mobile.png` shows the "Suggestions" headline pushed far down under the logo. The desktop logo at 96×96 px (`w-24 h-24`, line 67) is clipped and renders broken on mobile — the image is cropped to a square of near-full header height. The bottom bar adds another 64 px (`h-16`, BottomNav line 39), leaving only ~668 px of usable scroll area.

**3. Cities-NYC page renders an unusably thin single-column list with no card treatment**
`cities-newyork-mobile.png` shows restaurants rendered as raw text rows with no image, no rating chip, no breathing room — essentially a plain `<ul>`. The full-page screenshot is ~126 k px tall for what should be a browsable list. Compare with `cities-newyork-desktop.png` where cards have photos and ratings. There is no responsive card fallback for this route (`src/app/cities/[slug]/page.tsx`).

**4. Google Maps embed placeholder is a blank gray box on mobile**
`restaurant-mobile.png` shows a large empty gray area where the map should appear (between "The Story" and "VIEW ON GOOGLE MAPS"). On desktop (`restaurant-desktop.png`) the Maps API error is at least visible as text; on mobile the block is silent. The blank box has no min-height constraint, collapses awkwardly, and there is no fallback state (static map image, coordinates link, or error copy) — dead viewport real estate on the most action-relevant page.

**5. Search page has no visible input on initial mobile load**
`search-mobile.png` shows results and filter chips but the search bar itself is absent from the top of the viewport — the user has no clear re-query affordance visible without scrolling. Filter chips are horizontally scrollable but there is no visual scroll affordance (fade, arrow). The active filter chips (`Miami`, `Google ≥4.1`, `Yelp ≥3.0`) are small and their dismiss targets are below 44 px recommended touch size.

---

## 5 Quick Wins

**QW1. Bottom nav missing "Search" tab**
`BottomNav.tsx` lines 22–26 define only Home/Explore/Community/Profile. Search is the primary action on a food app but has no bottom-bar slot. Add Search (magnifying glass) as the second tab; demote Community to desktop-only or a secondary surface.
_cite: `BottomNav.tsx:22–26`_

**QW2. `safe-area-inset-bottom` padding is correct but content still clips behind bottom nav**
`BottomNav.tsx` line 36 applies `paddingBottom: env(safe-area-inset-bottom, 0px)` to the nav itself, but page-level content has no compensating `pb-16` (64 px) to clear the nav. `home-mobile.png` bottom sections ("Saved Collections") are partially obscured.
_cite: `BottomNav.tsx:36-39`, `home-mobile.png`_

**QW3. Mobile drawer close button is 28 px — below minimum tap target**
`Navigation.tsx` line 181: `p-1` around a 20 px icon = ~28 px tap target. Should be `p-2.5` (44 px) to meet WCAG 2.5.5.
_cite: `Navigation.tsx:181`_

**QW4. Onboarding "Continue" CTA is well-placed but footer bleeds below it**
`onboarding-1-mobile.png` shows the footer and bottom nav visible beneath the onboarding card, revealing that the onboarding layout does not suppress the global chrome. The nav tabs are dead weight during a linear 4-step flow and add visual noise.
_cite: `onboarding-1-mobile.png`, `src/components/OnboardingFlow.tsx`_

**QW5. Explore category images render at full width with no aspect-ratio lock on mobile**
`explore-mobile.png` category collection images scale to full width but crop inconsistently — some show portrait crops, some landscape. Add `aspect-[4/3]` and `object-cover` uniformly.
_cite: `explore-mobile.png`, `src/components/cards/ExploreCollectionCard.tsx`_

---

## 2 Bigger Bets

**BB1. Collapse top header to 56 px logo-bar on mobile; make bottom nav the sole nav**
Remove the hamburger entirely on mobile. Reduce `h-28` to `h-14` (56 px), keep only the wordmark, and rely on the bottom tab bar exclusively for navigation. This recovers 56 px of content viewport on every screen and eliminates the dual-nav confusion. The right-drawer content (Log in / Sign up) can move to a "Profile" tab sheet. Estimated scope: `Navigation.tsx` + layout padding adjustments.

**BB2. Introduce a sticky mini-header on restaurant detail mobile**
`restaurant-mobile.png` has no persistent affordance showing restaurant name or a back button once the user scrolls past the hero. On a long page (ratings → social → story → map → similar restaurants), context is lost. A 48 px sticky bar that appears on scroll with restaurant name, star rating, and a bookmark icon would dramatically improve orientation and reachability of the primary save action.
_cite: `restaurant-mobile.png`, `src/app/restaurants/[id]/page.tsx`_

---

## Alarming

**The cities-newyork-mobile page is ~126,000 px tall** (full-page screenshot metadata). This implies the entire restaurant list renders client-side with no pagination or virtual scroll. On a slow mobile connection this is both a performance and UX crisis — the page is effectively unusable. Requires pagination or infinite-scroll with a sentinel, not merely a visual fix.
_cite: `cities-newyork-mobile.png`, `src/app/cities/[slug]/page.tsx`_
