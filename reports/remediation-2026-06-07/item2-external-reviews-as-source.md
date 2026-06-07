# Item 2 — Can `external_reviews` serve as a 2nd corroborating rating source for the Gastronome Score?

**Worker:** W1 (Score Acquisition) · **Date:** 2026-06-07 · **Mode:** READ-ONLY investigation
**Verdict: NO — `external_reviews` cannot serve as an independent corroborating source.**
It would not meaningfully fix the "98% of restaurants can't reach the 2-source tier" problem, and wiring it in as currently structured would silently **double-count Google**. Recommendation below is to leave `score.ts` untouched and instead pursue a genuinely independent source (Yelp backfill). **needsOwnerApproval = true** for any score.ts change.

---

## What the score actually needs

`src/lib/score.ts` reserves the elite band for restaurants that **multiple independent crowds agree on**. Mechanically, the gate is in the corroboration ceiling:

```ts
const ceiling = contributions.length >= 2 ? DUAL_SOURCE_CEILING /*9.9*/ : singleSourceCap /*~8.0–8.5*/
q = Math.min(q, ceiling)
```

A "source" is one of the four rating inputs: `google_rating`, `yelp_rating`, `infatuation_rating`, `beli_score`. `contributions.length` is the count of those that are non-null on the row. To lift a restaurant out of the ~8.0–8.5 single-source cap, it needs a **2nd genuinely independent** non-null rating. The catalog leans almost entirely on Google (Infatuation is empty, Beli near-empty, Yelp sparse), which is why ~98% sit at the single-source cap.

**Live source-coverage on the 3,278 OPERATIONAL restaurants:**

| sources present | restaurants |
|---|---|
| 0 sources (scoreless — Item 1) | 809 |
| exactly 1 source | 763 |
| 2+ sources (already corroborated) | 1,706 |

So the population that a 2nd source would *rescue* is the **763 one-source** rows (plus, secondarily, helping the 809 zero-source rows reach even one source — that's Item 1's job).

---

## What `external_reviews` actually contains

Schema (verified live, not from `database.ts`):

`external_reviews(id, restaurant_id, source TEXT NOT NULL, external_id, author_name, rating NUMERIC NULL, text, published_at NULL, fetched_at)`
`external_review_dish_mentions(id, review_id, restaurant_id, dish_name, dish_name_normalized, confidence, sentiment, dish_context, created_at)`

The decisive fact is what the `source` column means. It is **NOT** a rating platform (google / yelp / tripadvisor). It is the **search engine the review text was scraped through**, plus one bucket of actual Google review objects:

| `source` | rows | with `rating` | distinct restaurants | rating range | avg | has `published_at`? |
|---|---|---|---|---|---|---|
| `ecosia` | 13,774 | **0** | 1,398 | — | — | no |
| `google` | 9,328 | 9,298 | 176 | 1.00–5.00 | 4.44 | no |
| `startpage` | 418 | **0** | 42 | — | — | no |
| `mojeek` | 28 | **0** | 3 | — | — | no |
| **total** | **23,548** | **9,298** | 1,402 | | | |

Three of the four "sources" (ecosia / startpage / mojeek — 14,220 rows, 60% of the table) carry **no rating at all** — they're scraped review *text* used for dish-mention extraction, not scores. Only the `google` bucket has ratings, and those are **individual 1–5★ Google user reviews**, not an independent platform.

`external_review_dish_mentions` (21,613 rows) is purely a dish-extraction byproduct (dish name + sentiment + confidence). It contains **no rating signal** and is irrelevant to the score.

### `published_at` is NULL for every single row

There is **no usable date** anywhere in the table (`with_pub_date = 0` for all sources). Even if there were ratings, you could not recency-weight or freshness-gate them. Only `fetched_at` (scrape time) exists.

---

## Why aggregating the `google` ratings does NOT create a 2nd source

The 9,298 rated rows are Google reviews — the **same crowd** that already produces `restaurants.google_rating`. Proof: aggregate the per-restaurant average from `external_reviews` and compare it to the stored `google_rating`:

