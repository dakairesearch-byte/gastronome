# Navigation — Findings
_Sweep v2 · 2026-05-26 · Lens: wayfinding, breadcrumbs, back behavior, deep linking_

---

## Top 5 Findings

**1. No breadcrumb on restaurant detail — back button is the only thread back**
Where: `restaurant-desktop.png` (hero area, top-left); `BackButton.tsx:34–66`
The restaurant page relies entirely on a history-aware `BackButton`. A user who deep-links to `/restaurants/[id]` (shared URL, email, social) sees `fallbackHref="/explore"` which drops them in Explore with no city context, no path showing where this restaurant sits in the hierarchy. There is no "Home > NYC > JoJo" breadcrumb.
Fix: Add a contextual breadcrumb using restaurant `city` field: `Cities > New York > JoJo` as a static trail supplementing the back button.

**2. Cities and Recent are invisible in the top nav — users cannot discover them**
Where: `Navigation.tsx:12–17`; `home-desktop.png` (nav bar)
`navItems` contains only `Home / Explore / Community / Profile`. `/cities` and `/recent` are entirely absent from the primary nav, both desktop and mobile. A user on any screen has no one-click path to either. The only way in is via footer links or knowing the URL.
Fix: Either add Cities as a fifth nav item, or nest it under Explore with a clear label. Recent should appear in the nav or be discoverable from Home with a persistent entry point.

**3. Mobile bottom nav omits Cities and Recent — same blind spot, worse on small screens**
Where: `BottomNav.tsx:22–26`; `home-mobile.png` (bottom chrome)
Bottom nav is `Home / Explore / Community / Sign in`. Cities and Recent are not reachable from mobile nav at all. Footer is typically below the fold and below the bottom-nav safe area. On mobile, these two sections are effectively hidden features.
Fix: If Cities cannot fit in the 4-tab bottom nav, add it as a secondary row or fold it into Explore's landing page with a prominent chip.

**4. City page back link is a hardcoded `<Link href="/cities">` — breaks from search or city card on home**
Where: `cities/[slug]/page.tsx:171–177`
The "All cities" back link in the city header is a plain `<Link href="/cities">`, not a `BackButton`. A user who navigated from a home-page suggestion card into `/cities/new-york` and presses it lands on the all-cities index, not back on Home. It also skips any filter state they had active.
Fix: Replace with `<BackButton fallbackHref="/cities">` matching the pattern used on restaurant pages.

**5. Active state on desktop nav uses only a 1 px underline — visibility is extremely low**
Where: `Navigation.tsx:94–99`; `home-desktop.png` (nav bar)
The active indicator is a single 1 px `var(--color-accent)` line below the label, rendered at `text-xs uppercase` with `letter-spacing: 0.16em`. At the nav's height (h-28) the indicator is 7 px below the baseline and hard to see at a glance. There is no background fill, color change, or weight difference strong enough to make "where am I?" immediately obvious.
Fix: Increase active indicator to 2 px, add a subtle background tint, or increase font weight to 600 on active items to create clear visual contrast.

---

## 5 Quick Wins

**QW1. Add `aria-current="page"` to active nav links**
`Navigation.tsx:76–102` — active detection exists but the attribute is never set. Screen readers cannot announce current location.

**QW2. Mobile menu header reads "Menu" — should read the current section name**
`Navigation.tsx:174–179` — the slide-in panel title is the generic word "Menu" regardless of context. Replace with the active page label so users know where they are before choosing.

**QW3. City page filter bar `sticky top-14` conflicts with `Navigation` `sticky top-0 h-28`**
`cities/[slug]/page.tsx:212` — `top-14` = 56 px, but the nav header is `h-28` = 112 px. Sticky filters slide behind the nav on scroll.

**QW4. `window.history.length > 1` check in BackButton is unreliable across session restores**
`BackButton.tsx:48` — browsers restore sessions with `history.length > 1` even when there is no in-app back entry. This can fire `router.back()` and exit the app unexpectedly. Use a session-scoped navigation counter instead.

**QW5. Footer links for Cities/Recent exist but have no visual emphasis distinguishing them from legal copy**
`home-desktop.png` (footer) — Cities and Recent appear in the footer "Explore" column, but in small grey text indistinguishable from policy links. Promoting them to a distinct "Browse" card in the footer would help discoverability without touching nav.

---

## 2 Bigger Bets

**BB1. Introduce a unified context breadcrumb component used by restaurant, city, and search-result pages**
Currently each page invents its own back affordance (BackButton, hardcoded Link, or nothing). A shared `<Breadcrumb>` component driven by route segments and optional query params (`?from=cities`) would give every deep page a consistent, scannable trail: users could always see and click the full path they took. This is the single change most likely to reduce "how do I get back?" confusion.

**BB2. Redesign mobile nav around 5 destinations: Home / Explore / Cities / Community / Profile**
Cities is a first-class content pillar (by-city browsing is a primary use case). Squeezing it out of all nav surfaces makes the app feel smaller than it is. A 5-tab bottom nav with smaller icons and labels (or a "More" overflow sheet) would surface Cities and allow Recent to live within Cities' tab rather than being lost entirely.

---

## Alarming

**The desktop nav active state has no accessible visual indicator beyond color alone.** The 1 px accent underline is the only signal, and it relies on `var(--color-accent)` contrast against white — no shape, no weight, no background. On the restaurant detail page, no nav item is active at all (none of `Home / Explore / Community / Profile` corresponds to `/restaurants/[id]`), so users lose even the underline cue. Any user on a restaurant page cannot tell from the nav where they are in the site. Combined with the missing breadcrumb (Finding 1), this is a complete loss of location signal.
