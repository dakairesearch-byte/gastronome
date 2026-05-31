# Ranking Visualization — v3 Re-Sweep

Lens: how rank/score is shown, methodology visibility, "why is #3 above #4?", Gastronome Score, Top-10 trending captions.

---

## Status tags

- [RESOLVED] — v2 finding fixed
- [REGRESSION] — fix made something worse
- [STILL-OPEN] — v2 finding not yet addressed
- [NEW] — not previously flagged

---

## Top 5 Findings

### 1. [REGRESSION] Map pins are numbered but the map itself is still the broken API error panel — the real embed is worse than the fallback [P0] · Effort M

The explore-desktop screenshot shows the Google Maps embed iframe rendering a live API error: "Google Maps Platform rejected your request. This API is not activated on your API project." The pin hover/sync logic now works and the pins are numbered 1–10 (v2 P1 "number the pins" resolved), but the iframe underneath them is a white panel of red error text. The fallback SVG grid only renders when `embedSrc` is null (no key or no bounds), but `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` is evidently set — it just isn't authorized for the Maps Embed API. So the code now chooses the iframe path and renders the error rather than the graceful grid. The v2 P0 fix (hide the broken map) was applied to the restaurant detail page but the explore Top10Trending component hits the same failure independently.

Source: explore-desktop.png (right panel, top half); `Top10Trending.tsx:541–545` — key fallback logic reads `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY || NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`, so a Places key triggers the iframe path.

### 2. [STILL-OPEN] Trending score value is never surfaced — "why is #3 above #4?" has no answer [P1] · Effort S

The `trending_score` (normalized, city-median-relative) is attached to every `TrendingRestaurant` but never rendered. The caption shows counts ("12 videos · 30d"), which is a meaningful step forward, but the relative score that actually determines rank ordering is invisible. A user seeing "Fili Gumbo Bar #1" with Google 4.4 and "Chama Mama #2" with Google 4.4 has no signal about why #1 beats #2. The score itself — even as a simple "Trending score: 2.4×" or a relative label — would close the loop. v2 synthesis Bigger Bet #6 asked for a "Why is #3 above #4?" flyout; the counts caption addresses the ingredient but not the result.

Source: `Top10Trending.tsx:47–48` (type carries `trending_score`); rendered nowhere in the component.

### 3. [RESOLVED — but with a gap] "Also highly rated" labels fallback rows, but the label appears even when counts are all zero for trending rows [P1] · Effort S

The alarming v2 finding — fallback rating-sorted rows silently mixed into the trending list — is addressed: rows without `trending_counts` get the italic "Also highly rated" label (lines 422–432). [RESOLVED] for the core concern. However, there is a new gap: when a restaurant has `trending_counts` but all three counts (videos, reviews, photos) are zero — possible when `allowZeroScores` is passed — the caption block at line 439 returns `null` and the row shows no signal at all: no "Also highly rated" label, no counts. It silently looks like a trending row with a missing caption. This edge case is low-probability but worth guarding.

Source: `Top10Trending.tsx:439` — `if (parts.length === 0) return null`.

### 4. [STILL-OPEN] Gastronome Score exists on restaurant detail but is completely absent from every list/grid surface [P1] · Effort M

`GastronomeScoreBadge.tsx` and `score.ts` ship the score and tooltip — strong work. On the restaurant detail page this resolves the v2 P0 "no unified number." But on every list surface (Top10 trending rows, CityRestaurantGrid cards, explore filtered grid), the number shown is still raw Google or Yelp ratings. The cities-newyork desktop and mobile screenshots show per-card ratings as "4.4" with no source label and no Gastronome Score. The Top10Trending right column shows Google G and Yelp icons with native /5 numbers — coherent, but still raw rather than synthesized. The methodology tooltip exists only where a user has already clicked into a restaurant. The list surfaces — the primary discovery layer — still present the un-unified data the aggregator promised to unify.

Source: `CityRestaurantGrid.tsx:66–79` (no score column); `Top10Trending.tsx:467–498` (Google + Yelp native ratings only); cities-newyork-desktop.png and cities-newyork-mobile.png.

### 5. [NEW] City page sort label says "ranked by trending engagement" but uses a 500-row alphabetical sample padded with trending — methodology claim is misleading [P2] · Effort S

`cities/[slug]/page.tsx` line 298 renders the string "ranked by trending engagement (30-day window)" when `trending.length > 0`. But the actual ordering is: trending restaurants first (in trending order), then the alphabetical remainder of the 500-row `.order('name', ascending: true)` pull (lines 89–91, 149–153). A user in the middle of the NYC list is reading alphabetical fallback rows with no visual seam and no label change. The cities-newyork-desktop screenshot shows 30 cards in a grid with no rank numbers or fallback labels — there is no way to tell where trending ends and alpha-sort begins. This is a milder version of the v2 "silent mixing" problem, now on city pages rather than explore.

Source: `cities/[slug]/page.tsx:149–153, 297–299`.

---

## Quick Wins (≤5)

1. **[RESOLVED] Trending caption per row** ("12 videos · 30d") — ships and renders. `Top10Trending.tsx:420–451`. Confirming resolved.

2. **[RESOLVED] "Also highly rated" label for fallback rows** — ships. `Top10Trending.tsx:422–432`.

3. **[RESOLVED] Numbered map pins** — 1–10 circles on both the list and the pins, hover-sync working. `Top10Trending.tsx:609`.

4. **Guard the zero-count caption gap** — when `trending_counts` is present but all three counts are 0, fall through to "Also highly rated" rather than `null`. One-line fix at `Top10Trending.tsx:439`: replace `return null` with `return <p ...>Also highly rated</p>`.

5. **Fix the Maps Embed key fallback order** — add a dedicated `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` env var (separate from Places) or check the key's authorized APIs before choosing the iframe path. Short-circuit to the SVG fallback when the key is only a Places key. `Top10Trending.tsx:541–545`.

---

## Two Bigger Bets

**A. Trending score transparency flyout ("Why this rank?")**
Add a small info button on each Top10 row that opens a one-line breakdown: "Trending score: 2.4× city median — 12 videos (×3), 3 reviews (×5), 1 photo (×1) in the last 30 days." This answers the "why #3 above #4?" question directly, turns the ranking from a black box into a defensible editorial statement, and uses data already computed in memory (`trending_score`, `trending_counts`, `WEIGHTS`). No new queries. Distinct from the Gastronome Score tooltip (quality) — this is a trending-momentum tooltip (recency). `Top10Trending.tsx` + `weights.ts`.

**B. Gastronome Score on list cards**
Compute `gastronomeScore()` server-side and pass it into `CityGridRestaurant` and the Top10 row's right-side cluster. On list cards, show it as "GS 8.4" in a small pill next to the accolade badges — immediately differentiates Gastronome from "just showing the Google rating." The score function is pure and cheap (`score.ts:65`); the bottleneck is adding the field to the Supabase select and mapping it through the two grid components. Would make the aggregator promise visible at every level of the product hierarchy, not just after the user clicks into a restaurant.

---

## Alarming

The Google Maps iframe error on Explore's Top 10 map panel (Finding #1) is the same class of failure that was the v2 P0 #1. The restaurant detail fix did not propagate to Top10Trending. Production users today see a white error box overlaid by floating numbered pins — the numbered-pin improvement (v2 P1) is now visible only as pins floating over an error message. This is arguably more visually jarring than the unlabeled-dot state it replaced, because the error text is prominent under the otherwise polished pin layout. Prioritize fixing the key check or switching to the SVG fallback before the numbered-pins improvement reads as a regression.
