# Navigation — RE-SWEEP v3 findings (2026-05-26)

Lens: wayfinding, breadcrumbs, back behavior, active-state, deep linking, "where am I + how back?" — desktop and mobile.

---

## Status on v2 items

- [RESOLVED] Cities added to top desktop nav (`Navigation.tsx` line 18, visible home-desktop.png).
- [RESOLVED] Search added to mobile bottom nav (`BottomNav.tsx` line 29, visible home-mobile.png bottom bar).
- [RESOLVED] Mobile header height reduced from h-28 to h-16 (confirmed home-mobile.png).
- [RESOLVED] Breadcrumb component shipped; used on restaurant detail (`restaurants/[id]/page.tsx` line 315) and city page (`cities/[slug]/page.tsx` line 175).
- [RESOLVED] `aria-current="page"` on active links in both Navigation (line 93, 219) and BottomNav (line 52).
- [RESOLVED] Active underline on desktop nav (Navigation.tsx line 109–114).
- [RESOLVED] Mobile menu promoted to `role="dialog"` with `aria-modal="true"` (Navigation.tsx line 188–189).

---

## Top 5 findings

### 1. [NEW] Profile appears twice in desktop top nav — redundant and confusing [P1] S
**What's wrong:** `navItems` (Navigation.tsx line 12–21) includes `Profile` as a nav link (line 20), and the header also renders a separate Profile icon+label affordance at lines 123–155. On desktop, "Profile" appears in the centered nav cluster AND again as a right-rail button. The right-rail button correctly toggles based on auth state (Sign in vs Profile), but the nav cluster always shows "Profile" regardless.
**Why it matters:** Two tappable paths to the same destination with no visual distinction is confusing and wastes precious nav real estate. The duplicate also means `aria-current="page"` fires on both elements simultaneously when on /profile, announcing the page twice to screen readers.
**What to do:** Remove `Profile` from `navItems` (Navigation.tsx line 20). The right-rail auth button already handles the auth-aware affordance correctly and is the right place for it.
**Why you'd want to:** Cleaner nav cluster, no duplicate aria-current, one fewer nav item leaves room to breathe or add something meaningful (e.g. Search).
Cite: `Navigation.tsx` lines 20 and 120–155; home-desktop.png top bar.

---

### 2. [NEW] Cities active state fires on restaurant detail pages — nav lies about location [P1] S
**What's wrong:** `isActivePath` in Navigation.tsx (line 27–30) marks `/cities` active for any path starting with `/cities/`. A restaurant detail page lives at `/restaurants/[id]`, not under `/cities/`, so that part is fine — but when a user arrives at a city page (`/cities/new-york`) the breadcrumb correctly shows `Cities › New York`, yet the desktop nav highlights "Cities" without any sub-destination context. More critically: the breadcrumb city link in the restaurant hero (`/cities/${citySlug(restaurant.city)}`) can construct an incorrect URL if `citySlug()` diverges from the actual stored slug (e.g. city stored as "New York City" would slug to "new-york-city" while the DB may have "new-york"). The function comment at restaurant.ts line 94 acknowledges this risk explicitly ("If a stored slug ever deviates, the city page's own `notFound()` handles it gracefully") — meaning breadcrumb links can silently 404 for users.
**Why it matters:** A 404 mid-breadcrumb-trail is a dead end for a deep-linked user who wants to browse their city. The nav active state is the only anchor they have.
**What to do:** Drive the breadcrumb city link from the restaurant's `city` field matched against a server-fetched slug from the `cities` table, not a client-side slug derivation. This is a one-field join already done for the city page anyway.
**Why you'd want to:** Breadcrumbs are only trustworthy wayfinding if all their links reliably land.
Cite: `src/lib/restaurant.ts` lines 97–104; `restaurants/[id]/page.tsx` line 321.

---

### 3. [NEW] Hamburger button missing `aria-expanded` — screen readers can't track menu state [P1] S
**What's wrong:** The mobile hamburger button (Navigation.tsx line 158–169) has `aria-label="Toggle menu"` but no `aria-expanded` attribute. The open/closed state (`mobileOpen`) is tracked in React state but never surfaced to assistive technology.
**Why it matters:** A screen reader user tapping the button has no way to know whether the menu opened or closed — the button announces itself identically in both states. `aria-expanded` is the standard ARIA pattern for disclosure buttons and is required for WCAG 2.1 AA conformance.
**What to do:** Add `aria-expanded={mobileOpen}` and `aria-controls` pointing to the dialog's id on the button element (Navigation.tsx line 158). Add a matching `id` to the dialog div.
**Why you'd want to:** Two-attribute fix, zero visual change, full compliance.
Cite: `Navigation.tsx` lines 158–169.

---

