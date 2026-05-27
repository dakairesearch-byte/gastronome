# mobile-responsive

**Lens:** How well the layout, navigation, and interactions adapt to a 390×844 mobile viewport with thumb-zone constraints.
**Reviewed:** home-mobile.png (390×844), home-desktop.png (1440×900), BottomNav.tsx, Navigation.tsx.

## Top 3 findings

1. [P0] **What's wrong:** A hamburger menu (top-right, Navigation.tsx:143–154) coexists with a bottom nav bar (BottomNav.tsx:18–104) — both render on mobile. The hamburger opens a right-side drawer with the same four destinations already in the bottom nav.
   **Why it matters:** Two competing navigation systems create confusion about which one to use; the drawer duplicates every route and adds a redundant "Menu" header, wasting interaction cost for no gain.
   **What to do:** Remove the hamburger and drawer entirely on mobile (`md:hidden` already gates most of it, but the hamburger button in Navigation.tsx is not gated — add `hidden md:block` or remove it). Let BottomNav own all mobile navigation.
   **Why you'd want to do this:** Reduces cognitive load, eliminates the dead-end drawer interaction, and frees ~112px of sticky header height that currently boxes out content.
   (effort: S)

2. [P1] **What's wrong:** The sticky top header is 112px tall (`h-28`, Navigation.tsx:58) — nearly 13% of the 844px viewport — before any content appears. On mobile (home-mobile.png), this leaves very little visible content above the fold above the bottom nav bar (64px, BottomNav.tsx:39).
   **Why it matters:** The usable "thumb zone" (the area comfortable for one-handed use in the middle of the screen) is already compressed; a tall fixed header pushing content down and a fixed bottom nav pulling it up leave approximately 668px of scroll canvas, but the first content card is only partially visible, requiring an immediate scroll to understand what the page offers.
   **What to do:** Reduce mobile header height to 56–64px (`h-14` or `h-16`). The logo image is 96×96px (Navigation.tsx:64) — scale it to 40×40px on mobile with a responsive class.
   **Why you'd want to do this:** More first-fold content improves perceived performance and reduces the need to scroll to understand the page's value.
   (effort: S)

3. [P1] **What's wrong:** The Suggestions grid (home-mobile.png) renders as a single-column vertical list of full-width cards. On desktop (home-desktop.png) it is a 4-column grid. There is no swipeable horizontal carousel — users must scroll vertically through all 8 suggestion cards before reaching "Recent Searches" or "Your Favorites."
   **Why it matters:** Vertical stacking of 8 cards buries secondary content far below the fold, defeating the purpose of a discovery landing page. Horizontal swiping (a gesture — a touch interaction where the user drags left/right) is the native mobile pattern for browsing peer items without losing vertical scroll position.
   **What to do:** Convert the Suggestions grid to a horizontally scrollable row (`overflow-x-auto flex snap-x snap-mandatory`) with `scroll-snap-align: start` on each card, showing ~1.5 cards to signal more content.
   **Why you'd want to do this:** Users can browse suggestions without losing context of the rest of the page, and the "Recent Searches" and "Favorites" sections move above the fold.
   (effort: M)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** Bottom nav tap targets are `flex-1` inside a `h-16` (64px) container, so each target is approximately 97px wide × 64px tall — acceptable width, but the icon+label stack (`Icon size={22}` + `text-[10px]` label, BottomNav.tsx:52–63) means the interactive hit area is concentrated on the icon, not the full cell.
   **Why it matters:** Small tap targets increase mis-taps, especially for the outer "Home" and "Sign in" tabs near screen edges.
   **What to do:** Add `min-h-[44px]` to each `Link`/`button` inside the nav and ensure `py-2` padding is applied uniformly (it is, BottomNav.tsx:47), then verify the full cell is tappable via `w-full h-full` on the anchor.
   **Why you'd want to do this:** Apple HIG and WCAG both require 44×44pt minimum; meeting it reduces mis-taps with no visual change.
   (effort: S)

2. **What's wrong:** The mobile menu drawer (Navigation.tsx:160–276) slides in from the right with no animation — it appears/disappears instantly (`mobileOpen && <div>`). No `transition` or `transform` class is applied.
   **Why it matters:** Abrupt appearance breaks the spatial mental model (the idea that UI elements occupy a consistent place in space) that makes drawers feel natural. Users can't tell where the panel came from or where it went.
   **What to do:** Since the drawer will be removed per Finding 1, this becomes moot — but if any overlay modal remains, add `transition-transform duration-200 translate-x-full` / `translate-x-0` toggle.
   **Why you'd want to do this:** Smooth transitions reduce perceived jank and orient users spatially.
   (effort: S)

3. **What's wrong:** "Saved Collections" cards (visible at the bottom of home-mobile.png) appear to be a 2-column grid on mobile, with small portrait-aspect images. Collection names are truncated and barely legible at this size.
   **Why it matters:** Collections are a key retention feature; if users can't read collection names, they won't tap into them.
   **What to do:** Switch to a single-column horizontal scroll row (same pattern as Finding 3), with wider landscape-aspect cards (~280px wide) and larger collection name text (minimum 14px rendered).
   **Why you'd want to do this:** Legible collection cards increase tap-through and reinforce the saving/bookmarking habit loop.
   (effort: M)

## One bigger bet (optional)

**What's wrong:** The entire home page uses a top-down vertical scroll model on mobile. A tab-strip or swipeable page approach — where Home, Explore, and Community are swipeable peer pages rather than separate navigations — would make primary destinations feel instantly reachable.
**Why it matters:** Discovery apps (Yelp, Google Maps, Infatuation) increasingly use bottom-tab + horizontal swipe between top-level pages to maximize thumb reachability and reduce navigation latency.
**What to do:** Implement horizontal page-level swipe between Home / Explore / Community using a shared `PageSlider` wrapper that maps swipe direction to route transitions, keeping the BottomNav as the persistent anchor.
**Why you'd want to do this:** Reduces navigation to a single gesture, keeps thumb in the comfortable lower-screen zone, and matches user expectations set by peer apps.
**The tradeoff:** Deep-links and back-button behavior become more complex to manage; browser history and URL state must be carefully synchronized with swipe position, or users will get disoriented when they use the browser back button.
(effort: L)

## Alarming (optional)

The sticky top nav (`h-28`, 112px) + bottom nav (64px) + `env(safe-area-inset-bottom)` consumes up to 176px+ of an 844px viewport — over 20% of screen real estate — before a single byte of restaurant content is visible.
