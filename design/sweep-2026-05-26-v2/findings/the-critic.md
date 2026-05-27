# the-critic

**Lens:** Does this aggregator earn the credibility of Michelin / Eater / The Infatuation, or does it just dump their data without a point of view?
**Reviewed:** screenshots (restaurant, home, cities-newyork, explore) + `src/app/restaurants/[id]/page.tsx`, `src/app/page.tsx`, `src/app/cities/[slug]/page.tsx`.

## Top 5 findings

1. [P0] **What's wrong:** The JoJo page borrows Michelin's authority (a "Michelin Star" badge in the accolades banner) but never says *which year*, *how many stars*, or *what the Michelin inspector wrote*. The "Story" paragraph is generic marketing prose ("Elegant townhouse restaurant by Jean-Georges Vongerichten..."), not a critic's take. (`restaurant-desktop.png`; `restaurants/[id]/page.tsx:730-775`).
   **Why it matters:** A reader trusts Eater because Eater has a voice. Showing a Michelin badge with no inspector citation, year, or quote is the aggregator equivalent of name-dropping.
   **What to do:** Under every accolade badge, render a one-line provenance string: "1 Michelin Star · 2024 · cited for 'refined French technique'". Pull from `restaurant_michelin_history` (already exists per CLAUDE.md).
   **Why you'd want to do this:** Without provenance, the badge is decoration; with it, the badge is evidence. Journalists will stop dismissing this as a scraper. (effort: M)

2. [P0] **What's wrong:** The headline number on the JoJo page is "4.3" (Google) next to "3.7" (Yelp) in a "Ratings Dashboard" — but there is no unified score, no explanation of why the two disagree, and no editorial judgment about which to trust. Yelp is famously skewed; Google is famously inflated. The page shows the disagreement and shrugs. (`restaurant-desktop.png`; `restaurants/[id]/page.tsx:447-491`).
   **Why it matters:** The whole pitch of the app (per onboarding pane 2: "unified aggregator") collapses if the unification is just two numbers in a row. The user still has to do the synthesis the app promised to do.
   **What to do:** Add a single "Gastronome Score" above the dashboard with a tooltip explaining the weighting (e.g., "Weighted blend of Google, Yelp, Infatuation, normalized to a 10-point scale; weights favor sources with ≥100 reviews"). Even an arithmetic mean with disclosure beats no number.
   **Why you'd want to do this:** The Infatuation has "9.1" because someone owns the number. Gastronome owns nothing right now. (effort: M)

3. [P1] **What's wrong:** The NYC city page (`cities-newyork-desktop.png`) is a 600+ row alphabetical/trending list rendered as a wall of identical mini-cards with red accolade chips. There is no editorial selection — no "10 Best in NYC Right Now," no neighborhood story, no critic's pick. It's a database export. (`cities/[slug]/page.tsx:310-338`).
   **Why it matters:** Eater's NY city page opens with a Heatmap and a 38. Michelin opens with a starred list. Gastronome opens with everything, which means it has chosen nothing — and choosing is the job.
   **What to do:** Above the grid, add a "The Editor's 10" rail (curated, server-side hand-pick or trending+accolade hybrid) and a "By Neighborhood" rail (one tile per neighborhood with one restaurant featured). Push the full grid below.
   **Why you'd want to do this:** First-impression density signals "list" not "guide." Curation signals taste. (effort: L)

4. [P1] **What's wrong:** The home page leads with "Suggestions" — eight unranked, unexplained tiles. No "Why we picked this," no "Trending because," no editorial framing. It's the same logic as Explore's Top 10 Trending but without the rank numbers, so it reads as random. (`home-desktop.png`; `page.tsx:62-90`).
   **Why it matters:** A homepage is a promise about what kind of publication this is. "Suggestions" with no reasoning promises an algorithm, not a guide.
   **What to do:** Rename "Suggestions" to "Trending This Week in New York" (it already is, per `window: '7d'`, city `New York`). Add a one-line reason per card (e.g., "↑42% mentions this week" or "New Michelin star").
   **Why you'd want to do this:** Naming what the algorithm is doing turns opacity into editorial transparency. (effort: S)

5. [P1] **What's wrong:** The Explore page's "Top 10 Trending" list shows ranks 1-10 with rating numbers next to each, but the map beside it has black unlabeled dots (no rank numbers on the pins), so the spatial story is broken. And the entire right column is dominated by a Google Maps API error message. (`explore-desktop.png`).
   **Why it matters:** A trending list with a broken map is worse than no map — it implies the product is held together with tape. A skeptical reader will close the tab.
   **What to do:** (a) Number the map pins to match the list. (b) Hide the map entirely when the API key is missing/failing; do not render a 400px-wide error box to end users.
   **Why you'd want to do this:** Visible infrastructure failures destroy credibility faster than missing features. (effort: S for hide, M for numbered pins)