### 4. [STILL-OPEN] Bottom nav has no Cities tab — mobile users on city pages lose bottom-nav context [P2] M
**What's wrong:** Cities is in the desktop top nav but absent from the mobile bottom nav (`BottomNav.tsx` navTabs, lines 26–31). The bottom nav has 5 slots (Home, Explore, Search, Community, Profile/Sign-in). When a mobile user navigates to a city page (`/cities/new-york`), none of the five bottom tabs is highlighted — none of them match the active path — making the bottom nav appear broken and leaving the user without a "you are here" signal.
**Why it matters:** Cities is described in the primer as a first-class content pillar. Mobile users who follow a link to a city page see an unlit bottom nav and must rely entirely on the breadcrumb, which is in the hero and scrolls out of view. Visible in cities-newyork-mobile.png: bottom nav is present but no tab is lit.
**What to do:** Replace the least-used bottom tab (Community, which requires auth and is empty for new users) with Cities, or use a 5-tab layout with Cities in place of Community and move Community behind the hamburger/profile drawer.
**Why you'd want to:** Consistent active-state across surfaces builds confidence that navigation is working correctly.
Cite: `BottomNav.tsx` lines 26–31; cities-newyork-mobile.png.

---

### 5. [NEW] Restaurant breadcrumb has no visual back affordance below hero scroll — deep-link users are stranded mid-page [P2] M
**What's wrong:** The breadcrumb (`Cities › New York › JoJo`) is positioned inside the hero section at the top of the restaurant detail page. Once a user scrolls past the hero (which happens quickly given the content density — visible in restaurant-mobile.png), the breadcrumb scrolls away with it and there is no sticky "back" affordance. No back button, no sticky breadcrumb, no secondary nav strip.
**Why it matters:** A user who deep-linked from social media and wants to browse other NYC restaurants must scroll all the way back to the top — past the Score, Dishes, TikTok videos, map, and related restaurants sections. On mobile the content is very long.
**What to do:** Either make the top header sticky (it already is, via `sticky top-0` on Navigation) and add a context strip below it that shows the breadcrumb on scroll, or add a compact floating back chip that appears after the hero scrolls out of viewport.
**Why you'd want to:** Keeps orientation and escape hatch available anywhere in a long detail page.
Cite: `restaurants/[id]/page.tsx` lines 310–325; restaurant-mobile.png.

---

## Quick wins (≤5)

1. **[NEW] P2 S — "Toggle menu" label is generic.** Change `aria-label` on the hamburger to `aria-label={mobileOpen ? 'Close menu' : 'Open menu'}` so the label matches current state. Navigation.tsx line 163.

2. **[RESOLVED, verify] "Sign in" consistency** — confirmed, both Navigation.tsx (line 147) and BottomNav.tsx (line 103) now say "Sign in" not "Log in". No action needed.

3. **[NEW] P2 S — Breadcrumb truncates restaurant name on very narrow screens.** `Breadcrumb.tsx` uses `truncate` on the last crumb (line 52) but the outer `ol` is `flex-wrap`. If the restaurant name is long (e.g. "Nobu Fifty Seven"), the last crumb truncates before "New York" has a chance to wrap to a second line. Consider setting `max-w-[12rem]` only on intermediate crumbs and letting the current-page crumb wrap freely. Cite: `Breadcrumb.tsx` lines 37–57.

4. **[NEW] P2 S — Mobile menu close button has no visible focus ring.** The X button inside the mobile menu panel (Navigation.tsx line 202–208) uses `hover:bg-gray-100` but no `focus-visible:outline`. If a keyboard user opens the menu and tabs to the close button, there is no ring. Add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2` to match the sign-in button at line 143.

5. **[RESOLVED] Active underline on desktop nav links** — confirmed shipped. The 2px accent underline renders on the active item (home-desktop.png nav bar). No action needed.

---

## Bigger bets

### A. Unified nav model: collapse desktop Profile into right-rail auth affordance only
The navItems array drives both the centered desktop nav and the mobile hamburger menu. Profile in navItems creates the duplication bug (Finding 1) and also means the mobile hamburger lists Profile as a full-height menu item AND the bottom of the drawer has a "My Profile" button. Refactoring navItems to remove Profile and restructure the mobile drawer to derive auth actions separately would clean up both surfaces and make future nav additions cleaner. Effort: M. Impact: eliminates Finding 1, reduces mobile drawer noise.

### B. Sticky breadcrumb strip on detail pages (desktop + mobile)
Rather than relying on the hero-only breadcrumb, render a slim (36px) secondary strip that sticks below the primary nav on restaurant and city detail pages. It could show `← New York` on mobile and the full `Cities › New York › JoJo` trail on desktop, appearing only after the hero scrolls out of view (IntersectionObserver). This is the standard pattern used by Yelp, Google Maps, and NYT Cooking for deep pages. Effort: M. Impact: resolves Finding 5 and is the right long-term answer for "where am I" at any scroll depth.
