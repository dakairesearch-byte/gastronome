# IA Findings — v3 Re-Sweep (2026-05-31)

Lens: content organisation, mental models, the city → neighborhood →
restaurant → dish → source hierarchy, where structure fights the user.

---

## Status on v2 IA Findings

- **Cities in nav** [RESOLVED] — Cities now appears in top nav (Navigation.tsx:18) and is underlined as active on the cities page. screenshot: cities-desktop.png.
- **Home city-aware** [RESOLVED] — resolveHomeCity() reads profiles.home_city for logged-in users; fallback to New York with a visible "set your home city" nudge (page.tsx:178–197). screenshot: home-desktop.png.
- **Breadcrumbs added** [RESOLVED] — Cities > City > Restaurant trail on restaurant detail (restaurants/[id]/page.tsx:315–325) and Cities > City on city pages (cities/[slug]/page.tsx:175–181). Breadcrumb component is accessible (aria-current, aria-label). Correct.
- **"Saved Collections" renamed** [RESOLVED] — now "Editorial Picks" on home (page.tsx:228) and "Categories" on Explore. The bookmark icon on editorial tiles was removed. Correct.
- **Empty home rails** [RESOLVED] — RecentSearches and FavoritesSection self-suppress when empty (page.tsx:204–221). screenshot: home-desktop.png shows graceful empty state with correct microcopy.

---

## Top 5 Findings

### 1 [NEW] Explore and Cities are parallel paths to identical content with no cross-linking — users can't tell them apart [P1, M]

**What's wrong.** The nav shows "Explore" and "Cities" as sibling items. Explore defaults to the user's city and shows a "Top 10 Trending" list + category tiles. A city page (/cities/new-york) also shows a trending section and a filterable restaurant grid for that city. The two surfaces overlap almost completely for same-city use. There is no link from Explore → Cities or Cities → Explore; a user who lands on Explore has no affordance to switch to city-grid browse, and vice versa.

**Why it matters.** Duplicate surfaces without a clear mental model split "discovery by mood" vs "browse the full city roster" into two unnamed things. Users who arrive at the wrong surface give up rather than hunt for the other one. The hierarchy implies Cities is a sub-mode of Explore, but structurally they're siblings.

**What to do.** Add a one-sentence purpose label beneath each nav item on the Cities index page and the Explore landing ("Browse restaurants by city" vs "Curated collections & trending"), and add a contextual "See all New York restaurants →" link from the Explore city header to /cities/new-york. No route change needed.

**Why you'd want to.** Removes the "wait, which one do I use?" question that kills sessions before a restaurant is clicked.

Screenshot: explore-desktop.png (top bar city picker), cities-desktop.png (city list).
Source: src/app/explore/page.tsx:90, src/app/cities/page.tsx:1.

---

### 2 [STILL-OPEN] Neighborhood is in the data but not browsable — the city → neighborhood level of the hierarchy is a dead end [P1, L]

**What's wrong.** The restaurant row carries a neighborhood field (referenced at cities/[slug]/page.tsx line 333 in the breadcrumb share text). The city grid shows a small neighborhood label on each card (CityRestaurantGrid.tsx:71: `r.neighborhood ? ` • ${r.neighborhood}` : ''`). There is no filter chip, no grouping, and no browse route for neighborhoods. Clicking a neighborhood label does nothing. The v2 synthesis flagged this as a bigger-bet ("Neighborhood as a first-class browse axis" — SYNTHESIS.md:242); it remains completely unaddressed.

**Why it matters.** The app's stated hierarchy is city → neighborhood → restaurant. Users who think "I want something in the West Village" cannot express that intent anywhere. The data exists but the browse path doesn't, so the second level of the hierarchy is a lie.

**What to do.** Add neighborhood filter chips to the city page filter bar (alongside the existing cuisine and accolade chips). No new data ingestion required — the field is already populated and rendered.

**Why you'd want to.** Unlocks the most common local intent ("somewhere near me / in my neighborhood") with no backend work.

Screenshot: cities-desktop.png (filter bar has Cuisine and Accolade chips only, no neighborhood).
Source: src/app/cities/[slug]/page.tsx:221–243 (filter bar, no neighborhood).

---

### 3 [NEW] Profile page is a hard wall for anonymous visitors — one sentence with no sign-in CTA [P1, S]

**What's wrong.** Unauthenticated users who click "Profile" in the nav land on a page with only the sentence "You need to be signed in to see your profile." (profile/page.tsx:112). There is no sign-in button, no sign-up prompt, and no redirection. The v2 synthesis listed "Add an inline Sign in button" (SYNTHESIS.md:222) as a quick win. The fix was not shipped.

**Why it matters.** Profile is the fifth nav item and the primary identity anchor. A dead-end sentence that expects the user to find the Sign In button themselves (top right corner, small) is friction that turns a conversion opportunity into a bounce. The empty profile page screenshot (profile-desktop.png) shows the full-bleed blank state with footer below, which looks broken.

