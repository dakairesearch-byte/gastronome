# UI/UX Sweep v3 — Synthesis (delta since v2)

## TL;DR

The fix session was a genuine success: the v2 five-alarm fire (the raw Google Maps error on restaurant pages), the missing unified score, the empty-dish blank middle, the 126,000px NYC mobile page, the broken onboarding logo, the invisible gold-on-gold focus ring, and roughly 30 other v2 findings are all verified fixed — the product no longer looks broken on its flagship page. The single most important problem now is a **regression-by-omission**: the exact same Google Maps API error the team fixed on the restaurant page is **still live on the Explore "Top 10 Trending" map panel**, because the one-line fix was applied to the detail page but never propagated to the `Top10Trending` component — three specialists independently re-flagged it. The highest-value next action is the five-minute fix to that Explore map (delete one fallback env-var clause), which kills the last visible "broken product" surface in the app.

## Scorecard vs v2

| Bucket | Count | Headlines |
|---|---|---|
| **v2 findings now RESOLVED (verified)** | ~32 | Google Maps error on restaurant page; unified Gastronome Score + methodology popover in hero; dishes/menus load with graceful "Menu coming soon"; NYC mobile page 126,000px → ~9,000px via infinite scroll; "What Reviewers Mention" → "Signature Dishes"; Cities in top nav; Search in mobile bottom nav; breadcrumbs on restaurant + city; Save button on both card variants; 80×80 compact-card thumbnail + price chip; mobile header h-28 → h-16; home city-aware ("Suggestions in {city}"); search quality-sorted + result count + SSR shell; broken JBF "Nominee" filter removed from UI; onboarding sign-in escape + city no-hard-block + logo fixed + `is_critic` hardcode removed; focus ring gold→slate; sign-in modal focus trap; prefers-reduced-motion; skip link; aria-current on nav; mixed-denominator source badges; accolade year suffixes; "Sign in"/"Log in" consistency; bookmark Supabase write-through; hero photo opacity 30%→55%; Spectral italic + weight cleanup; secondary-text contrast bumped. |
| **STILL-OPEN (v2 not yet addressed)** | ~22 | Hours / "Open now" / reservations on restaurant page; no editorial "Critic's Note" or `/methodology` page; city page is still a 600-row database export with no "Editor's 10"; CityRestaurantGrid never received the card improvements; neighborhood browse axis; unauth profile dead-end; JBF "nominee" still accepted via URL → silently returns winners; trending score value still never shown; dish chips still tooltip-only with no price/photo/dietary tag; emerald palette still bypasses the design system. |
| **REGRESSIONS** | 6 (1 critical) | **Google Maps error now on Explore Top 10** (critical); home "Recent searches"/"Your favorites" orphan headers render above empty space (comments claim fixed, aren't); CityRestaurantGrid leaves the highest-volume browse surface with no Save action; search SSR shell introduced new layout-shift (CLS) on hydration; static map tile is inert (error removed but no real map restored); nav "Sign in" button's partial focus-ring override may render the wrong color. |
| **NEW** | ~30 | Gastronome Score is named for the product but driven only by Google + Yelp (its two weakest sources); score has no review-count anchor or recency date; "Similar Restaurants" shows fabricated/mis-attributed peers ("Le Restaurant — 3 Michelin stars"); `isStockFallbackPhoto` shipped but is dead code (stock photos pass as real); `michelin_year`/`jbf_year`/`eater_year` are unguarded type casts that may silently blank; Profile appears twice in desktop nav; mobile nav drawer still has no focus trap; 9px dish-count text; Recent page may be a ~9,000px unpaginated list; no anonymous browse path; collections popover opens off-screen / clipped on mobile cards. |

Net: the fix session closed the worst of v2, but two patterns recurred — **fixes that landed on one surface but not its twin** (maps, cards, score), and **fixes that shipped as code but were never wired up** (`isStockFallbackPhoto`, the parent-level orphan headers).

## Regressions — fix first

THIS SECTION IS TOP PRIORITY. These are things the fix session broke, or fixed in one place and missed in another.

### R1. The Google Maps API error is STILL live on the Explore "Top 10 Trending" map panel [P0, effort: 5 min]
- **Plain English:** The team fixed the raw "Google Maps Platform rejected your request — this API is not activated" error on the restaurant detail page. But the Explore page has its *own* map (the panel beside the Top 10 list), and it was never fixed. It still shows the same red Google error text — now with the polished numbered pins floating on top of it, which arguably looks *worse* than the unlabeled dots it replaced. This is the **same failure class as v2's #1 P0** — a regression-by-omission: the restaurant-page fix didn't propagate to the `Top10Trending` component.
- **Why it's the same bug:** `Top10Trending.tsx` (lines ~540–545) falls back to `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` when no dedicated Maps Embed key is set. The Places key is present but almost never has the Maps *Embed* API enabled, so the embed renders the rejection page. The graceful SVG-grid fallback only fires when the key is null — and the key isn't null, it's just the wrong key.
- **Fix:** Delete the `|| process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` clause on the embed-key line in `Top10Trending.tsx` (mirror the single-key guard the restaurant page now uses). The SVG-grid fallback already exists and looks fine. One line.
- **Raised by:** discovery, ranking-visualization, error-states (and it is the same surface source-attribution flagged in v2). All three call it their most alarming finding.

### R2. Home "Recent searches" / "Your favorites" section headers render above empty space [P1, effort: XS]
- **Plain English:** On a fresh/anonymous home page, two big section headings ("Recent searches", "Your favorites") float above blank space. The child components were fixed in v2 to hide themselves when empty — but the *headings* sit one layer up in the parent (`page.tsx:211–221`) and still render unconditionally. The code comments claim this is fixed; it isn't. The page looks half-built at first impression.
- **Fix:** Move each `<SectionHeader>` *inside* its component (RecentSearches, FavoritesSection) so it disappears with the empty content, or null-guard the outer wrapper. Two small edits.
- **Raised by:** discovery (tagged REGRESSION), information-architecture.

### R3. CityRestaurantGrid leaves the highest-volume browse surface with no Save, no price, no photo [P0 for Save, effort: M]
- **Plain English:** The cities/[city] page (the most-trafficked browse path) renders through a *separate, bespoke* component, `CityRestaurantGrid`, not the shared `RestaurantCard`. Every v2 card win — the 80×80 thumbnail, the price chip, the Save button, the source ratings — is **absent** there. So a user browsing all of NYC sees an info-sparse, photo-free, un-saveable list, while the same restaurant on Explore shows the full improved card. The Save gap is the sharpest: users on the primary browse surface literally cannot bookmark without tapping into each detail page.
- **Fix:** Swap `CityRestaurantGrid`'s inline rows to render `<RestaurantCard variant="compact" />`. If the full swap is too big this cycle, the minimum is wiring a `BookmarkButton` into each row.
- **Raised by:** restaurant-card (calls it a "P0 regression in saving-lists UX"), ranking-visualization, food-photography, typography, color-visual-identity, navigation.

### R4. Search SSR shell introduced layout-shift (CLS) on every cold load [P1, effort: S]
- **Plain English:** The v2 fix that replaced the blank search page with a server-rendered shell used different padding and a different heading size than the real page, and renders no sidebar placeholder. So when the JavaScript loads, the heading visibly jumps in size, the left edge shifts inward, and a ~256px sidebar snaps in and shoves the content right. The fix solved the blank-page problem but created a visible "jump."
- **Fix:** Make the shell's padding and heading classes match the live `SearchContent` exactly, and add a static sidebar-width placeholder div so the column doesn't reflow. `search/page.tsx` (shell ~870 vs content ~515).
- **Raised by:** loading-states.

### R5. Static map tile is inert — the error is gone but no real map came back [P1, effort: M]
- **Plain English:** The restaurant page no longer shows the Maps error — good — but the replacement is a flat gray box with a pin emoji and a neighborhood name. It carries zero geographic information (no streets, no landmarks, no scale), so first-time visitors to an unfamiliar neighborhood get nothing to orient by. This is the intended fallback, not strictly a regression, but it removed the error without restoring map context.
- **Fix:** Use Google Static Maps (`maps.googleapis.com/maps/api/staticmap`), which works with the *existing* `GOOGLE_PLACES_API_KEY` and does **not** require the Maps Embed API — so it sidesteps the whole R1 key problem. Alternatively a free keyless OpenStreetMap static tile. One `<img>` tag plus server-side URL construction.
- **Raised by:** restaurant-detail (tagged REGRESSION), map-location-ux.

### R6. Nav "Sign in" button's focus ring may render the wrong color [P2, effort: XS]
- **Plain English:** The v2 fix set a consistent slate focus ring globally. But the desktop "Sign in" button re-declares its own focus outline inline without specifying the slate color, so it can fall back to the browser-default ring color — breaking the consistency the v2 fix established.
- **Fix:** Delete the partial Tailwind focus-outline override on the Sign in button (`Navigation.tsx:143`); the global `:focus-visible` rule already handles it correctly. One-line deletion.
- **Raised by:** accessibility (tagged REGRESSION).

## Critical Issues (P0) — still open or new

Deduped. (R1 and R3 above are also P0 but are listed under Regressions because that's their nature.)

### P0-1. Unauthenticated Profile page is a bare-sentence dead end [STILL-OPEN, effort: XS]
- **Description:** Clicking "Profile" while logged out lands on one centered sentence — "You need to be signed in to see your profile." — with no Sign In button, no sign-up link, no icon, in ~70vh of whitespace. On mobile it's a near-blank white screen with one line of text. This was a v2 quick win that was never shipped. Every anonymous Profile click is a user expressing intent to engage, converted into a bounce.
- **Fix:** Replace the bare `<p>` with the existing shared `<EmptyState>` component: `UserCircle` icon, "Sign in to see your profile", a "Sign in" button wired to the existing `openSignInModal`, and a "Sign up free" secondary link. Four lines of JSX.
- **Raised by:** information-architecture, empty-states (calls it "the single worst dead-end in the app"), saving-lists.

### P0-2. `isStockFallbackPhoto` shipped as code but is never called — stock photos pass as real photos everywhere [NEW, effort: S]
- **Description:** The v2 headline photography fix added a helper to detect when an image is a generic Unsplash stock shot (a plate of pasta that has nothing to do with the actual restaurant). The helper is correct — but **no component imports or calls it**. It is dead code. So across cards, favorites, suggestions, and detail pages, users see arbitrary stock food photos with zero disclosure, on a product whose entire pitch is authentic restaurant intelligence.
- **Fix:** Call the helper in the card's hero variant: when `isStockFallbackPhoto(photo)` is true, show a small semi-transparent "Stock photo" pill (or a subtle border). The helper logic is already written.
- **Raised by:** food-photography (explicitly upgrades this to "P0 trust issue, not cosmetic").

### P0-3. The Gastronome Score is named for the product but driven only by Google + Yelp — its two weakest sources [NEW, effort: M]
- **Description:** JoJo (1 Michelin star) shows "8.1 / 10 · 2 sources." That 8.1 is just Google 4.3 and Yelp 3.7 blended; the credible editorial sources (Infatuation, Michelin) are absent from the number, yet it reads as a verdict. The score the whole product is built around currently collapses to consumer-crowd noise on a starred restaurant, and the methodology popover says "every rating source we have" when only 2 of 4 fed this one. The popover also never reveals the actual weights, so "credibility-weighted" is an unverifiable claim. (The team and the-chef both note Yelp skews harsh on fine dining, dragging starred rooms down unfairly.)
- **Fix (layered, all small):** (a) surface source identity inline on the hero ("8.1 · from Google + Yelp"); (b) add an honest coverage count ("2 of 4 sources rated this"); (c) add the aggregate review-count anchor ("based on 4,300+ reviews") so a thin-sample score doesn't look shakier than it is; (d) append the weight percentages as a footnote in the popover; (e) add an "as of {month}" recency line. The bigger editorial question (down-weight Yelp when Michelin/JBF present) is a Bigger Bet below.
- **Raised by:** the-critic, the-diner, the-chef, source-attribution.

### P0-4. "Similar Restaurants" shows fabricated / mis-attributed peer restaurants [NEW, effort: M]
- **Description:** JoJo's "Similar Restaurants" sidebar lists "Le Restaurant" (shown with **3 Michelin stars**) and "Maison Close" — these are not real NYC restaurants and read as placeholder seed data. Putting invented peers, with invented accolades, next to a real Michelin house is a reputational and possibly legal risk and directly violates the house rule "never invent accolades." It damages every real restaurant by association.
- **Fix:** Audit the related-restaurant source data and remove/replace any seed or fabricated rows; sanity-check accolade↔price coherence (a "$$" spot showing "3 Michelin Stars" is the tell). Confirm the similar-set is driven by real `restaurants` rows only.
- **Raised by:** the-chef (flags it as the genuinely alarming item this sweep).

### P0-5. Mobile nav drawer still has no focus trap [STILL-OPEN, effort: S]
- **Description:** The hamburger drawer is correctly marked `role="dialog" aria-modal="true"`, but unlike the sign-in modal (which got a focus trap in v2), the drawer has no trap. A keyboard or switch-access user pressing Tab cycles straight out of the open drawer into the blurred page behind it; the close button becomes unreachable. WCAG 2.1.2 / 2.4.3 failure on a primary navigation surface.
- **Fix:** Copy the `trapFocus` pattern from `SignInModal.tsx` verbatim into `Navigation.tsx`, wired to a `keydown` listener active while `mobileOpen` is true (~15 lines). Also add `aria-expanded={mobileOpen}` + `aria-controls` to the hamburger button.
- **Raised by:** accessibility, navigation.

## High-Impact (P1)

Deduped, capped at 12.

1. **Add hours / "Open now" + a reservation CTA to the restaurant page.** [STILL-OPEN] The page still can't answer the two questions that actually decide tonight — *are they open?* and *can I get a table?* A Resy/OpenTable deep-link button costs one line and no API key. Until then, Gastronome loses the last mile to Google Maps/OpenTable. *Effort: M. Raised by: the-diner, the-chef, restaurant-detail, map-location-ux.*

2. **Bring the Gastronome Score (and source attribution) to the list/card surfaces.** [STILL-OPEN] The unified score exists only after you click into a restaurant; every card and grid still shows a raw, unlabeled Google or Yelp number. The aggregator promise is invisible at the discovery layer where shortlists are formed. Add a small "GS 8.1" pill to cards. *Effort: M. Raised by: ranking-visualization, restaurant-card, source-attribution.*

3. **Surface the trending score (or a "why this rank?" breakdown) on Top 10 rows.** [STILL-OPEN] Counts now show ("12 videos · 30d") but the relative score that actually orders the list is never shown, so "why is #3 above #4?" still has no answer. The data is already in memory. *Effort: S. Raised by: ranking-visualization.*

4. **Add an editorial layer to city pages — "The Critics' 10" rail above the 600-row grid.** [STILL-OPEN] Opening with everything signals "list," not "guide"; Eater opens NYC with a 38. Push the full grid below a curated rail. *Effort: L. Raised by: the-critic, information-architecture, discovery.*

5. **Make neighborhood a browsable filter on city pages.** [STILL-OPEN] The data is already stored and rendered on each card, but clicking a neighborhood does nothing — the city→neighborhood level of the hierarchy is a dead end. Add neighborhood filter chips matching the existing cuisine/accolade chip pattern; no backend work. *Effort: M. Raised by: information-architecture, discovery.*

6. **Confirm `michelin_year` / `jbf_year` / `eater_year` are real DB columns, not silent type casts.** [NEW] These are accessed via TypeScript casts with no runtime guard; if the columns don't exist, every accolade year silently blanks and no test or compile error catches it — meaning the v2 "show the year" fix may be cosmetic only. Verify in `database.ts`/migrations; add the column or remove the cast. *Effort: S to verify. Raised by: source-attribution.*

7. **Differentiate Explore vs Cities (they're parallel paths to near-identical content).** [NEW] Two sibling nav items overlap almost completely for same-city use, with no cross-link. Add one-line purpose labels and a "See all {City} restaurants →" link from Explore to the city page. *Effort: M (mostly copy + cross-links). Raised by: information-architecture.*

8. **Make dish-level evidence visible — inline source attribution, the sample quote, and "mentions" units.** [STILL-OPEN] Dish chips carry only tiny icon glyphs and a bare number; the one real critic sentence per dish (`sample_quote`) is hidden in a hover-only `title` attribute, invisible on mobile. Render the top dish's quote inline and add the word "mentions." *Effort: S. Raised by: dish-level-ux, restaurant-detail, the-chef.*

9. **Show review counts beside each source in "By the Numbers."** [STILL-OPEN] Google 4.3 and Yelp 3.7 sit at equal weight with no sample size, so a 3.7 from a few harsh reviews reads as gospel and undersells a starred room. Pair each source with its count. *Effort: S. Raised by: the-chef, restaurant-detail, the-diner.*

10. **Replace the off-brand emerald city-page hero with the slate/photo brand treatment.** [STILL-OPEN] The full-bleed `emerald→teal` gradient header on every city page is the largest single color surface in the product and reads "delivery app circa 2021," clashing with the cream/gold/slate identity. *Effort: S. Raised by: color-visual-identity, typography.*

11. **Audit the Recent page for an unpaginated server-rendered list (~9,000px).** [NEW] The recent-mobile screenshot renders what looks like 200+ rows in one flat pass — the same class of bug as the v2 NYC page, which got infinite scroll but Recent may not have. *Effort: M to fix once confirmed. Raised by: mobile-responsive, discovery.*

12. **Fix the collections popover opening off-screen / clipped on mobile cards.** [NEW] The "Save to collection" popover is `w-72` (288px) anchored to the right edge of a small icon on a ~320px card inside an `overflow-hidden` container — it overflows the viewport and/or gets clipped, and has no max-height. Needs viewport-clamping or a mobile bottom-sheet variant; the card's `overflow-hidden` also needs a portal escape. *Effort: M. Raised by: restaurant-card, mobile-responsive.*

## Quick Wins (≤1hr each)

Flat list, capped at 18.

1. **Delete the Places-key fallback on the Explore map embed** (`Top10Trending.tsx` ~line 542) — the single highest-value one-liner in this whole sweep; kills R1. [error-states, ranking-visualization, discovery]
2. **Move the home "Recent searches"/"Your favorites" headers inside their components** so they vanish when empty (R2). [discovery, information-architecture]
3. **Swap the unauth Profile bare sentence for `<EmptyState>` + a Sign in button** (P0-1). [empty-states, information-architecture, saving-lists]
4. **Remove "Profile" from the desktop `navItems` array** — it appears twice (centered nav + right-rail auth button), firing `aria-current` twice and announcing the page twice to screen readers. [navigation]
5. **Wire `isStockFallbackPhoto` into the card hero variant** to show a "Stock photo" pill (P0-2). [food-photography]
6. **Raise the 9px dish-count badge text to ≥11px** (`page.tsx:648,665`) — currently below any legible floor. [typography]
7. **Fix "The Story" `fontWeight: 300` → 400** (`page.tsx:855`) — 300 is no longer loaded, so the browser fakes a thin weight. [typography]
8. **Give the city-page h1 Spectral + `font-bold` (700)** instead of `font-extrabold` (800) in DM Sans (`cities/[slug]/page.tsx:186`) — two hero headings currently use different typefaces. [typography]
9. **Add "mentions" after the dish count** — `{count} mention{s}` (`page.tsx:688`). [dish-level-ux]
10. **Append `/5` (and labels) to the hero card's raw Google/Yelp numerals** — they read as bare numbers with no scale. [source-attribution]
11. **Append weight percentages to the Gastronome Score popover** as a footnote row. [source-attribution]
12. **Add "Restored your last filters" signal / strip `jb=nominee` from the URL parse allowlist** so a shared link can't silently return winners labeled "nominee." [filtering, search]
13. **Add Escape-to-close to the search sidebar `MultiSelect`** — it only closes on click-outside, trapping keyboard users (mirror `FilterChips`). [filtering]
14. **Add `aria-pressed` to city/cuisine selection buttons + filter chips** — selected state is currently color-only and invisible to screen readers. [accessibility, filtering]
15. **Delete the partial focus-ring override on the desktop Sign in button** (R6, `Navigation.tsx:143`). [accessibility]
16. **Swap `bg-emerald-500`/`text-emerald-500` for token colors on `not-found.tsx` + `error.tsx`** — off-brand color at the worst possible moment, 4 lines. [color-visual-identity]
17. **Add a `loading.tsx` to the `/cities` route** — cold loads still paint blank until HTML is ready, two-line placeholder grid. [loading-states]
18. **Add `title={restaurant.name}` to the compact card's clamped h3** so truncated names aren't permanently hidden on mobile. [restaurant-card]

## Bigger Bets

Capped at 6.

1. **Editorial voice + `/methodology` page.** [STILL-OPEN] There is still zero point of view anywhere — every screen is a tasteful layout problem. Add a 50–150-word "Critic's Note" above "By the Numbers" for top restaurants, and a public `/methodology` page explaining both the score weights and the trending formula. *Who: the-critic, source-attribution. Tradeoff: editorial content needs ongoing maintenance and creates claim liability; publishing weights invites gaming and locks you into a versioned formula.*

2. **Per-source weighting for fine dining (+ make the Score defensible).** Let the Gastronome Score down-weight Yelp when Michelin/JBF are present and say so in the methodology — a flat Google+Yelp average misrepresents starred rooms, and the current 0.5-weight on consumer sources can rank a 1-star below a hyped neighborhood spot. *Who: the-chef, the-critic, source-attribution. Tradeoff: requires deciding and publicly defending the blend formula.*

3. **Booking + "Open now" layer / "Decide for me tonight" mode.** Resy/OpenTable/Google-hours integration converts Gastronome from a research tool into a decision tool — the gap that keeps diners on OpenTable. A one-tap "open-now + near-me + your saved cuisine" flow from home leans into the one thing Maps can't blend (critic accolades). *Who: the-diner, map-location-ux. Tradeoff: real-time availability needs reservation-API integration + geolocation; concentrates the brand on deciding-tonight at the cost of the browse/inspire use case.*

4. **One unified card component for every list surface.** There are now at least three diverging card implementations (`RestaurantCard` compact+hero, `CityRestaurantGrid` inline JSX, `FavoritesSection` inline). A single component with a `list-row` variant would mean every future fix — Save, price, score, photo — propagates everywhere at once, and would have prevented R3 entirely. *Who: restaurant-card, ranking-visualization. Tradeoff: a focused refactor with mostly latent payoff (no flashy demo).*

5. **Neighborhood as a first-class browse axis.** "Trending in the West Village" is a materially stronger discovery hook than "Trending in New York"; the lat/lng and neighborhood data already exist and are rendered, just not used as a browse dimension. *Who: discovery, information-architecture, map-location-ux. Tradeoff: neighborhood coverage is uneven across cities, so a half-populated layer looks broken without a per-city fallback.*

6. **Brand reconciliation pass: retire the ~99 raw `emerald-*` usages to design tokens.** The "Luxe Moderne" gold/slate system governs the nav and onboarding, but 99 emerald utilities across 15+ files (city hero, filter chips, card hover, the entire review-writing flow, the 404/error pages) keep the rendered product looking like a generic green Tailwind app. Batch as one PR; it's also the prerequisite for dark mode. *Who: color-visual-identity, typography. Tradeoff: ~3–4 hours of careful find-replace where Tailwind classes don't compose with CSS variables.*

## Confirmed resolved (don't regress these)

Grouped and deduped — these v2 issues were verified genuinely fixed, so protect them in future work.

- **Restaurant-page Google Maps error** — gone; static neighborhood tile + Get Directions / View on Maps now render cleanly (the-critic, restaurant-detail, map-location-ux, error-states). *Note: the Explore twin is NOT fixed — see R1.*
- **Unified Gastronome Score in the hero** — bold 0–10 number with methodology popover, replacing the sourceless "4.3 ★"; per-source receipts moved to "By the Numbers" (the-critic, restaurant-detail, source-attribution). *Note: weighting/coverage framing still open — see P0-3.*
- **Dishes/menus load + graceful empty state** — "Signature Dishes" renders; empty case shows "Menu coming soon" + a link to the restaurant site (dish-level-ux, the-chef, restaurant-detail, empty-states).
- **NYC mobile page** — 126,000px → ~9,000px via IntersectionObserver infinite scroll (PAGE_SIZE 24) (mobile-responsive).
- **"What Reviewers Mention" → "Signature Dishes"** with per-dish source/rating chips (the-critic, dish-level-ux).
- **Navigation structure** — Cities in top nav, Search in mobile bottom nav, breadcrumbs on restaurant + city pages, `aria-current` on active links, mobile drawer promoted to `role="dialog"`, mobile header h-28 → h-16 (information-architecture, navigation, mobile-responsive). *Note: drawer focus trap still missing — see P0-5.*
- **Cards** — 80×80 thumbnail + price chip + Save button (stretched-link, no nested-anchor violation) + sr-only accolade label on both variants (restaurant-card, food-photography, saving-lists). *Note: CityRestaurantGrid did not receive these — see R3.*
- **Home** — city-aware "Suggestions in {city}" with fallback notice, "Saved Collections" → "Editorial Picks", empty-rail copy rewritten as active invitations (information-architecture, microcopy, discovery). *Note: orphan headers regressed — see R2.*
- **Search** — quality-sorted (was alphabetical), result count, SSR shell (was blank), leading magnifier, inputMode/enterKeyHint, named zero-state with escape, broken JBF "Nominee" removed from UI (search, filtering, empty-states, loading-states). *Note: 40-cap and the URL `nominee` path still open; SSR shell introduced CLS — see R4.*
- **Onboarding** — sign-in escape on every pane, city step no longer hard-blocks, sr-only step labels, logo fixed, `is_critic: true` hardcode removed (onboarding, microcopy).
- **Accessibility commitments (all 7)** — focus ring gold→slate, sign-in modal focus trap, prefers-reduced-motion, skip link, aria-current, descriptive nav-logo alt, secondary-text contrast → #5E5E5E (accessibility, color-visual-identity, typography).
- **Source badges** — always show `rating/maxRating` denominators; inline source labels; accolade year suffixes; JBF + Eater wrapped in `BadgeLink` (source-attribution). *Note: hero-card numerals still bare; year may be a silent cast — see P1-6.*
- **Saving** — Supabase write-through mounted in layout, sign-in gate on save, undo toast, aria-labels matched to state (saving-lists).
- **Typography** — h1 bumped to 700 (outweighs h2), Spectral weights trimmed to 400/500/700, Spectral italic now declared, secondary-text contrast fixed (typography).
- **Photography** — hero opacity 30%→55%, Thai stock dedupe, compact-card thumbnails (food-photography). *Note: `isStockFallbackPhoto` is dead code — see P0-2.*
- **Filtering** — Escape closes FilterChips, X-button aria-labels, "Reset all" preserves query, mobile Apply button shows live count (filtering).

## Themes across specialists

- **Fixes that landed on one surface but not its twin.** The single biggest pattern this sweep. The Maps fix hit the restaurant page but not the Explore Top 10 map (discovery, ranking-visualization, error-states). The card improvements hit `RestaurantCard` but not `CityRestaurantGrid` (restaurant-card, ranking-visualization, food-photography, typography, color-visual-identity, navigation). The Gastronome Score hit the detail hero but no list/card surface (ranking-visualization, restaurant-card, source-attribution). The focus trap hit the sign-in modal but not the nav drawer (accessibility, navigation). **Lesson: a unified card component and a shared map component would prevent the next round of this.**

- **Fixes that shipped as code but were never wired up.** `isStockFallbackPhoto` exists and is correct but no component calls it — dead code (food-photography). The home orphan-header fix went into the child components but the parent headers still render (discovery, information-architecture). The accolade-year display relies on type casts that may resolve to `undefined` at runtime with no error (source-attribution). **Lesson: "merged" is not "verified rendering."**

- **Design tokens still bypassed by raw emerald.** ~99 `emerald-*` usages survive across 15+ files; the rendered product still reads green, not gold/slate. The city hero, filter chips, card hover, the entire review-writing flow, and the 404/error pages are all off-brand (color-visual-identity, typography). The token *system* is now correct and even has semantic accolade/rating tokens — components just don't use it.

- **The aggregator's credibility still under-delivers on its own flagship.** The hero restaurant shows "2 sources" and an empty dish list; the score is built from the two weakest sources; "Similar Restaurants" are fabricated; coverage gaps are silent (the-critic, the-diner, the-chef, source-attribution). The number landed; the *defensibility* of the number did not.

- **Still no editorial voice anywhere.** Every screen remains a layout problem solved tastefully; there is no "Critic's Note," no `/methodology` page, no point of view — the thing that would separate Gastronome from a tasteful scraper (the-critic, source-attribution).

- **The decision-tonight last mile is still missing.** No hours, no "Open now," no reservation CTA — so the diner still leaves for OpenTable/Google to finish the job (the-diner, the-chef, restaurant-detail, map-location-ux).

- **Mobile navigation is still a two-tier system.** Hamburger + bottom nav coexist; Cities and Recent are reachable only via the hamburger; the bottom nav goes unlit on city pages; content clips under the fixed bottom bar on footer-less pages (mobile-responsive, navigation).

- **Onboarding is now polished but maximally gated.** All five v2 onboarding issues are fixed, but anonymous browsing was removed entirely — a curious first-time visitor has no way to preview before surrendering an email (onboarding).

- **A second wave of "data-shaped" bugs.** New since v2: the unguarded year casts (source-attribution), the case-sensitive cuisine `.in()` match that silently zeroes results (filtering, search), the 200-favorite write cap that truncates server data on sign-in (saving-lists), and the silent localStorage-only degradation when the sync tables are missing (saving-lists).

## Alarming

Verbatim from the specialists' "Alarming" sections.

- **error-states:** "The Top 10 map error (P0) is the same bug that nine v2 specialists flagged as their single most alarming finding — it was fixed on the restaurant page but not on the Explore page. The fix is one line. The visible Google error banner sits directly inside the editorial flagship section of the app and reads as a broken product."

- **ranking-visualization:** "The Google Maps iframe error on Explore's Top 10 map panel is the same class of failure that was the v2 P0 #1. The restaurant detail fix did not propagate to Top10Trending. Production users today see a white error box overlaid by floating numbered pins — the numbered-pin improvement is now visible only as pins floating over an error message. This is arguably more visually jarring than the unlabeled-dot state it replaced."

- **discovery:** (Finding 3, REGRESSION) "the `explore-desktop.png` screenshot shows the raw Google Maps Platform error message ('This API is not activated on this API project…') rendered visibly inside the map panel on the Explore / Top 10 Trending component … The restaurant-page fix did not carry over to this second map surface."

- **food-photography:** "The `isStockFallbackPhoto` helper was the headline food-photography quick-win in v2 and was shipped as code — but zero UI components call it. It is dead code today. Users are shown Unsplash stock photos of arbitrary dishes with no disclosure, which is actively misleading on a product whose value proposition is authentic restaurant intelligence. This should be treated as a P0 trust issue, not a cosmetic P2."

- **the-chef:** "Fabricated peer names (#3) is the genuinely alarming one — invented data on a public profile is a reputational and possibly legal risk per the house rule 'never invent.'" Also: "community-desktop: 'Coming Soon / Members Only' — a live nav tab leading to a permanent empty promise reads as vaporware."

- **the-critic:** "[REGRESSION risk] Weighting Google+Yelp at 0.5 of a 4-source blend means a one-Michelin-star room can score below a hyped neighborhood spot with thinner credentials. The score is defensible as arithmetic but not yet as editorial judgment — fix the framing before this number becomes the brand."

- **the-diner:** "The app that aggregates 7 sources shows its hero restaurant with '2 sources' and an empty dish list — the two headline promises (breadth, dishes) both visibly under-deliver on the very first restaurant a new diner opens."

- **source-attribution:** "The `michelin_year`, `jbf_year`, and `eater_year` fields are accessed via TypeScript type casts with no runtime guard. If these columns are missing from the DB schema, every accolade badge silently drops its year — but no test or TypeScript error will surface this. The v2 fix for 'stale accolades not showing year' may be fully cosmetic."

- **saving-lists:** "The `writeFavorites` cap of 200 IDs silently drops any favorites beyond 200 on every write, including on server-pull during `initCollectionsSync`. If a power user has >200 server-side favorites, calling `writeFavorites(serverFavorites)` will silently truncate their local cache each sign-in."

- **empty-states:** "The unauth profile page is worse than it looks: on mobile, the 'You need to be signed in' text appears roughly one-third of the way down a largely blank screen, with no bottom nav CTA and no sign-in button anywhere in view … This is the single worst dead-end in the app and costs sign-up conversions every time."

- **mobile-responsive:** "The recent-mobile.png screenshot renders what appears to be ~200+ restaurant rows in a flat list with no pagination or infinite-scroll — the page is roughly 9,000px tall. Infinite scroll was fixed for the City page but the Recent page may not have received the same treatment … this is a P0 equivalent of the NYC bug."

- **color-visual-identity:** "The review-writing flow (`/restaurants/[id]/review`, `/review/new`, `/review/[id]/edit`) is entirely off-brand — emerald CTAs, emerald focus rings, emerald star labels. This is the highest-trust moment in the user relationship (leaving a public review) and it looks like a different product from the restaurant detail page that precedes it."

- **IA, navigation, search, filtering, loading-states, map-location-ux, microcopy, onboarding, accessibility, the-critic (quick-wins), restaurant-detail:** explicitly reported **no alarming P0 regressions** in their lanes — a meaningful signal that the fix session did not break their areas.

## Recommended next 7 actions

Ordered by impact — what D should do next.

1. **Delete the Places-key fallback on the Explore Top 10 map embed** (`Top10Trending.tsx` ~line 542), so the SVG-grid fallback renders instead of the raw Google error. ~5 minutes.
2. **Fix the two home orphan headers + swap the unauth Profile page to `<EmptyState>` with a Sign in button.** Two trust/conversion dead-ends, both tiny. ~30 minutes total.
3. **Wire `isStockFallbackPhoto` into the card + verify `michelin_year`/`jbf_year`/`eater_year` are real columns.** Two "shipped but not actually working" fixes from v2 that are silently misleading users. ~1 hour.
4. **Bring Save (at minimum) to `CityRestaurantGrid`, and audit the Recent page for an unpaginated list.** Closes the worst surface-parity gap (no Save on the highest-volume browse page) and de-risks a possible repeat of the v2 NYC-page crisis. ~2 hours.
5. **Reframe the Gastronome Score: inline source identity + honest coverage count + review-count anchor + weight footnote.** Makes the product's central number defensible on its own flagship. ~2 hours.
6. **Remove the fabricated "Similar Restaurants" and add the mobile nav drawer focus trap + `aria-pressed` on onboarding/filter toggles.** Closes the "never invent" violation and the remaining keyboard/AT gaps. ~2 hours.
7. **Add hours / "Open now" + a Resy/OpenTable deep-link button to the restaurant page.** Recovers the decide-tonight last mile that keeps users on Google/OpenTable. ~half a day.

## Why each of the 7 matters

1. **Explore map error.** Every user browsing the Top 10 — the app's editorial flagship section — sees a raw Google rejection error sitting under the polished numbered pins; three specialists independently called it their most alarming finding and it's the same failure class as v2's #1 P0. If you don't ship the one-liner, the team's marquee "we fixed the broken map" win is only half true and the product still reads as broken to anyone who opens Explore.

2. **Orphan headers + Profile dead-end.** New and anonymous visitors see two empty section headings on the home page (it looks half-built) and hit a one-sentence white wall when they tap Profile (no way to sign in from where they're standing). Not fixing these means your first-impression and your single cheapest sign-up funnel both actively shed users, and one of them is a fix the team *believes* already shipped.

3. **Stock-photo helper + accolade-year casts.** Users are being shown arbitrary stock food photos as if they were the real restaurant, and Michelin/JBF/Eater years may be silently blank — both are v2 fixes that shipped as code but never actually render. Skipping this means the team's "verified fixed" list is wrong in two trust-critical places, and the product quietly misleads users on authenticity and accolade recency.

4. **Save on CityRestaurantGrid + Recent audit.** The most-trafficked browse surface (a whole city's restaurants) gives users no way to bookmark while browsing, forcing a tap into every detail page, and the Recent page may be silently rendering ~9,000px of unpaginated rows. Not doing this leaves the build-a-shortlist pattern broken exactly where users browse most, and risks a repeat of the v2 mobile-performance crisis the team just fixed elsewhere.

5. **Gastronome Score reframe.** The number the entire product is named for currently collapses to just Google + Yelp on a Michelin-starred restaurant, with a popover that overstates its coverage and hides its weights. If you don't reframe it, the score is indefensible the moment a critic or owner asks "based on what?" — and it can rank a 1-star room below a hyped neighborhood spot, undermining the credibility the whole aggregator pitch rests on.

6. **Fabricated peers + AT gaps.** "Similar Restaurants" lists invented restaurants with invented Michelin stars next to a real one — a reputational and possibly legal risk that violates the house "never invent" rule — and keyboard/screen-reader users can still tab out of the open mobile nav and can't tell which onboarding/filter options are selected. Skipping this means publishing fabricated data on public profiles and shipping known WCAG failures on primary navigation and signup.

7. **Hours + reservations.** The page still can't tell a diner whether the restaurant is open tonight or let them book a table, so they leave for OpenTable or Google to finish the decision. Not adding it means Gastronome stays a research tool people *leave* at the moment of action, instead of the decision tool its "decide in one tab" pitch promises.