| metric | value |
|---|---|
| restaurants with rated ext-reviews | 174 |
| …that already have a stored `google_rating` | **174 (100%)** |
| …missing a stored `google_rating` | 0 |
| mean abs diff (ext avg vs stored google_rating) | **0.155** |
| avg of ext per-restaurant averages | 4.463 |
| avg of stored `google_rating` | 4.488 |

Every restaurant with rated external reviews **already has** the Google rating, and the aggregate **reproduces** it (within 0.16★, the expected gap between "avg of a sampled subset of reviews" and "Google's own published average"). Feeding this back in as a separate `contributions.push(...)` would mean the same Google crowd votes twice — it would trip the `contributions.length >= 2` ceiling on the strength of a single platform, which is exactly the thing the evidence-gate design exists to prevent. That is a **correctness regression**, not a fix.

### And it barely moves the coverage needle anyway

Even setting aside the double-count problem, how many one-source restaurants would gain a *nominally* second source from `external_reviews`?

| | restaurants |
|---|---|
| one-source operational rows that gain a 2nd (any-source) signal from ext-reviews | **2** |
| zero-source operational rows that gain any signal from ext-reviews | **0** |

Two restaurants. The 174 rated-review restaurants are essentially all already in the 2+-source cohort (they're the well-covered, high-traffic places that also got review-scraped). The long tail of 763 one-source and 809 zero-source restaurants is **not represented** in the rated subset of `external_reviews` at all.

---

## Recommendation

**1. Do NOT wire `external_reviews` into `score.ts`.** It is not an independent source; the only rated bucket is Google, which is already counted. Adding it would double-count one crowd and falsely promote ~Google-only restaurants into the corroborated tier. (Leaving score.ts unchanged per the gating rule — this would be a ranking change requiring an answered QUESTIONS.md gate.)

**2. The real fix for "98% can't reach the 2-source tier" is a genuinely independent source — Yelp.** `score.ts` already has full Yelp support (weights, Bayesian prior `m:350`, a dedicated `YELP_ANCHORS` percentile curve) wired and waiting; the column `yelp_rating` / `yelp_review_count` is just sparsely populated. Backfilling Yelp ratings for the 763 one-source (Google-only) operational restaurants would move them into the corroborated tier *correctly*, because Yelp is a different crowd on a different scale (the agreement penalty and separate anchors are designed for exactly this). This is the highest-leverage corroboration win available and is a clean SCRIPTED scrape (Yelp Fusion API `/businesses/match` + `/businesses/{id}` for rating+review_count), analogous to the Google backfill scripts. **This is a separate work item** (new external API + rate-limit budget = decision gate) and is flagged for the owner, not done here.

**3. Keep `external_reviews` for what it's good at.** The table's real value is the **review text** (for dish-mention extraction → `external_review_dish_mentions`, already in use) and as a *display* artifact ("recent reviews"). It should not feed the numeric score. If anything, the rated `google` subset could be used to **sanity-check / detect drift** in `restaurants.google_rating` (flag rows where the stored rating diverges >0.5 from the live sampled average), but that's a data-QA use, not a scoring source.

**4. Optional schema-hygiene note (not for score):** the `source` values (`ecosia`/`startpage`/`mojeek`/`google`) conflate "search engine used to find the review" with "review platform." If `external_reviews` is ever expected to hold true multi-platform ratings (yelp/tripadvisor/etc.), it needs a separate `platform` column distinct from `source`; today there is no way to tell a Yelp review from a Google one because non-Google rows have no rating and no platform tag. Flag for schema-guardian.

---

## Decision gate

- **action = investigated**, **needsOwnerApproval = true.**
- No DB writes were made (read-only).
- If the owner wants corroboration coverage improved, the approved path is **"backfill Yelp for the 763 Google-only operational restaurants"** (new scrape, new API budget — its own gated item), **not** "fold external_reviews into the score."
