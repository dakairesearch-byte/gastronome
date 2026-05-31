# the-diner — RE-SWEEP v3

**Verdict:** The "decide in one tab" pitch is real and the score is now trustworthy. But the page can't answer the two questions that actually decide tonight — *Are they open? Can I get a table?* — so it still loses the last mile to Google Maps/OpenTable.

## Top 5

**1. No hours / "Open now" / reservations anywhere [STILL-OPEN] [P0] [L]**
- What: Detail page actions are only Get Directions / View on Maps / Website (`restaurants/[id]/page.tsx:10` imports MapPin/Phone/Globe only; grep finds no `opening_hours`, `Open now`, `Reserve`, `Resy`, `OpenTable`). restaurant-desktop.png shows no hours strip.
- Why: "Where should I go *tonight*" needs open-now + book-a-table. Without them I leave for OpenTable to finish the job.
- Do: Add an "Open now / closes 11pm" line + a "Book" button (Resy/OpenTable deep link) to the hero/map card.
- Why you'd want to: I'd actually book from here instead of treating Gastronome as a glorified bookmark.

**2. Score has no review-count anchor [NEW] [P0] [S]**
- What: Hero shows "8.1 / 10 · 2 sources" (rest_realtop.png) with no total review count beside it; counts hide faintly in "By the Numbers."
- Why: Maps' trust signal is "4.4 (3,812)". "8.1 from 2 sources" reads thinner — a high score on few reviews looks shakier than it is.
- Do: Append aggregate review volume to the hero, e.g. "8.1 · based on 4,300+ reviews."
- Why you'd want to: I trust a number more when I see how many people stand behind it.

**3. "Every rating source" promise vs "2 sources" reality [NEW] [P1] [M]**
- What: Home pitches 7 sources (page.tsx:139-141); JoJo's score is built from just Google+Yelp (rest_realtop.png; tooltip lists only those). Michelin shows as a separate pill, excluded by design (`GastronomeScoreBadge.tsx:73-76`).
- Why: A 1-star Michelin spot showing "2 sources" feels under-covered and slightly over-promised.
- Do: Reframe to "2 of 7 sources rated this" or list which sources are missing; don't let the flagship look thin.

**4. Signature Dishes empty on the marquee restaurant [STILL-OPEN] [P1] [M]**
- What: JoJo shows "Menu coming soon" (rest-top.png) — the example everyone opens has no dishes.
- Why: Dish intel is the one thing Maps/OpenTable lack; an empty state on the hero restaurant kills the differentiator.
- Do: Backfill dishes for flagship/Michelin restaurants first, or feature a restaurant that has them.

**5. Hero score buried below the fold on mobile [STILL-OPEN] [P1] [S]**
- What: On home-mobile.png the score/value-prop sits under a tall photo+breadcrumb stack; rest-mobile.png pushes "By the Numbers" well down.
- Why: Mobile is where I decide on the move; the trust payload should be the first thing, not after scrolling.
- Do: Tighten mobile hero; surface score + open-now in the first viewport.

## Quick wins
- Show review-count next to the 8.1 (see #2).
- Add "Open now" pill — even pulling Google's `opening_hours` would do it.
- Similar-Restaurants cards show Google/Yelp/Michelin badges (rest-top.png) — mirror that richer badge row on the *subject* restaurant's own hero; it currently looks plainer than its neighbors.
- Home: make the search box look like an input (it's a styled `<Link>`, page.tsx:143) — add a cursor/placeholder feel so I trust I can type.
- Label the score color/scale (what's a "good" 8.1 vs 6.0?).

## Bigger bets
- **Booking + open-now layer.** Resy/OpenTable/Google hours integration converts Gastronome from research tool to decision tool — the gap that keeps me on OpenTable.
- **"Decide for me tonight" mode.** Open-now + near-me + your saved-cuisine, one tap from home. Maps can't blend critic accolades; lean into it.

## Alarming
- The app that aggregates 7 sources shows its hero restaurant with "2 sources" and an empty dish list — the two headline promises (breadth, dishes) both visibly under-deliver on the very first restaurant a new diner opens (rest_realtop.png, rest-top.png).
