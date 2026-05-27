# information-architecture

**Lens:** How well does the page hierarchy expose the city → neighborhood → restaurant → dish → review source mental model, and where does the structure fight the user?
**Reviewed:** `home-desktop.png` screenshot + `src/app/page.tsx` + `src/components/Navigation.tsx`.

## Top 3 findings

1. [P0] **What's wrong:** The home page is silently hard-coded to New York City with no indication of this to the user. The "Suggestions" section header carries no city label, so a user in Miami or Chicago sees NYC restaurants with no explanation. (`page.tsx` line 14: `const DEFAULT_CITY = 'New York'`; screenshot: "Suggestions" heading shows no city context.)
   **Why it matters:** Users without context will trust the results as relevant to them, book or dismiss restaurants incorrectly, and lose confidence when they notice the mismatch.
   **What to do:** Surface the active city next to the section label — e.g. "Suggestions · New York" — and link it to the city selector on `/explore`. Read the user's `profiles.home_city` and use that as the default instead of a hardcoded constant.
   **Why you'd want to do this:** Accurate location context is table stakes for a restaurant aggregator; it also unlocks personalisation that drives return visits.
   (effort: S)

2. [P1] **What's wrong:** The nav (information architecture's top-level skeleton) lists four items — Home, Explore, Community, Profile — but the city → neighborhood → restaurant hierarchy that the app is built on is invisible at the global level. There is no "Cities" entry point and no breadcrumb (trail showing where you are in a hierarchy) on any page. (`Navigation.tsx` lines 12–17; screenshot: nav bar.)
   **Why it matters:** New users cannot discover that the app is city-scoped at all; they have no mental map of where restaurant pages live relative to the home page.
   **What to do:** Add a "Cities" nav item linking to a city index, or collapse it under Explore with a visible sub-label. Add a breadcrumb (City > Restaurant name) on restaurant detail pages.
   **Why you'd want to do this:** Exposing the hierarchy makes the app feel like a structured guide rather than a random feed, which is the brand promise.
   (effort: M)

3. [P1] **What's wrong:** "Saved Collections" on the home page (`page.tsx` lines 20–53) are hard-coded placeholder tiles (Date Night, Quick Lunch, Special Occasions, Hidden Gems) not tied to any real user-created or editorial collection. They link to filtered `/explore` views, but the section is labelled as if it belongs to the user's personal library. Screenshot: four collection tiles at page bottom.
   **Why it matters:** Mixing editorial presets with the implied promise of user-curated content creates a false hierarchy — users will look for "their" collections and find generic ones, eroding trust in the save/bookmark feature.
   **What to do:** Rename the section "Editorial Picks" or "Start Here" to signal it is not user-owned. Separately surface a genuine user collections section (even if empty-state only) once the user has saved anything.
   **Why you'd want to do this:** Clear ownership labels prevent confusion and set correct expectations for the bookmarking feature.
   (effort: S)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** "Recent Searches" and "Your Favorites" sit side-by-side in a two-column grid (`page.tsx` lines 92–102) but "Recent Searches" shows placeholder copy ("Your recent searches will appear here") while "Your Favorites" shows a CTA button. Screenshot: mid-page two-column row.
   **Why it matters:** Empty panels that look like filled content make the page feel broken rather than onboarding the user.
   **What to do:** Collapse empty sections to zero height or replace them with a single combined "Get started" prompt until the user has activity.
   **Why you'd want to do this:** Reduces visual noise and makes the home page feel purposeful on first visit.
   (effort: S)

2. **What's wrong:** The "Curated Selection" label above "Suggestions" (`page.tsx` line 84; screenshot: small uppercase text above heading) is the only place any editorial voice appears, yet it is rendered in tiny uppercase as a throw-away eyebrow. No source attribution (who curated it? the algorithm? the editorial team?) is given.
   **Why it matters:** The app's value proposition is trusted aggregation; unlabelled curation undermines that trust.
   **What to do:** Add a one-line descriptor: "Trending in New York this week" or "Editor's picks" with a link to the ranking methodology page.
   **Why you'd want to do this:** Transparency about how lists are built is a trust signal that differentiates Gastronome from a plain search result.
   (effort: S)

3. **What's wrong:** The nav has no search affordance (icon or input) at the global level (`Navigation.tsx` lines 12–17; screenshot: nav bar). Search lives only at `/search`.
   **Why it matters:** Search is the primary intent for most restaurant-app sessions; burying it one tap away increases time-to-first-result.
   **What to do:** Add a search icon to the nav bar that jumps to `/search` or expands an inline search input.
   **Why you'd want to do this:** Reduces friction for the highest-frequency action in the app.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** The entire home page skips the city → neighborhood layer entirely. There is no way to browse by neighborhood (e.g. West Village, Williamsburg) from any surface visible in the screenshot or in `page.tsx`. The data model supports city-level filtering (`page.tsx` line 14) but neighborhood is absent from the IA.
**Why it matters:** Neighborhood is how New Yorkers (and residents of most dense cities) actually think about dining decisions — "something in the West Village tonight" is a more natural query than "something in New York."
**What to do:** Introduce a neighborhood filter on the Explore page and a neighborhood label on restaurant cards and detail pages. Over time, build neighborhood landing pages as an SEO and discovery surface.
**Why you'd want to do this:** Neighbourhood-level IA is a meaningful differentiator against Yelp and Google Maps, and creates a natural editorial hierarchy for curated lists.
**The tradeoff:** Requires neighbourhood data to be populated in the database (`restaurants` table has no neighbourhood column currently); adding it is a schema change and backfill task before the UI can ship.
(effort: L)

## Alarming (optional, 1 line)

The city hard-code (`DEFAULT_CITY = 'New York'`, `page.tsx:14`) means every logged-in user regardless of location sees NYC results — this is a silent personalisation failure that will read as a bug to any non-NYC user.