**What to do.** Replace the bare sentence with a centered sign-in card: the sentence, a "Sign in" button (triggers the existing openSignInModal), and a "Sign up free" secondary link. Four lines of JSX.

**Why you'd want to.** Every anonymous user who clicks Profile is expressing intent to engage. Converting that to a sign-in tap is the cheapest user acquisition funnel in the app.

Screenshot: profile-desktop.png.
Source: src/app/profile/page.tsx:102–116.

---

### 4 [NEW] "Recent searches" section header renders on home even when empty — structural false promise [P1, S]

**What's wrong.** The home page always renders the two-column grid with "Recent searches" and "Your favorites" headers (page.tsx:211–221). The self-suppressing components (RecentSearches, FavoritesSection) hide their inner content when empty — but the SectionHeader titles above them are always rendered by the parent, so anonymous users and new signed-in users see two floating orphan headings above empty space. The comments in page.tsx:204–210 say "each component returns null when there's nothing to show," but the SectionHeader is outside the component.

**Why it matters.** Two section headers with nothing below them break the page's visual rhythm and signal an empty/broken product to first-time users.

**What to do.** Move the SectionHeader render inside each component (RecentSearches and FavoritesSection), or wrap each grid cell in a conditional that checks whether the child returned anything. The self-suppression logic is already almost correct — it just stops one layer too low.

**Why you'd want to.** Removes the empty-header anti-pattern that v2 originally flagged and the comments claim is fixed but isn't.

Screenshot: home-desktop.png (two floating "Recent searches" / "Your favorites" headers above empty space).
Source: src/app/page.tsx:211–221.

---

### 5 [NEW] Explore city defaults to New York for anonymous users without any city label or "change city" affordance in the hero [P2, S]

**What's wrong.** Explore uses the same four-step resolution as Home (URL param > profile.home_city > first city in DB > DEFAULT_CITY "New York"), but unlike Home it does not display which city is active in the hero nor show a "Showing New York by default — set your home city" fallback notice. The city picker dropdown is in the ExploreSearchBar at the top, but it shows as a compact "city: New York" chip that is easy to miss. An anonymous user from Chicago lands on Explore and sees New York trending restaurants with no explanation.

**Why it matters.** The Home page correctly solved this with an explicit fallback notice (page.tsx:178–197). Explore is the app's primary discovery surface and the same problem exists there unaddressed — a silent city mismatch corrodes trust in the content.

**What to do.** When citySource is 'fallback' (no URL param, no profile city), display the same one-line notice used on Home: "Showing New York by default — set your home city to personalize." Reuse the exact pattern already written.

**Why you'd want to.** Consistency: Home tells you which city you're seeing and why; Explore should too.

Screenshot: explore-desktop.png (city chip in search bar visible but no fallback explanation).
Source: src/app/explore/page.tsx:140–175 (resolution chain, no fallback notice emitted).

---

## Quick Wins (≤5)

1. **Add inline Sign In button to the profile unauthenticated wall** (profile/page.tsx:112). Four lines. [Finding 3 above, P1, S]

2. **Fix the "Recent searches" / "Your favorites" orphan headers on Home.** Either move SectionHeader inside each component, or null-guard the outer wrapper. Two small edits. [Finding 4 above, P1, S]

3. **Add a "See all [City] restaurants →" link from Explore city heading to /cities/[slug].** One link, surfaces the Cities surface to users who arrived via Explore. [Finding 1 partial, P1, S]

4. **Add fallback city notice to Explore** matching the Home pattern (page.tsx:178–197). Copy-paste adaptation, ~8 lines. [Finding 5, P2, S]

5. **Show the restaurant's neighborhood as a tappable filter chip in the city page.** The neighborhood string is already rendered in CityRestaurantGrid.tsx:71 — add a filter predicate matching the existing cuisine/accolade chip pattern. [Finding 2 partial, P1, M]

---

## Bigger Bets

**1. Neighborhoods as a first-class browse level.**
Add /cities/[slug]/neighborhoods/[neighborhood] routes (or filter params) so the full city → neighborhood → restaurant hierarchy is navigable. Requires grouping the city grid by neighborhood and computing neighborhood-level trending scores. v2 flagged this; it remains the one structural hole in the hierarchy that no v2 fix addressed. Effort: L.

**2. Merge or differentiate Explore and Cities with an explicit information architecture decision.**
Decide: Explore = "I want curation/mood" (editorial collections, trending lists) and Cities = "I want to browse/filter" (full roster by neighborhood, cuisine, accolade). Then make that visible: different hero copy, different entry-point microcopy in the nav, and a clear handoff link between them. Right now they are two tabs with overlapping purpose and no map between them. Effort: M (mostly copywriting and cross-links; route structure is already correct).

---

## Alarming

None at P0. The three critical IA failures from v2 (Cities buried in footer, home hardcoded to New York, no breadcrumbs) are all confirmed resolved. What remains is structural polish and the neighborhood layer — real but not ship-blocking.
