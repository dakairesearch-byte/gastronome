# the-critic — RE-SWEEP v3

**Lens:** Does Gastronome earn the credibility of Michelin / Eater / The
Infatuation — a publication with a point of view — or is it a tasteful data
dump? **Reviewed:** restaurant-desktop/-mobile, home-desktop,
cities-newyork-desktop; `restaurants/[id]/page.tsx`, `lib/score.ts`,
`GastronomeScoreBadge.tsx`, `AccoladesBadges.tsx`.

The big v2 wounds are stitched: the Maps API error is gone, dishes render,
the score exists. Progress is real. But the new Gastronome Score has a
credibility crack, and the page still has no editorial voice.

## Top 5 findings

1. **[NEW] [P0, M] Score is named for the product but driven by its two
   weakest sources.** *What's wrong:* JoJo (1 Michelin star) shows **8.1 /
   10 · 2 sources** (restaurant-desktop hero); that 8.1 is just Google 4.3
   and Yelp 3.7 blended (`score.ts:22-27,107-109`) — the critic-grade
   sources (Infatuation, Michelin) are absent, yet the number reads as a
   verdict. *Why it matters:* a real critic trusts Google/Yelp least; an
   aggregator whose flagship number is consumer-crowd noise undercuts the
   whole pitch. *What to do:* surface source identity inline ("8.1 · from
   Google + Yelp") and visually flag editorial-light scores; consider a
   confidence dot. *Why you'd want to:* a number you can defend in front of
   Pete Wells, not one that collapses when he asks "based on what?"

2. **[STILL-OPEN] [P1, M] Accolade badges still cite no inspector, no
   quote.** *What's wrong:* the Michelin chip now appends a year ("Michelin
   Star '24", `AccoladesBadges.tsx:67`) — good — but there's still no "cited
   for…" line or designation context (restaurant-desktop banner). *Why it
   matters:* a badge without provenance is name-dropping, not evidence; it
   borrows Michelin's authority without showing the receipt. *What to do:*
   one provenance line under each badge from `restaurant_michelin_history`.
   *Why you'd want to:* turns decoration into citation — the difference
   between Eater and a scraper.

3. **[STILL-OPEN] [P1, L] City page is still a database export, not a
   guide.** *What's wrong:* cities-newyork-desktop opens with a wall of ~600
   identical rows; no "Editor's 10," no neighborhood story
   (`cities/[slug]/page.tsx` grid). *Why it matters:* Eater opens with a 38;
   Michelin with a starred list. Opening with *everything* means choosing
   *nothing* — and choosing is the job. *What to do:* a curated "The
   Critics' Picks" rail above the grid. *Why you'd want to:* density signals
   "list"; curation signals taste.

4. **[STILL-OPEN] [P1, S] "The Story" is one generic marketing sentence.**
   *What's wrong:* JoJo's Story is a single italic line of PR prose
   ("Elegant townhouse restaurant by Jean-Georges…", restaurant-desktop;
   `page.tsx:850-862`). *Why it matters:* a one-line "Story" under a
   serif-heavy header reads as a stub and undermines the editorial framing.
   *What to do:* require ≥2 sentences with source attribution, or drop the
   header below that floor. *Why you'd want to:* publications don't ship
   stubs labeled "Story."

5. **[RESOLVED] [P0] Sourceless hero rating fixed.** The old bare "4.3 ★"
   is replaced by a labeled Gastronome Score with a methodology popover
   (hero; `GastronomeScoreBadge.tsx:63-96`). The per-source receipts live in
   "By the Numbers" below. This was my #2 v2 P0 — properly closed (modulo
   finding #1's weighting concern).

## Quick wins (≤5)

1. **[RESOLVED]** Maps API error gone — static neighborhood tile + Get
   Directions now (`page.tsx:924-1004`). My v2 "Alarming." Confirmed fixed.
2. **[RESOLVED]** "What Reviewers Mention" → "Signature Dishes" with
   per-dish source/rating chips (`page.tsx:543`). My v2 QW#1.
3. **[STILL-OPEN] [S]** Popover says "every rating source we have" but only
   2 of 4 fed JoJo — add "(2 of 4 available)" so absence is honest, not
   hidden (`GastronomeScoreBadge.tsx:73-77`).
4. **[STILL-OPEN] [S]** "Similar Restaurants" still has no relationship cue
   (restaurant sidebar) — add "Same cuisine / Same chef" tag.
5. **[NEW] [S]** Score has no recency signal — a stale 8.1 looks as fresh
   as a live one. Add "as of <month>" near the badge.

## Bigger bets

1. **[STILL-OPEN, L]** Editorial voice. Still zero point of view anywhere —
   every screen is a layout problem solved tastefully. Add a 50–150-word
   "Critic's Note" above "By the Numbers" for top restaurants. *Tradeoff:*
   ongoing editorial maintenance + liability the pure-aggregator stance
   avoids.
2. **[STILL-OPEN, L]** `/methodology` page. The score popover is a start,
   but trending rank ("engagement, 30-day window") is still undefended. Ship
   a methodology page covering both score weights and trending signals.
   *Tradeoff:* publishing weights invites gaming; locks you to a versioned
   formula.

## Alarming

**[REGRESSION risk]** Weighting Google+Yelp at 0.5 of a 4-source blend
means a one-Michelin-star room can score *below* a hyped neighborhood spot
with thinner credentials. The score is defensible as arithmetic but not yet
as *editorial judgment* — fix the framing (finding #1) before this number
becomes the brand.
