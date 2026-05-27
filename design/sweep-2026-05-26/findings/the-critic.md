# the-critic

**Lens:** A professional critic should feel this page argues a point of view about JoJo; instead it reads like a scoreboard a data team would email at 5pm.
**Reviewed:** `design/sweep-2026-05-26/screenshots/restaurant-desktop.png`, `src/app/restaurants/[id]/page.tsx`.

## Top 3 findings

1. **[P0] What's wrong:** The whole page tells the reader *what numbers exist* but never *what to think*. The lead element is "Ratings Dashboard" with Google 4.3 and Yelp 3.7 (`page.tsx:470`) — no synthesis, no critic quote, no "go for the X, skip the Y." The Michelin star and Jean-Georges pedigree are buried in a thin tan banner (`page.tsx:425-437`) and a one-line italic blurb at the bottom (`page.tsx:761`).
   **Why it matters:** A diner deciding between JoJo and Le Bernardin doesn't need a spreadsheet — they need a verdict. Without one, Gastronome is just a slower Google.
   **What to do:** Add an "Editor's Take" block at the top — 2–3 sentences synthesizing the aggregate ("Michelin-starred Jean-Georges townhouse; critics rate the room above the cooking; book for the pre-theater prix fixe").
   **Why you'd want to do this:** This is the entire competitive moat vs Google Maps. Without an editorial layer, there is no reason to be Gastronome instead of a Yelp tab.
   (effort: M — needs a generation prompt + cache column, not a new pipeline)

2. **[P0] What's wrong:** The aggregate that defines the product — *Gastronome's* unified rating — is nowhere on this page. The hero shows a single 4.3 star (`page.tsx:364-374`) which is just Google's number relabeled (`avgRating = google_rating ?? yelp_rating`, line 286). The "dashboard" then shows the same Google number a second time alongside Yelp 3.7. There is no Gastronome score, no weighting, no confidence band.
   **Why it matters:** The pitch is "ratings from every major source unified into one." The page does not deliver the one thing in the name. A skeptical journalist would ask "so what does Gastronome think?" and there is no answer.
   **What to do:** Replace the lone hero star with a single Gastronome score (e.g. "8.4 / 10 · 4 sources") with a tooltip showing the weighting. Keep the per-source dashboard below as the receipts.
   **Why you'd want to do this:** Gives the product a defensible primary metric, makes the dashboard feel like evidence instead of the headline, and creates the share-worthy number for social previews.
   (effort: M — formula exists conceptually; needs UI + a defensible weight doc)

3. **[P1] What's wrong:** The Michelin star — the single highest-credibility signal in fine dining — is rendered as a small pill in a beige strip below the hero (`page.tsx:425-437`), visually quieter than the Instagram gradient button (`page.tsx:411`). Yelp 3.7 then sits in the dashboard at the same visual weight as Google, undermining the Michelin signal further by mixing tiers.
   **Why it matters:** A 1-star Michelin restaurant being out-shouted by a magenta Instagram chip and a mediocre Yelp score reads as having no taste. Critics will notice immediately.
   **What to do:** Promote accolades into the hero (Michelin glyph + "1 Star · 2026" next to the name), and visually demote Yelp in the dashboard for fine-dining tier restaurants (smaller cell, or move to a "Also rated" row).
   **Why you'd want to do this:** Signals to readers that Gastronome has a hierarchy of trust — the table-stakes credibility move for any aggregator pretending to editorial judgment.
   (effort: S for hero accolades; M if you tier the dashboard by restaurant class)

## Quick wins

- **"On Social" with three TikToks is not a section, it's a placeholder.** The screenshot shows one visible video and "0 reviews"-style emptiness in the right column (`page.tsx:682-728`). Either hide the header until ≥3 videos load, or fold a single video into the dashboard. An almost-empty section signals a dead app.
  (effort: S)

- **"What Reviewers Mention" is unfindable in this screenshot** despite being the most novel feature in the codebase (`page.tsx:493-679`, dish chips with sentiment/source). If it didn't render for JoJo because dishes were empty, the empty state should be a hand-curated "What to order" stub — that section is the editorial differentiator and should never just vanish.
  (effort: S — add a thin "Coming soon: what diners reorder" line)

- **"View on Google Maps" is the only call-to-action on the page** (`page.tsx:836`). There's no "Reserve," no "Call," no "Add to list" above the fold. Phone and website are 11px gray-on-black links (`page.tsx:381-385`). The page reads as research, not as a tool that helps someone book dinner tonight.
  (effort: S — promote a Reserve button using OpenTable/Resy deeplink when available)

## One bigger bet

- **Lead with a critic-style review headline, not "Ratings Dashboard."** Replace the H2 "Ratings Dashboard" / "The Story" pairing (`page.tsx:469`, `page.tsx:744`) with a single editorial headline structure: a dek ("The Jean-Georges townhouse that out-charms its cooking"), then the verdict paragraph, then the receipts (dashboard, dishes, social) underneath as supporting evidence. This is the Eater / Infatuation visual grammar.
  **The tradeoff:** You now owe every restaurant a piece of editorial — at scale that means LLM-generated copy with all the legal/quality risks that come with calling a restaurant "out-charmed by its cooking." You will need a review workflow and a "generated from public reviews" disclosure to stay honest.
  (effort: L)

## Alarming

A live Google Maps "Reject API key" error panel is rendered in the right rail of the screenshot — the map sidebar is currently broken in production.
