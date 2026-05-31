# Mobile-Responsive Findings — v3 Re-Sweep
Specialist: mobile-responsive | Date: 2026-05-26

---

## Top 5 Findings

### 1. [STILL-OPEN] Content clipped under fixed bottom nav on every page [P1] — Effort: Low
The BottomNav is `fixed bottom-0 h-16` (64px) and is mounted globally in `layout.tsx`. No page adds a corresponding `pb-16` or `pb-20` to its main content, and the Footer only adds `pb-20` on mobile (`Footer.tsx:9`). That works fine for pages with a footer, but pages whose content ends before the footer — e.g. the restaurant detail page, search results area, profile empty state — have their last few rows of content permanently covered by the bottom bar. The recent-mobile screenshot shows list items running behind the nav rail without any visual clearance. Fix: add `pb-20` (or `pb-safe-bottom`) to the layout's `<main>` or every page wrapper.

**[P1] Effort: Low** — single class addition to `layout.tsx` or `globals.css`.

---

### 2. [STILL-OPEN] Cities and Recent unreachable from mobile bottom nav [P1] — Effort: Low
BottomNav (`BottomNav.tsx:26-31`) contains: Home, Explore, Search, Community, Profile. Cities and Recent are absent. On mobile the only path to Cities is the hamburger menu (which duplicates the top nav), and Recent has no mobile shortcut at all — it is footer-only. The cities-newyork-mobile screenshot confirms users land there via some other path, but the bottom tab bar offers no direct route. The top-nav hamburger has 5 items (including Cities) but bottom nav has only 4 content tabs + Profile, creating a two-tier navigation asymmetry. Either Cities should swap out Community (lowest-value on mobile), or a "More" overflow tab should be added.

**[P1] Effort: Low** — swap one `navTabs` entry in `BottomNav.tsx`.

---

### 3. [NEW] Collections popover opens off-screen on mobile restaurant cards [P1] — Effort: Medium
`BookmarkButton.tsx:231-308` renders the "Save to collection" popover as `absolute right-0 top-full w-72`. On a mobile card that is ~320px wide at most, a 288px (w-72) popover anchored to the right edge of a small bookmark icon (w-8, positioned near the right edge of the card) will overflow the left edge of the viewport. There is no viewport-clamping or `clamp()` logic. The popover is also missing `max-height` on mobile — the collection list can grow unbounded. Seen implicitly in explore-mobile and home-mobile where bookmark buttons sit in narrow card columns.

**[P1] Effort: Medium** — needs responsive anchor logic or a bottom-sheet variant on mobile.

---

### 4. [RESOLVED] NYC city page page-height (was ~126,000px) [P0 was]
`CityRestaurantGrid.tsx` now uses IntersectionObserver with PAGE_SIZE=24 and a 600px rootMargin pre-load. The cities-newyork-mobile screenshot shows 28 restaurants rendered (one PAGE_SIZE + a few from the next), and the page height is visually sane. This was the most severe v2 finding; it is fully resolved.

---

### 5. [REGRESSION] Dual navigation still present on mobile — hamburger + bottom nav [P2] — Effort: Medium
v2 flagged dual nav as confusing. The fix added Search to BottomNav, but the top-bar hamburger still exists on mobile and exposes the full nav set (Home, Explore, Cities, Community, Profile) plus Sign in/up (`Navigation.tsx:158-299`). Users now have two places to navigate on mobile: the bottom rail and the slide-in drawer. The drawer adds Cities and auth actions not present in the bottom rail, but this split is not obvious — most users will never open the hamburger. The drawer is now a proper `role="dialog"` with focus trap (a11y resolved), but the structural duplication remains a UX problem.

**[P2] Effort: Medium** — eliminate the hamburger; surface Cities + auth in an expanded bottom nav or a "More" drawer triggered from the bottom rail.

---

## Quick Wins (≤5)

1. **[RESOLVED] Header height** — `h-16` on mobile, `h-20` on desktop (`Navigation.tsx:65`). The h-28 burn is gone. Confirmed in all mobile screenshots.

2. **[RESOLVED] Search in bottom nav** — `BottomNav.tsx:29` adds Search between Explore and Community. Confirmed in search-mobile and home-mobile screenshots.

3. **[NEW] Sign-in modal `py-8` outer padding wastes viewport on small phones** — `SignInModal.tsx:331` applies `py-8` (32px top+bottom) to the fixed container. On a 667px phone (iPhone SE) that leaves only ~603px for a 90vh modal (~600px max). The signup form (Display Name + Username + Email + Password + City + CTA) is tall enough to require internal scroll on small devices, but the outer padding eats into it unnecessarily. Change `py-8` to `py-4` on mobile via `sm:py-8`.

4. **[STILL-OPEN] Recent page has no mobile entry point** — confirmed above. Recent is absent from the bottom nav and from the hamburger's visible list in the onboarding-1-mobile screenshot, where only Home/Explore/Search/Community/Sign-in appear in the bottom rail. Quick fix: add Recent to footer or hamburger drawer visibly.

5. **[NEW] Search mobile filter sheet close button is 18px icon with p-1 padding** — `search/page.tsx:780-784` renders the close ×  as `p-1` padding around an 18px icon, giving a ~26px tap target. Apple HIG minimum is 44px. One-line fix: `p-2.5`.

---

## Bigger Bets

1. **Bottom nav redesign: 5-tab with overflow "More"** — Current tab set (Home, Explore, Search, Community, Profile/Sign-in) drops Cities and Recent entirely. A conventional pattern is to add a "More" tab (ellipsis icon) that opens a bottom sheet with secondary destinations. This surfaces Cities and Recent within thumb reach without the hamburger-duplication problem, and lets the primary five tabs remain stable.

2. **Mobile-first modal bottom-sheet pattern** — The sign-in modal (`SignInModal.tsx`) and the collections popover (`BookmarkButton.tsx`) are both desktop-centered overlays. On mobile they would benefit from a bottom-sheet presentation (slides up from the bottom, full-width, natural thumb reach) rather than a centered dialog that the keyboard can push off-screen. This is a meaningful UX upgrade for the two most-triggered overlays on mobile.

---

## Alarming

The `recent-mobile.png` screenshot renders what appears to be ~200+ restaurant rows in a flat list with no pagination or infinite-scroll — the page is roughly 9,000px tall (thumbnail is 780x9092 per metadata). Infinite scroll was fixed for the City page but the Recent page may not have received the same treatment. If the Recent page fetches all restaurants and renders them server-side in one pass, this is a P0 equivalent of the NYC bug. Recommend immediate audit of `src/app/recent/page.tsx` for server-rendered list length and client-side pagination.