## Quick wins (max 5, no severity)

1. **What's wrong:** "What Reviewers Mention" header on JoJo page is vague (`restaurants/[id]/page.tsx:526`).
   **Why it matters:** Reads as a category, not a finding.
   **What to do:** Rename to "Signature Dishes" or "Most-Mentioned Dishes" and lead with the top dish in larger type, not a chip cloud.
   **Why you'd want to do this:** Critics name dishes, not "mentions." (effort: S)

2. **What's wrong:** "The Story" on JoJo is one italicized sentence (`restaurant-desktop.png`).
   **Why it matters:** Looks like placeholder copy or a stub.
   **What to do:** Either pull a 2-3 sentence editorial blurb from the cited source (Michelin, Infatuation) with attribution, or remove the section header when content is <2 sentences.
   **Why you'd want to do this:** A one-line "Story" undermines the framing of the whole page. (effort: S)

3. **What's wrong:** Saved Collections tiles on home ("Date Night," "Quick Lunch") link to cuisine filters, not to actual curated lists (`page.tsx:20-53`).
   **Why it matters:** "Date Night = French cuisine filter" is reductive and slightly absurd.
   **What to do:** Either build real hand-curated collections behind these tiles or remove the section until you have them.
   **Why you'd want to do this:** Fake collections poison real trust in everything else labeled "curated." (effort: M)

4. **What's wrong:** JoJo's hero shows "4.3" with no source label inline (`restaurant-desktop.png`).
   **Why it matters:** Ambiguous attribution at the top of the most important page.
   **What to do:** Append "Google" or the dominant source to the hero rating: "4.3 ★ Google · 2,341 reviews."
   **Why you'd want to do this:** Sourceless numbers are the cardinal sin of aggregation. (effort: S)

5. **What's wrong:** "Similar Restaurants" sidebar on JoJo shows three other Jean-Georges properties (Alain Ducasse, Le Restaurant, Maison Close) styled identically with no relationship cue (`restaurant-desktop.png`).
   **Why it matters:** Reader can't tell why these are "similar" — same cuisine, same chef, same neighborhood?
   **What to do:** Add a tiny relationship tag per card ("Same cuisine," "Same neighborhood," "Also 1 Michelin star").
   **Why you'd want to do this:** Explains the recommendation logic without a tooltip. (effort: S)

## Bigger bets (max 2)

1. **What's wrong:** No editorial voice anywhere in the product. Every screen reads as a data layout problem solved tastefully, not as a publication.
   **Why it matters:** The app's stated competition (Michelin, Eater, Infatuation) is *editorial first, data second*. Gastronome inverts this and competes only on data breadth, which Google already wins.
   **What to do:** Add a thin editorial layer: one human-written "Critic's Note" field per restaurant (50-150 words), surfaced above the Ratings Dashboard when present. Start with the top 100 restaurants per city; backfill via freelance contributors or LLM summarization of source reviews with explicit attribution.
   **Why you'd want to do this:** Owns a defensible position no scraper can replicate. (effort: L)
   **The tradeoff:** Editorial content requires ongoing maintenance (corrections, refreshes, fact-checks) and exposes the brand to claims it didn't make — a liability the pure-aggregator stance currently avoids.

2. **What's wrong:** Ranking algorithm is invisible and undefended. The cities page footer line ("ranked by trending engagement, 30-day window") is the only hint, and "engagement" is undefined. (`cities/[slug]/page.tsx:288-292`).
   **Why it matters:** A journalist asking "why is this restaurant #3?" gets no answer. That's the question that kills aggregator credibility (Yelp lost it years ago).
   **What to do:** Build a `/methodology` page explaining the trending formula (signals, weights, decay), and link to it from every "trending" or "ranked" label. Show the contributing signals on a restaurant page expandable panel ("Why #3? Mentioned in 4 TikTok videos this week, +2 Michelin stars retained, Google rating stable at 4.5").
   **Why you'd want to do this:** Transparency is the moat against the "this is just a scraper" critique. (effort: L)
   **The tradeoff:** Publishing weights invites SEO/restaurant-side gaming and locks you into the formula (changes need to be versioned and explained).

## Alarming

Google Maps API error message is rendered to end users mid-page on the restaurant detail page and on Explore — production-visible infrastructure failure (`restaurant-desktop.png` right column; `explore-desktop.png` map area).
