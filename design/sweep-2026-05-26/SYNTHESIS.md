# UI/UX Sweep — 2026-05-26 — Synthesis

## TL;DR

The biggest issue is that Gastronome currently fails at its own pitch: the unified rating it promises is absent, the city defaults silently to New York for every user on earth, and a raw Google Maps "Reject API key" error renders mid-page on every restaurant detail page in production — together those three things make the product look like a slower, broken version of the apps it's trying to replace. The biggest quick win is removing or fixing the visible Maps error and labeling the home-page city ("Suggestions in New York · change") — both are under-an-hour fixes that immediately stop the worst trust leaks. The biggest bigger-bet opportunity is replacing the "Ratings Dashboard" hero with a single Gastronome score plus a 2–3 sentence editorial "Editor's Take," which is the only thing that could give Gastronome a defensible reason to exist next to Google Maps.

## Foodie Panel Consensus

All three foodie-panel agents independently arrived at the same conclusion: **the restaurant detail page tells the reader what numbers exist but never what to think about a place**, and that absence is the single largest competitive vulnerability.

- **the-critic:** "The whole page tells the reader *what numbers exist* but never *what to think*. The lead element is 'Ratings Dashboard' with Google 4.3 and Yelp 3.7 — no synthesis, no critic quote, no 'go for the X, skip the Y.'"
- **the-diner:** "I cannot tell why Jean-Georges is being suggested over Tuhka. With no rating, price, or accolade badge, the grid feels like random Unsplash tiles. That is exactly the trust signal Yelp/Google already give me — Gastronome's whole edge disappears."
- **the-chef:** "The whole page tells my story through other people's scores. JoJo is a 1-Michelin-star Jean-Georges room with a real point of view, and the loudest things on the screen are 'Google 4.3' and 'Yelp 3.7' — including a Yelp number low enough to look like a warning sign."

A second consensus point: **the Michelin star — Gastronome's highest-prestige signal — is visually demoted on the very pages where it should anchor the design**, while Yelp 3.7 is given equal weight to Google 4.3 next to it. The-critic, the-chef, and (independently) the ranking-visualization and color-visual-identity specialists all flagged this hierarchy failure.

## Where the Panel Disagreed

These are strategy questions D needs to make a call on, not bugs to fix:

1. **Search-first vs. browse-first home page.** the-diner wants a "chunky 'Find a restaurant' hero" replacing the suggestions grid because "a browse-first home is a magazine; a search-first home is a tool." the-critic and the-chef both want editorial content above the fold instead. discovery and information-architecture lean editorial. This is a real product-positioning fork: utility tool vs. food publication.

