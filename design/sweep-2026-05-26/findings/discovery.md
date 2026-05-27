# discovery

**Lens:** Does the home page give a reason to return when the user has no specific restaurant in mind?
**Reviewed:** screenshot (`home-desktop.png`) + `src/app/page.tsx`, `src/components/cards/SuggestionCard.tsx`, `src/components/home/FavoritesSection.tsx`, `src/components/home/RecentSearches.tsx`.

## Top 3 findings

1. [P0] **What's wrong:** "Suggestions" is hard-coded to New York City for every user, regardless of their location or home city preference (`page.tsx` line 14: `const DEFAULT_CITY = 'New York'`).
   **Why it matters:** A user in Chicago or Miami opens the home page and sees restaurants they can't visit — the page fails its core promise on the first visit from any non-NYC user.
   **What to do:** Read `profiles.home_city` for authenticated users (already in the schema per CLAUDE.md) and fall back to browser geolocation or IP-based city detection, then pass that to `topTrendingRestaurants`. The `/explore` page already has a city selector — pull that logic up to the home page.
   **Why you'd want to do this:** Personalised suggestions are the single strongest reason to return; showing irrelevant restaurants erodes trust and engagement immediately.
   (effort: M)

2. [P1] **What's wrong:** "Saved Collections" are static placeholder tiles hard-coded in the source (`page.tsx` lines 20–53) with generic Unsplash images (Date Night, Quick Lunch, Special Occasions, Hidden Gems). They are editorial fiction — no user can create, edit, or rename a collection from this page.
   **Why it matters:** Users who tap a tile land on a generic `/explore` filter, not a personal list. The affordance (a `Bookmark` icon on hover, `page.tsx` line 121) implies save/ownership but delivers nothing personal. This is a broken promise that erodes trust in the social layer.
   **What to do:** Either (a) surface real user-created collections if any exist, with a "Create your first collection" CTA when none do, or (b) rename the section "Curated Collections" and remove the bookmark affordance so the editorial intent is honest.
   **Why you'd want to do this:** A personal collection layer is a core retention hook (reason to return); placeholder tiles block it from ever being discovered.
   (effort: M)

3. [P1] **What's wrong:** The home page has no time-varying or editorial signal — "Suggestions" are 7-day trending (invisible to users), collections never change, and there is no "new this week", "just awarded", or "recently reviewed" feed element. Screenshot confirms the layout is identical every visit.
   **Why it matters:** A page that looks the same on every visit gives no reason to return unprompted. Discovery (the habitual opening of an app) requires novelty — something to have changed since the last visit.
   **What to do:** Add one rotating editorial slot above or below "Suggestions": e.g., "New Michelin stars this season", "Trending this weekend in [city]", or a recently-reviewed restaurant from someone the user follows. Even a weekly editorial headline with a `revalidate` of one day would create a sense of freshness.
   **Why you'd want to do this:** Habitual app usage is driven by variable reward — users return when they expect to see something new.
   (effort: L)

## Quick wins (≤3, no severity tag)

1. **What's wrong:** "Recent Searches" shows an empty-state placeholder (`RecentSearches.tsx` line 93: "Your recent searches will appear here.") for first-time or returning users who searched on a different device — visible as a large blank half-column in the screenshot.
   **Why it matters:** Half the two-column mid-section is dead space for most users on first visit, making the page feel sparse and unfinished.
   **What to do:** Replace the empty state with 3–5 editorially chosen "popular searches" (e.g., "ramen near me", "Michelin one-star", "best brunch") so the slot is never blank.
   **Why you'd want to do this:** Suggested searches surface intent patterns and accelerate first engagement with no backend work.
   (effort: S)

2. **What's wrong:** `SuggestionCard` shows only a single star rating and review count (`SuggestionCard.tsx` lines 79–104). Gastronome's core value prop is aggregated multi-source ratings, but the home page cards show only one source.
   **Why it matters:** The differentiated value (aggregated from Google, Yelp, Michelin, etc.) is invisible at the entry point, making the app look like a plain Google Maps clone on first impression.
   **What to do:** Add a second micro-badge for Michelin stars or Eater 38 accolades when present — one icon is enough. The data is already in the `Restaurant` type.
   **Why you'd want to do this:** The home page is the best place to show why this app is different from searching Google.
   (effort: S)

3. **What's wrong:** "Your Favorites" shows a "Start exploring" CTA button (`FavoritesSection.tsx` line 99) when empty, but the section header "Your Favorites" still appears above it — a heading over a section that has nothing yet signals abandonment rather than invitation.
   **Why it matters:** Empty state (the designed response to a screen with no user data) framing matters: "Your Favorites" implies a personal space that is currently barren, which is discouraging.
   **What to do:** When favorites are empty, swap the section header from "Your Favorites" to "Save restaurants as you go" or move the CTA directly under the Suggestions grid without the empty-state row.
   **Why you'd want to do this:** Warm empty states convert better than clinical ones — users need to feel the app is inviting them in, not waiting for them to act.
   (effort: S)

## One bigger bet (optional)

**What's wrong:** The home page has no social discovery layer — no "your followers bookmarked this" or "trending among people you follow" signal. The `follows` table exists in the schema (CLAUDE.md), but none of it surfaces on the home page.
**Why it matters:** Social proof is among the strongest discovery triggers in food apps (OpenTable, Resy, Yelp all lean on it). Without it, the app is a solo browsing experience with no network effect.
**What to do:** Add a "Friends are into" rail (a horizontal scrollable row of cards) below Suggestions, showing restaurants recently bookmarked or reviewed by followed users. Even 3 cards with "Saved by @username" attribution would activate the social layer.
**Why you'd want to do this:** Social discovery creates a second reason to return — not just "what's trending" but "what are people I trust eating."
**The tradeoff:** Requires real follow graph data and per-user computation; adds a server-rendered query that could slow TTFB (time to first byte, when the server starts sending the page) if not cached, and is wasted screen space for users with no follows.
(effort: L)
