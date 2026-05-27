# Ranking Visualization — Findings
Specialist: ranking-visualization | Sweep: 2026-05-26-v2

---

## Top 5 Findings

**F1. The trending score is invisible — rank position has no meaning the user can interrogate.**
The Top 10 Trending list shows position numbers 1–10 and Google/Yelp raw ratings, but the *trending score* — the actual value that determines order — is never surfaced. A user cannot tell whether #1 has a score of 12 and #2 has 11.99, or whether the gap is enormous. The `trending_score` and `trending_counts` (videos, reviews, photos) are computed and attached to each `TrendingRestaurant` object (`trending.ts:35–39`) but discarded before reaching the template.
- Why it undermines credibility: users can see that #3 has a 4.7 Google rating and #4 has a 4.8 Google rating, which directly contradicts the rank order — because trending is engagement-based, not rating-based. This looks like a bug.
- Cite: `Top10Trending.tsx:294–296` (ratings rendered, score not), `trending.ts:35`

**F2. "Trending" and "Top-rated" look identical to the user — no signal differentiates the ordering logic.**
On `explore-desktop.png` the section is titled "Top 10 Trending" but the list rows show only Google and Yelp numeric ratings. No visual affordance (a flame icon, a velocity arrow, a "↑3 this week" chip) distinguishes a trending list from a sorted-by-rating list. The cities-newyork view (`cities-newyork-desktop.png`) also renders restaurants as `RestaurantCard` with no ordering label at all, leaving the sort order entirely implicit.
- Cite: `Top10Trending.tsx:281–285` (only "Top 10 Trending" header text), `RestaurantCard.tsx` (no rank or trend indicator on compact variant)

**F3. The algorithm's input signals contradict what users would expect "trending" to mean.**
Weights are `review: 5, video: 3, photo: 1` (`weights.ts:13–18`). A restaurant with 1 new user review outweighs one with 2 new videos. This is defensible but surprising — users will assume TikTok virality drives a trending list. No label, tooltip, or "How we rank" link appears anywhere in the UI to explain this.
- Cite: `weights.ts:12–18`, `explore-desktop.png` (section header, no explainer link)

**F4. Cities page ranks cities by restaurant count, not any quality signal — and the sort order is undisclosed.**
`cities-desktop.png` shows New York (519) → LA (265) → Chicago (252) and so on. This is sorted by `liveCount` (`cities/page.tsx:140–143`), which reflects data coverage, not prestige, dining scene quality, or aggregate rating. A user landing on this page naturally reads the order as "best city first." The average rating badge (Avg 4.5 on every city) provides no differentiation because all cities cluster within 0.1 points.
- Cite: `cities/page.tsx:140–143`, `cities-desktop.png`

**F5. Recent feed has no ranking at all — it is purely chronological with no quality gate.**
`recent-desktop.png` shows hundreds of items in reverse-chronological order with no score, no quality threshold, and no way to distinguish a newly-added restaurant with a 3.1 Google rating from one with a 4.9. The section header says "What's new" but offers no path to "What's new and worth caring about." A user who discovers the app via Recent has no reliable quality signal to act on.
- Cite: `recent/page.tsx:61` (`fetchRecentEvents` with no quality sort), `recent-desktop.png`

---

## 5 Quick Wins

**QW1. Add a "Why trending?" tooltip to the Top 10 header.**
One `<InfoIcon>` button next to "Top 10 Trending" opening a tooltip: "Ranked by new reviews, videos, and photos added in the last 30 days — not by star rating." Zero new data fetching required.
- Cite: `Top10Trending.tsx:281`

**QW2. Show event counts as a micro-badge on each trending row.**
The `TrendingRestaurant` type already carries `trending_counts: { videos, reviews, photos }`. Render a compact "3 new reviews" or "🎥 5 videos" label on the list row — this instantly explains why the rank differs from the rating order.
- Cite: `Top10Trending.tsx:292` (rank rendered, counts discarded), `trending.ts:47–51`

**QW3. Label the filtered explore lists with their sort dimension.**
When a user navigates to `/explore?accolade=hidden_gems`, the result grid renders `RestaurantCard` items with no indication they are sorted by `google_rating DESC` (`explore/page.tsx:350–353`). A one-line "Sorted by Google rating" label above the grid costs nothing and stops the order from looking arbitrary.
- Cite: `explore/page.tsx:346–354`

**QW4. Differentiate the rank circle color at #1 to signal the top position visually.**
All 10 rank circles use the same `var(--color-surface-alt)` background (`Top10Trending.tsx:326`). A gold or distinct accent on rank 1 (and optionally 2–3) communicates podium logic at a glance, which is standard for any ranked list.
- Cite: `Top10Trending.tsx:321–330`

**QW5. Cities page: sort by avg rating as primary tiebreaker, or add a sort toggle.**
All cities have restaurant counts that correlate with data coverage, not with dining quality. Adding a "Sort by: # restaurants / avg rating" toggle (`cities/page.tsx`) would let users discover which city has the highest-rated dining scene — currently that answer is buried inside each city page.
- Cite: `cities/page.tsx:140–143`

---

## 2 Bigger Bets

**BB1. "Why is #3 above #4?" — a score breakdown panel on hover/tap.**
When a user hovers a trending row, show a slim flyout with: trending score (normalized), event breakdown (N reviews × 5 + N videos × 3 + N photos × 1 = raw score), and the 30-day window label. This makes the algorithm legible and defensible. The data is already available on `TrendingRestaurant` — the work is purely UI. At scale this becomes the proof that Gastronome's ranking is more sophisticated than a raw Google rating sort, which is the product's core differentiation claim.
- Cite: `trending.ts:35–39` (score + counts on the object), `weights.ts:12–18` (weights to display)

**BB2. Introduce a "Trending Score" column or badge on RestaurantCard for city/explore grids.**
The compact `RestaurantCard` (`RestaurantCard.tsx`) currently shows source ratings (Google, Yelp, Infatuation) but no trending signal. Anywhere Gastronome chooses to rank by trending, the card should carry a visible "↑ Trending" or normalized score badge — otherwise the ordered list looks exactly like a rating sort. This requires passing the score through from the parent page query, which doesn't currently join trending data for the cities-newyork or filtered-explore grids. This is a meaningful architecture extension but it is the core differentiator made visible.
- Cite: `RestaurantCard.tsx:81–132` (no trending indicator in either variant), `cities/[slug]/page.tsx` (restaurants fetched by `google_rating` sort with no trending join)

---

## Alarming

The Explore page falls back to `google_rating DESC` to pad the Top 10 when fewer than 10 restaurants have a non-zero trending score (`explore/page.tsx:199–209`). This means ranks 7–10 may be rating-sorted restaurants silently mixed into a trending-branded list with no visual seam. A user who trusts the "Trending" label is receiving data that does not meet that criterion. The fallback is pragmatic but it should either be labeled ("Also highly rated") or the minimum score threshold should be raised rather than mixing paradigms invisibly.
- Cite: `explore/page.tsx:195–209`