2. **How much editorial copy to commit to.** the-critic's bigger bet is to "lead with a critic-style review headline" and own LLM-generated editorial copy per restaurant. the-chef's bigger bet is the opposite — a "claimed by the restaurant" verification flow where the operator writes the canonical description. These are two different bets on who produces the editorial voice (Gastronome's AI/editors vs. the restaurants themselves).

3. **Restaurant-tier visual hierarchy.** the-critic wants to "visually demote Yelp in the dashboard for fine-dining tier restaurants" so a Michelin star isn't undercut by a 3.7 Yelp. the-chef agrees but framing differs. source-attribution and ranking-visualization treat all sources as equal-weight by design. The tension: should the visual treatment of a casual taqueria differ from a Michelin tasting menu, or does the product owe every restaurant the same template?

4. **How prominent should social/video content be?** the-critic dismisses "On Social" as "a placeholder" that signals a dead app. food-photography's bigger bet is the opposite — pull TikTok thumbnails forward, even auto-loop them on hover. dish-level-ux wants videos *tagged to dishes* so they reinforce each other. The right answer depends on whether Gastronome positions as editorial guide or social discovery feed.

## Critical Issues (P0) — must fix before ship

1. **The Google Maps error renders raw in production on every restaurant detail page.** A "Google Maps Platform rejected your request" error text panel currently appears mid-page in the sidebar map widget. Users see Google's developer error message instead of a map. **Fix:** Add a `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` env var in Vercel with "Maps Embed API" enabled (the current Places key lacks that scope), AND wrap the iframe in a client component that falls back to a static "View on Google Maps" button when the iframe fails to load. The fallback URL already exists in code. **Effort:** S. **Raised by:** the-critic, the-chef, restaurant-detail, map-location-ux, error-states, ranking-visualization, typography, source-attribution (8 specialists).

2. **The home page is silently hard-coded to New York for every user globally.** `DEFAULT_CITY = 'New York'` in `src/app/page.tsx:14`. A Miami user opens the home page and sees NYC restaurants with no warning, no city label, no way to change it from the home screen. **Fix:** Read `profiles.home_city` for authenticated users (already in the schema) and surface the active city next to the "Suggestions" label ("Suggestions in New York · change"). Fall back to browser geolocation or IP city detection for new users. **Effort:** S–M. **Raised by:** the-diner, information-architecture, discovery, microcopy (4 specialists, all framing it as the same core failure).

3. **The unified "Gastronome rating" the product is named after does not exist on the page.** The hero star is just Google's rating relabeled. The "Ratings Dashboard" then shows Google and Yelp again as separate numbers. There is no aggregate, no weighting, no Gastronome score. **Fix:** Add a single hero score (e.g. "8.4 / 10 · 4 sources") with a tooltip showing how it was computed. Keep the per-source dashboard below as receipts. Requires deciding a weighting formula. **Effort:** M. **Raised by:** the-critic, the-chef, ranking-visualization, source-attribution (4 specialists, framed slightly differently each time but the same gap).

4. **"Saved Collections" on home page are hard-coded placeholders, not user collections.** Four tiles (Date Night, Quick Lunch, etc.) sit under a heading that implies the user's personal library; they link to filtered Explore views. A user who never saved anything sees "their" collections populated, which silently breaks trust in the entire save feature. **Fix:** Rename the section "Editorial Picks" or "Curated Collections" and remove the bookmark hover affordance. Separately surface real user collections only when the user has saved something. **Effort:** S. **Raised by:** the-diner, information-architecture, discovery, microcopy (4 specialists).

5. **The "James Beard Nominee" filter is silently broken — returns winners only.** The `james_beard_nominated` column was dropped; both "Nominee" and "Winner" filter options now query `eq('james_beard_winner', true)`. Users who select "Nominee" get a narrower set than they asked for with no warning. **Fix:** Hide the "Nominee" option until `restaurant_jbf_history` is wired into the filter, OR add a caption "Nominee data coming soon — showing winners only." **Effort:** S. **Raised by:** filtering.

6. **Bookmarks and collections live only in localStorage — no database persistence.** A user who saves restaurants on their laptop sees an empty list on their phone. Any "Clear Site Data" silently destroys every save with no warning. The sign-in gate implies persistence but delivers none. **Fix:** Migrate favorites and collections to Supabase (a `user_collections` table or column on `profiles`). Keep localStorage as an optimistic cache; sync on mount and on change. **Effort:** L. **Raised by:** saving-lists.

7. **There is no search bar or city selector on the home page.** A diner arriving with intent ("Italian, West Village, tonight") cannot search from the home screen — nav has Home/Explore/Community/Profile and no search affordance. **Fix:** Add a prominent search input at the top of the home page above Suggestions, or at minimum a search icon in the top nav that opens `/search`. **Effort:** M. **Raised by:** the-diner, information-architecture (quick win), navigation.

8. **The compact restaurant card variant has no photo at all** — used for the flagship Top 10 Trending list, search results, and profile lists. Every card is a white rectangle of text. Users cannot tell at a glance whether "Carbone" is a cozy trattoria or a glitzy red-sauce institution; the page reads as a spreadsheet, not a discovery surface. **Fix:** Add a 48×48 px thumbnail to the compact variant using the existing `getHeroPhoto` fallback chain. No layout change needed — just an image before the text block. **Effort:** S. **Raised by:** restaurant-card.

9. **The focus ring color fails WCAG contrast (2.3:1) on white surfaces.** `--color-primary: #D4A574` (warm tan) is the global focus outline color; on white this is below the 3:1 minimum for non-text UI. Keyboard-only users have no visible focus indicator at all on most of the site. **Fix:** Change focus outline color to `--color-secondary: #2C3E50` (~10:1 on white). One-line CSS change in `globals.css:63`. **Effort:** S. **Raised by:** accessibility.

10. **Anonymous users are force-redirected to a 4-step onboarding with no escape.** The "Sign in" link only appears on the final pane. Returning users with cleared cookies must walk through three pitch screens before they can log in. New skeptics bounce because they cannot see any real content first. **Fix:** Surface "Sign in" on every pane (top-right corner), and add a "Browse first" link on panes 1–2 that shows a single city's Explore page without saving preferences. **Effort:** S. **Raised by:** onboarding.

11. **Mobile has two competing navigation systems — a hamburger menu and a bottom nav — both showing the same 4 destinations.** Confusing on mobile; the hamburger drawer is redundant and the unused 112px tall sticky header eats 13% of the viewport. **Fix:** Remove the hamburger button on mobile (`hidden md:block`) and let BottomNav own all mobile nav. Reduce mobile header height to ~56–64px and scale the logo to 40×40 on small viewports. **Effort:** S. **Raised by:** mobile-responsive.

## High-Impact Improvements (P1) — fix this week

1. **The Michelin star is visually demoted while Yelp 3.7 sits at equal weight to Google 4.3 next to it.** A 1-Michelin restaurant being out-shouted by a magenta Instagram chip reads as having no taste. **Fix:** Promote the Michelin glyph + "1 Star · 2026" into the hero next to the restaurant name. Demote Yelp visually for fine-dining tier restaurants. **Effort:** S–M. **Raised by:** the-critic, the-chef, source-attribution, ranking-visualization.

2. **No reservation/booking CTA anywhere on the restaurant page.** Phone, website, and Instagram appear as small links; the only call-to-action is "View on Google Maps." The page reads as research, not a tool for booking tonight. **Fix:** Add a "Reserve a Table" button in the hero contact row that deep-links to OpenTable/Resy when available. Requires schema field or domain heuristic. **Effort:** M. **Raised by:** the-critic, the-chef, restaurant-detail.

3. **"What Reviewers Mention" (the dish chips) silently disappears when no dishes are populated — including for major Michelin restaurants.** Dishes are the only thing a chef actually controls and the single most useful pre-visit info; a restaurant page with no dishes is a brochure without a menu. **Fix (short-term):** Render a graceful placeholder ("Dishes coming soon — see the menu →") that links to the website rather than hiding the section. **Fix (long-term):** Backfill highlighted dishes for every Michelin/JBF/Eater restaurant as a launch blocker. **Effort:** S for placeholder, L for backfill. **Raised by:** the-critic, the-chef, dish-level-ux.

4. **Source attribution uses single-letter badges (G, Y, TI, B) with no logo and no full label — and mixes rating scales (5-point vs 10-point) without showing denominators.** A new user cannot tell `B` means Beli vs Bon Appétit; cannot tell whether 4.3 and 8.1 are on the same scale. **Fix:** Replace single letters with brand wordmarks/logos from `public/logos/`. Show denominators ("4.3 / 5" vs "8.1 / 10"). Make the tooltip-only review count visible at rest, especially on mobile where hover doesn't exist. **Effort:** S. **Raised by:** source-attribution, dish-level-ux, restaurant-detail.

5. **The trending score that drives the entire rank order is never shown.** The Top 10 list shows Google/Yelp ratings instead — and users rightly conclude the order makes no sense when #3 has a 4.4 Google rating and #4 has a 4.5. **Fix:** Add a one-line "why trending" caption per row using the `trending_counts` prop already available (e.g. "12 new videos · 30d"). **Effort:** S. **Raised by:** ranking-visualization.

6. **The hero photo on the restaurant page is set to `opacity-30`, making the primary image nearly invisible under the dark overlay.** For a Michelin restaurant with a distinctive interior, a 30%-opacity photo creates no place identity or appetite. **Fix:** Increase opacity to 50–60% and tighten the gradient so the bottom-third remains legible while the upper photo breathes. Single CSS value change. **Effort:** S. **Raised by:** restaurant-detail.

7. **"The Story" (the editorial description) is the last item in the main column, after Ratings Dashboard and the entire video gallery.** Users scroll through aggregated numbers before learning what the restaurant is. **Fix:** Move "The Story" directly below the hero/accolades banner, before the Ratings Dashboard. Reorder JSX blocks only — no data changes. **Effort:** S. **Raised by:** restaurant-detail.

8. **No "get directions" affordance, no mobile native-maps deep-link.** "View on Google Maps" opens a browser tab; mobile users want one tap to Apple Maps / Waze / Google Maps native app. **Fix:** Wrap the link in platform detection so iOS/Android open `maps://` or `geo:` URIs, with a "Directions" CTA alongside "View on Google Maps." **Effort:** M. **Raised by:** map-location-ux.

9. **Restaurant cards have no bookmark/save action — the entire card is a single Link, so users must navigate to the detail page to save.** This compounds across 10–150 items on the Explore page and is a known conversion killer. A `BookmarkButton` component already exists; it's just never mounted on the card. **Fix:** Float a BookmarkButton in the top-right corner of card imagery with `e.preventDefault()` to intercept the parent Link click. **Effort:** M. **Raised by:** restaurant-card.

10. **Filter persistence is silent and confusing.** Filters persist via localStorage across visits with no banner explaining why a fresh load shows old filters. The disclosure ("filters persist across visits until you reset") only appears when a filter is already visible — first-time visitors landing with stale filters see no explanation for odd results. **Fix:** On page load, if filters were restored from localStorage rather than URL, show a dismissible notice: "Showing your last search filters — [Reset]." **Effort:** S. **Raised by:** filtering.

## Quick Wins (≤1hr each)

1. Change the home page eyebrow "Curated Selection" to "Trending This Week" — the data is algorithmic 7-day trending, not curated. (microcopy, the-diner, information-architecture)
2. Replace the 96×96 JPG logo with the wordmark SVG already used in the footer — it currently looks like a placeholder. (the-diner)
3. Add a price tier glyph ($, $$, $$$, $$$$) to every SuggestionCard and RestaurantCard — budget is the #2 filter after cuisine. (the-diner, the-chef)
4. Add a compact "$$$ · Open until 10pm · Reserve" row under the address on restaurant detail pages. (the-chef)
5. Hide the "On Social" section header until ≥3 videos load — a header over a near-empty section signals a dead app. (the-critic)
6. Match the Favorites empty-state instruction to the actual icon — currently says "tap the heart" but the desktop button is a bookmark icon. (microcopy)
7. Reconcile "Sign in" vs "Log in" — mobile drawer says one, desktop nav says the other. (microcopy)
8. Make zero-results copy name the most restrictive filter: "Try removing the Google ≥4.1 rating filter" instead of vague "Try relaxing a filter." (search, empty-states, filtering)
9. Add a search icon to the top nav that jumps to `/search`. (information-architecture, navigation, search)
10. Change the BookmarkButton `aria-label` from "Bookmark" to "Save" so it matches the visible text — WCAG 2.5.3 fix. (saving-lists)
11. Add `aria-hidden="true"` to decorative MapPin icons in RestaurantCard. (accessibility)
12. Add a skip-navigation link as the first child of `<body>` — WCAG 2.4.1 Level A. (accessibility)
13. Change the `eater_url`-null fallback to omit the Eater 38 badge entirely rather than rendering an un-linkable claim. (source-attribution)
14. Fix the Thai cuisine fallback photo — it currently uses the same ramen-bowl Unsplash URL as Japanese. (food-photography)
15. Add a "Resend confirmation email" button and "Check spam folder" hint to the ConfirmEmailStep — single highest drop-off point in email/password signup. (onboarding)

## Bigger Bets

1. **Replace "Ratings Dashboard" with an editorial "Editor's Take" headline + verdict paragraph + receipts.** the-critic frames this as the entire competitive moat vs Google Maps — Gastronome owes every restaurant a synthesis ("the Jean-Georges townhouse that out-charms its cooking"), not a scoreboard. **Tradeoff:** at scale this means LLM-generated copy with all the quality/legal risks of calling a restaurant "out-charmed by its cooking." Needs a generation prompt, a review workflow, and a "generated from public reviews" disclosure. **Raised by:** the-critic (the foodie panel agrees on the underlying need).

2. **A "Claimed by the restaurant" verification flow.** Let operators verify their page, contribute the canonical dish list, current pricing, and current photos. Show a small verified mark when they have. This is the opposite bet from #1 — Gastronome doesn't generate the editorial voice, restaurants do. **Tradeoff:** verification queue work, dispute handling, and a temporary two-class visual system (verified pages look better than unverified). **Raised by:** the-chef.

3. **A shareable list/collection feature with public read-only URLs.** Currently the share button shares a single restaurant; there is no way to share a named list ("Here's my Tokyo ramen list"). saving-lists frames this as the single biggest unrealized growth loop — a well-curated list shared in a group chat is how Beli, Eater, and Infatuation build organic installs. **Tradeoff:** depends on first migrating collections to the database (currently localStorage); requires the saving-lists P0 fix as a prerequisite. **Raised by:** saving-lists.

4. **Neighborhood as a first-class IA layer.** New Yorkers don't think in cities, they think in neighborhoods ("something in the West Village tonight"). Add a neighborhood filter on Explore, neighborhood labels on cards and detail pages, and eventually neighborhood landing pages as an SEO/discovery surface. **Tradeoff:** requires a schema change and backfill — the `restaurants` table has no neighborhood column currently. **Raised by:** information-architecture, map-location-ux.

5. **A "smart filter" layer that shows estimated result counts per filter option before selection.** After 2+ filters are active, query estimated counts and gray out zero-result options. Standard pattern in e-commerce (Shopify, ASOS, Booking.com); zero-result dead-ends drop sharply. **Tradeoff:** N+1 count queries per filter panel render — adds latency and Supabase read cost. Can be feature-flagged behind a DB cost analysis. **Raised by:** filtering.

## Themes across multiple specialists

- **Source attribution is weak in 8 different forms.** Single-letter badges (source-attribution), tooltip-only mention counts on dish chips (dish-level-ux), no logos on home cards (discovery), no aggregate score (the-critic, the-chef, ranking-visualization), mixed denominator scales never shown (source-attribution), Eater badges with no source link (source-attribution), no "About our sources" explainer page (source-attribution), unattributed hero rating that's actually just Google (restaurant-detail). Together these mean the product's core promise — "trusted aggregation" — is invisible on every surface a user lands on.

- **Empty states across the product feel like dead zones rather than invitations.** Recent Searches says "Your recent searches will appear here" (microcopy, discovery, empty-states). Favorites shows a section header above an empty section (discovery). Search's blank state has no trending seeds (empty-states). Onboarding's home page after signup shows three empty personal sections (onboarding). The pattern: a section labeled with personal language sitting empty makes the app feel broken, not new.

- **6 specialists flagged the NYC hardcoded default in different forms** (the-diner, information-architecture, discovery, microcopy, plus implicit in onboarding and navigation). This is the same root cause appearing across every lens.

- **The Google Maps API error appears in 8 different specialist files** (the-critic, the-chef, restaurant-detail, map-location-ux, error-states, ranking-visualization, typography, source-attribution). It's not just a map problem — every specialist who reviewed `restaurant-desktop.png` saw it as the single most damaging visible defect.

- **The product is built for a multi-source aggregator but renders single-source on most surfaces** (discovery cards, hero ratings, restaurant card thumbnails, search results). 7+ specialists noted this in different ways — the aggregation only appears in one section of one page.

- **Accolade badges (Michelin, JBF, Eater 38) carry meaning but are unreadable without prior knowledge.** color-visual-identity flags the colors as untokenized; restaurant-card flags the left-border accent as "glanceable but illegible"; ranking-visualization wants text labels next to icons; source-attribution flags missing JBF semifinalist tier and un-linkable Eater badges. A first-time user gets no help decoding the app's most prestigious signals.

- **Mobile is materially worse than desktop, not just smaller.** mobile-responsive flagged two competing nav systems, oversize header, and a single-column suggestions stack that buries content. accessibility flagged the mobile drawer is not a focus trap. saving-lists flagged tooltip-only review counts breaking on touch. dish-level-ux flagged the same for sample quotes. These compound: a mobile-first diner gets a worse experience on every surface.

- **Loading and error states are inconsistent or absent.** loading-states found a blank-white Suspense fallback and skeleton/real mismatch. error-states found `Promise.all` failures that cascade to 404 instead of partial degradation. empty-states found the dish-mode "Discover" CTA navigates away from dish intent. None of these are individually catastrophic; collectively they make the app feel fragile.

## What's working — don't break

- **The aggregator data pipeline is real.** Every specialist who looked at the data model noted the schema (`restaurant_highlighted_dishes`, `restaurant_top_dishes`, `restaurant_videos`, `restaurant_menu_items`) supports the product's pitch — the data exists, it's just not surfaced. The investment in scraping and ranking is intact.
- **The accolade system spans the right sources** (Michelin, JBF, Eater 38, Infatuation, Beli) — both the-critic and source-attribution implicitly endorsed the source roster even when criticizing presentation.
- **The fallback SVG grid for the Top 10 Trending map is "tasteful and functional" (ranking-visualization)** — it just needs to actually appear when the iframe fails.
- **The token system in `globals.css` is mostly well-defined.** color-visual-identity criticized scope (no dark mode, rogue emerald, untokenized accolade colors) but not the underlying architecture — fixes are additive, not destructive.
- **The "What Reviewers Mention" section is the most novel feature in the codebase** (the-critic) — when it renders, it works. The fix is to never let it silently disappear.
- **Onboarding's CityStep accepts tap-to-select pills ordered by restaurant count** — a sound interaction; the issue is missing geolocation, not the pattern itself.
- **The hero variant of RestaurantCard renders accolade badges via `AccoladesBadges`** — the system exists, it's just gated and inconsistent. (restaurant-card)
- **The `ShareButton` for individual restaurants works** — the gap is shareable lists, not the share primitive itself. (saving-lists)
- **Filter sidebar with 11 dimensions is comprehensive and live-updating** — the issue is no "estimated counts" affordance, not the dimensions themselves. (filtering)
- **DM Sans + Spectral are a strong type-pair choice** — typography's criticism is weight cleanup and hierarchy, not the fonts.

## Alarming

(Direct quotes from every "Alarming" line in any specialist file, unfiltered)

- **the-critic:** "A live Google Maps 'Reject API key' error panel is rendered in the right rail of the screenshot — the map sidebar is currently broken in production."
- **the-diner:** "Suggestions silently default to New York for every user globally — a Miami diner sees NYC restaurants without warning."
- **the-chef:** "Yelp 3.7 displayed at the same visual weight as Google 4.3 next to a Michelin star will actively talk guests out of booking."
- **information-architecture:** "The city hard-code (`DEFAULT_CITY = 'New York'`, `page.tsx:14`) means every logged-in user regardless of location sees NYC results — this is a silent personalisation failure that will read as a bug to any non-NYC user."
- **search:** "The Google Places API key is exposed client-side via `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` (page.tsx line 126) and loaded in a dynamically injected script tag — any visitor can extract it from DevTools with zero effort; restrict this key to your production domain in the Google Cloud Console immediately."
- **filtering:** "The 'James Beard Nominee' filter is silently broken in production — it returns identical results to 'Winner' with no disclosure (`page.tsx:344–347`); remove or label it before the next marketing push featuring awards filtering."
- **ranking-visualization:** "The Google Maps API rejection error is rendering as visible browser-rendered text inside the flagship 'Top 10 Trending' map panel in production (`explore-desktop.png`), not silently failing — users see a Google error notice where a map should be."
- **restaurant-card:** "The entire card in both variants is a single `<Link>` with no secondary action, no dismiss, no share — adding any of those later will require restructuring the DOM to avoid nested interactive elements, which is a WCAG 4.1.2 violation if done carelessly."
- **restaurant-detail:** "Live Google Maps API key rejection error is visible in production to all users — classified as P0 infrastructure break, not a design issue, but surfaced here because it is the most visible defect on the page."
- **dish-level-ux:** "The `restaurant_menu_items` table exists in the schema (CLAUDE.md) but is never queried on the restaurant detail page — all the menu price and context data is silently absent from the dish surface users actually see."
- **map-location-ux:** "The `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` is being used as a Maps Embed API key (line 801) in production — if this key has broad API permissions enabled without HTTP-referrer restrictions, it is exposed to the browser and may be subject to quota theft."
- **source-attribution:** "The Google Maps API 'Reject API key' error is visible mid-page in the screenshot — this means the map attribution chip (a legally required element of Google Maps usage) is broken in production, which may violate Google Maps Platform Terms of Service."
- **saving-lists:** "localStorage-only persistence means every saved restaurant and every named collection is silently destroyed on 'Clear Site Data' — a button many privacy-conscious users and browser extensions trigger routinely, with no warning from the app."
- **onboarding:** "No sign-in link exists on panes 1–3; a returning user who lands on /onboarding (e.g., after clearing cookies) is forced through the full pitch before they can log in — a regression risk every time auth state is lost."
- **empty-states:** "The Google Places API error visible in the restaurant screenshot (noted in primer) and the silent `catch { return [] }` at `search/page.tsx:214` mean that API failures are entirely invisible to the user — no fallback message, no retry affordance, and no signal to the team that the feature is broken in production."
- **error-states:** "Raw Google API credentials and troubleshooting URLs are visible to every user on every restaurant page with coordinates — screenshot confirms this is live in production right now."
- **microcopy:** "The `Saved Collections` tiles are PLACEHOLDER_COLLECTIONS hardcoded in `page.tsx` (lines 20–53) with Unsplash images — if any user sees this page expecting their real saved collections, the mismatch is a data-integrity trust failure, not just a copy problem."
- **typography:** "The Google Maps Platform 'Reject API key' error visible mid-page in the screenshot (`restaurant-desktop.png`) renders as a prominent gray error block inside the map `iframe`, replacing what should be the restaurant's neighborhood map — a confirmed production key misconfiguration that breaks a core UI element for all restaurant detail page visitors."
- **mobile-responsive:** "The sticky top nav (`h-28`, 112px) + bottom nav (64px) + `env(safe-area-inset-bottom)` consumes up to 176px+ of an 844px viewport — over 20% of screen real estate — before a single byte of restaurant content is visible."

(Specialist files with no "Alarming" line: navigation, discovery, ranking-visualization had its own, food-photography, color-visual-identity, accessibility — all reviewed but no alarm raised.)

## Recommended next 5 actions

1. **Fix the Google Maps embed today** — add `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` with Maps Embed API enabled in Vercel, AND add an iframe-error fallback to a static "Open in Google Maps" button using the URL already in the code.
2. **Stop silently defaulting every user to New York** — read `profiles.home_city`, label the active city next to "Suggestions in [City] · change," and surface a city selector on the home page.
3. **Rename "Saved Collections" to "Editorial Picks"** and pull the bookmark-icon affordance off the tiles — they are not user-saved, and the implied promise breaks trust in the save feature on first impression.
4. **Hide or label the broken James Beard "Nominee" filter** — it currently returns winners only; either remove the option or add "Nominee data coming soon — showing winners only."
5. **Add a real Gastronome score to the restaurant detail hero** (e.g., "8.4 / 10 · 4 sources") with a tooltip showing the weighting. Even a simple weighted average of available sources is enough to make the dashboard feel like evidence rather than the headline.

## Why each of these 5 matters

1. **Fix the Google Maps embed.** Every user opening a restaurant page right now sees a Google-branded error message telling them an API key is rejected — it is the single most damaging visible defect in the product and may even violate Google Maps Platform Terms of Service (missing required attribution chip). Not fixing it means every Michelin restaurant page looks like a broken prototype, the kind of detail that talks guests out of trusting the rest of the data.

2. **Stop defaulting every user to New York.** A Miami diner opening Gastronome sees NYC restaurants with no explanation and no way to change the city from the home screen — they either bounce or assume the entire product is broken. Not fixing it means every non-NYC user has a misleading first impression on every visit, and the entire personalization story Gastronome is selling has a giant footnote.

3. **Rename "Saved Collections" to "Editorial Picks."** A logged-in user sees four tiles under what looks like their personal library, populated with collections they never saved — this is the single fastest path to "I don't trust this app" because it implies the save feature is making things up. Not fixing it means the bookmark feature is poisoned before users ever try it, and every "Save" tap risks reinforcing the suspicion that nothing is actually being saved.

4. **Hide or label the broken James Beard "Nominee" filter.** A user filtering for nominees gets winners-only with zero warning — they're getting wrong results from a product that pitches itself as a trusted aggregator, and they'll likely blame the underlying data rather than the UI bug. Not fixing it means any food writer or industry insider who tests the filter discovers a credibility problem you can't easily explain away.

5. **Add a real Gastronome score to the restaurant detail hero.** The product is named for the unified rating it promises, and currently the page shows Google's number relabeled as the hero stat — a skeptical journalist would ask "so what does Gastronome actually think?" and there is no answer. Not fixing it means there is no defensible reason to use Gastronome instead of Google Maps, and no share-worthy metric for social previews or marketing collateral.
