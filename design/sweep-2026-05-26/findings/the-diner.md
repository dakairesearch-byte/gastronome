# the-diner

**Lens:** A serious home diner asking "where do I eat tonight?" — does this page beat Google Maps?
**Reviewed:** `design/sweep-2026-05-26/screenshots/home-desktop.png`, `src/app/page.tsx`, `src/components/Navigation.tsx`.

## Top 3 findings

1. [P0] **What's wrong:** There is no search bar, no city selector, and no "near me" anywhere on the home screen (screenshot top half; `page.tsx` has zero search element; `Navigation.tsx:12-17` nav is Home/Explore/Community/Profile only). "Suggestions" silently pins to New York (`page.tsx:14`) with no label saying so.
   **Why it matters:** I came here to answer "where tonight?" — within 5 seconds I can't type a neighborhood, cuisine, or restaurant name. I will bounce to Google Maps. If I'm in Miami, the NYC suggestions are actively misleading.
   **What to do:** Put a prominent search input + city chip at the top of the page (above Suggestions). Show the active city next to "Suggestions" ("Suggestions in New York · change").
   **Why you'd want to do this:** This is the single biggest reason a diner abandons. Search is the front door of every competing app.
   (effort: M)

2. [P0] **What's wrong:** The Suggestion cards (screenshot rows 1-2) show only a star icon and the cuisine tag — no rating number, no price tier, no neighborhood, no "open now," and no source attribution. The whole product premise is "aggregated trust from Michelin/Eater/Google/Yelp" and none of that appears on the discovery surface.
   **Why it matters:** I cannot tell why Jean-Georges is being suggested over Tuhka. With no rating, price, or accolade badge, the grid feels like random Unsplash tiles. That is exactly the trust signal Yelp/Google already give me — Gastronome's whole edge disappears.
   **What to do:** On each `SuggestionCard`, surface aggregate rating (e.g. "4.6"), price ($-$$$$), neighborhood, and at least one source/accolade chip (Michelin star, Eater 38, etc.) if present.
   **Why you'd want to do this:** It's the differentiator. Without it there is no reason to use Gastronome instead of Maps.
   (effort: M)

3. [P1] **What's wrong:** "Recent Searches" and "Your Favorites" sit empty with grey copy (screenshot mid-page) for a logged-in user who hasn't done anything yet, and the "Saved Collections" tiles below are hardcoded placeholders that link to filtered Explore views (`page.tsx:20-53`) — not actually "saved" by me.
   **Why it matters:** Three of the five home sections feel broken or fake on first visit. "Saved Collections" containing things I never saved erodes trust quickly.
   **What to do:** Rename the placeholder section "Editor's Picks" or "Collections" (it is not "Saved"), and merge the two empty states into one helpful "Start exploring" CTA until the user has data.
   **Why you'd want to do this:** Honest labels + fewer dead zones above the fold makes the page feel curated rather than half-built.
   (effort: S)

## Quick wins
- **What's wrong:** Logo is a 96x96 JPG (`Navigation.tsx:62-68`) — looks like a placeholder thumbnail with visible bounding box.
   **Why it matters:** Cheapens the entire "Michelin-grade" positioning in the first second.
   **What to do:** Replace with the wordmark SVG used in the footer.
   **Why you'd want to do this:** Free credibility uplift.
- **What's wrong:** The page label reads "CURATED SELECTION / Suggestions" but the data is algorithmic 7-day trending (`page.tsx:62-66`).
   **Why it matters:** "Curated" implies human editors; trending is the opposite. Diners notice.
   **What to do:** Use "Trending This Week" or "Popular Right Now."
   **Why you'd want to do this:** Accuracy = trust.
- **What's wrong:** No price tier ($, $$, $$$, $$$$) anywhere on the home page.
   **Why it matters:** Budget is the #2 filter for "where tonight?" after cuisine.
   **What to do:** Add a price glyph to each `SuggestionCard`.
   **Why you'd want to do this:** Lets me triage 8 cards in 3 seconds.

## One bigger bet
- **What's wrong:** Home assumes I want to browse. A serious diner usually arrives with intent ("Italian, West Village, tonight, 2 people").
   **Why it matters:** A browse-first home is a magazine; a search-first home is a tool. Tools win for utility apps.
   **What to do:** Lead with a chunky "Find a restaurant" hero (city + cuisine + when), push Suggestions below.
   **Why you'd want to do this:** Converts curiosity visits into task completions, which is what brings people back weekly.
   **The tradeoff:** Loses the editorial, magazine-y first impression that distinguishes Gastronome visually from Yelp.
   (effort: L)

## Alarming
Suggestions silently default to New York for every user globally — a Miami diner sees NYC restaurants without warning.
