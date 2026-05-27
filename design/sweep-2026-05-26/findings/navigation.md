# navigation

**Lens:** Can a user always answer "where am I and how do I get back?" — wayfinding, breadcrumbs, persistent nav, back behavior, and deep-link orientation.
**Reviewed:** `explore-desktop.png` screenshot + `Navigation.tsx`, `BackButton.tsx`, `BottomNav.tsx`, `layout.tsx`.

## Top 3 findings

1. [P0] **What's wrong:** The `/search` route has no entry point in the top nav. `Navigation.tsx` lists four items — Home, Explore, Community, Profile (lines 13–17) — and Search is absent. `BottomNav.tsx` mirrors the same four tabs (lines 22–26). A user who bookmarks or shares a `/search?city=Miami&...` URL arrives on a page with no nav item highlighted and no obvious way back to where search lives in the IA (information architecture — the conceptual map of the app's sections).
   **Why it matters:** Users deep-linked into search results cannot locate "Search" in the nav, making the feature feel orphaned and hard to re-find.
   **What to do:** Add a Search tab to both `Navigation.tsx` and `BottomNav.tsx`, or fold search into Explore with a persistent search bar, and ensure the active-state highlight follows the user there.
   **Why you'd want to do this:** Search is a primary acquisition flow for new users; hiding it behind discovery creates unnecessary friction and drops conversion from landing to first meaningful engagement.
   (effort: S)

2. [P1] **What's wrong:** `BackButton.tsx` uses `window.history.length > 1` to decide whether to call `router.back()` (line 48). This check is unreliable: every new tab starts with `history.length === 1` even if the user navigated there from a collection card — the browser counts entries from the tab's origin, not from the app's navigation. A user who opens a restaurant card in a new tab sees a "Back" arrow that falls through to the hardcoded `fallbackHref="/explore"` (restaurant page, line 305) regardless of their actual entry point.
   **Why it matters:** A user arriving from a City page or a shared collection is silently dropped at `/explore` instead of their actual context, breaking spatial memory (the mental model of "where I was").
   **What to do:** Replace `history.length > 1` with a `document.referrer` check (same origin), or pass the referring route via a URL query param (e.g. `?from=/cities/nyc`) set by every link that navigates to a restaurant detail page, and use that as the fallback.
   **Why you'd want to do this:** Correct back behavior is the single highest-leverage trust signal in multi-step browsing; getting it wrong teaches users the app is disorienting.
   (effort: M)

3. [P1] **What's wrong:** The explore page shows a city selector ("New York" visible in the screenshot search bar area) but the active city is not reflected in the URL as a persistent, shareable parameter by default for the logged-in state — city defaults to `profile.home_city` server-side (`explore/page.tsx` lines 148–170) rather than being written into the URL. A user who shares the `/explore` URL with a friend gets the friend's home city, not New York.
   **Why it matters:** Users cannot share their current view; the "where am I" answer changes per recipient, which breaks the social and referral loop the app is built around.
   **What to do:** Always serialize the active city into the URL (`/explore?city=New+York`) when the city selector changes, and treat the URL param as the canonical source of truth over `home_city`.
   **Why you'd want to do this:** Deep-linkable city views unlock word-of-mouth sharing, which is a free acquisition channel for a discovery-first product.
   (effort: M)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** The active nav underline (the thin accent-colored line under the current section label) is a single pixel tall (`h-px`, `Navigation.tsx` line 96). At 1440px width it is nearly invisible against white, especially under small-caps text.
   **Why it matters:** Users glancing at the nav cannot confirm which section they are in at a glance — the primary wayfinding signal is imperceptible.
   **What to do:** Increase to `h-0.5` (2px) or add a subtle background tint (`rgba(accent, 0.08)`) behind the active label to make the active state unmissable.
   **Why you'd want to do this:** A legible active state is the cheapest possible fix that directly answers "where am I" — no layout changes required.
   (effort: S)

2. **What's wrong:** The mobile `BottomNav` (`BottomNav.tsx`) is rendered on every page including the restaurant detail page, which already has a `BackButton` in the hero. There is no "back" affordance in `BottomNav` — a user on mobile who taps into a restaurant from a collection has only the hero back button, which is buried under the image and not reachable without scrolling to the top.
   **Why it matters:** Mobile users deep inside a restaurant page lose their escape route once they scroll past the hero.
   **What to do:** On routes matching `/restaurants/[id]`, suppress `BottomNav` or inject a sticky "Back" chip at the bottom of the viewport that mirrors the `BackButton` fallback destination.
   **Why you'd want to do this:** Reduces scroll-to-top friction on the highest-engagement page in the app.
   (effort: S)

3. **What's wrong:** The header logo (`Navigation.tsx` line 60) links to `/` but carries no visible text or tooltip identifying it as "Home." The `aria-label="Gastronome"` names the brand, not the destination.
   **Why it matters:** First-time users do not know the logo is a home link; non-designer usability test participants regularly miss logo-as-home on unfamiliar brands.
   **What to do:** Change `aria-label` to `"Gastronome — Home"` (one word fix) so screen-reader users and keyboard navigators get the destination, not just the brand name.
   **Why you'd want to do this:** Zero visual change; pure accessibility and discoverability win in under 30 seconds of work.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** There are no breadcrumbs (a secondary navigation trail showing the path taken, e.g. "Explore > Michelin Stars > JoJo") anywhere in the app. The restaurant detail page has only a `BackButton` whose label is the generic word "Back" (restaurant page, line 310), giving no indication of what section the user is returning to.
**Why it matters:** Users who navigate Home → Explore → Category → Restaurant → back have no persistent trail showing where they are in the hierarchy; the app feels flat rather than structured, and re-entry after any interruption requires retracing steps manually.
**What to do:** Implement a lightweight breadcrumb component rendered below the top nav on Explore sub-pages and on restaurant detail pages. Derive the trail from the URL params already available (`?from=`, `?city=`, `?category=`). Replace the generic "Back" label in `BackButton` with the resolved section name (e.g. "Back to Michelin Stars").
**Why you'd want to do this:** Breadcrumbs reduce navigational abandonment on deep pages and are especially valuable for users arriving via external links who have no history to pop.
**The tradeoff:** Requires passing context through URLs or a lightweight navigation context/store; adds visual complexity to the hero area of the restaurant detail page, which is currently clean and image-forward.
(effort: L)
