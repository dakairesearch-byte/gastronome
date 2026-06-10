# Gate 4 — Trending Decay + Per-Source Caps Formula Change

**Date:** 2026-06-10
**Gate:** gate4
**Status:** awaiting owner decision
**Files touched (proposal only — never applied):** `src/lib/ranking/trending.ts`, `src/lib/ranking/weights.ts`
**Artifact:** `trending-decay.patch`

---

## 1. Context

`trending.ts` currently counts engagement events inside a flat rectangular window
(default: 7 days). Every event inside the window is weighted identically regardless
of age; every event outside the window is worth exactly zero. Two known bugs follow
directly from this design:

**Cliff-edge bug.** A restaurant with 3 videos from 6 days 23 hours ago scores
identically to one with 3 videos from 1 hour ago. At the window boundary the score
drops from non-zero to zero in a single batch cycle — visible as sudden "falls off
trending" behavior with no real-world cause.

**Backfill-spike bug (documented).** A pipeline run that backfills 40 TikTok videos
in one batch for one restaurant adds `40 * 3 = 120 pts` to that restaurant's raw
score. A legitimate organic restaurant seeing one new video per day for 5 days adds
`5 * 3 = 15 pts`. The backfill wins by 8x on a pure volume count even though its
signal has no recency gradient.

The ENGAGEMENT report (§3 "Supporting fixes") prescribes this fix as "small, gated,
high-value" and notes it as a prerequisite for the QFA blended ranker (Gate 5, not
yet proposed).

---

## 2. Live DB simulation (2026-06-10, project trwdqzsfgeydafojajbh)

### Video data shape

| Metro | Restaurants | Total videos | 7d-window videos | Distinct days of ingestion |
|-------|-------------|--------------|------------------|---------------------------|
| New York | 697 | 3,386 | 324 (June 8 batch, 131 restaurants) | Batch-lumped: April 13-30, May 4-13, June 1-2, June 7-8 |
| Austin | 294 | 972 | ~765 (June 8 batch) | Same pattern |

The `created_at` field on `restaurant_videos` records **pipeline ingestion time**,
not the original publish time of the TikTok/Instagram video. All videos arrive in
discrete batch runs; there is no organic daily drip at current volume.

### Quantitative bug illustration

| Scenario | Current score (7d rect, no cap) | Proposed score (decay + cap) |
|----------|--------------------------------|------------------------------|
| 40 videos ingested same day, ~1h ago | **120 pts** (40 × 3) | **15.9 pts** (log₂(41) × 3 × 2^(−1/72)) |
| 1 video/day for 5 days (ages 1d–5d) | **15 pts** (5 × 3, all in window) | **7.9 pts** (5 × log₂(2) × 3 × decaying weights) |
| 1 video/day for 5 days vs 40-same-day | Backfill wins **8×** | Backfill wins **2×** and decays away |

The per-day cap reduces the 40-video spike from 120 → 15.9 (87% reduction).
The decay continues to reduce it: after 72h the same batch contributes 7.9 pts
(equal to the organic scenario at t=0), after 144h it contributes 4.0 pts.

### Before / after ranking — New York (sorted by current 30d score)

> Current formula uses a 30-day rectangular window as the closest apples-to-apples
> comparison with the proposed formula's effective look-back (~10d at h=72h where
> 2^(−240/72) ≈ 0.001). Median of current 30d scores = 0 for NY (only ~19% of
> restaurants have any in-window video), so code falls back to raw score for
> normalization — rank = raw score order.

| Restaurant | Cuisine | Cur raw (30d) | Prop raw | Rank (current) | Rank (proposed) | Delta |
|------------|---------|---------------|----------|----------------|-----------------|-------|
| Rowdy Rooster | Chicken | 18 | 0.01 | 1 | 152 | **−151** (falls) |
| Fonty's Deli + Dukaan | Cafe | 15 | 0.01 | 2 | 153 | **−151** (falls) |
| Mei Lai Wah | Chinese | 15 | 0.01 | 3 | 154 | **−151** (falls) |
| Brown Bag Sandwich Co. | American | 15 | 0.01 | 4 | 155 | **−151** (falls) |
| Blue Sky Deli (Hajji's) | Deli | 15 | 0.01 | 5 | 156 | **−151** (falls) |
| Bo's Bagels | Brunch | 15 | 0.01 | 6 | 157 | **−151** (falls) |
| Adel's Famous Halal | Halal | 15 | 0.01 | 7 | 158 | **−151** (falls) |
| Sunny & Annie's Gourmet Deli | Deli | 12 | 0.79 | 8 | 133 | −125 (falls) |
| Huli Huli | Chicken | 12 | 0.79 | 9 | 134 | −125 (falls) |
| ... (all top-20 current have 0 in last 3d) | | | | | | |
| **Uncle Lou** | Chinese | 9 | **3.32** | 22 | **1** | **+21** (rises) |
| **Ugly Baby** | Thai | 9 | **3.32** | 23 | **2** | **+21** (rises) |
| **Supermoon Bakehouse** | Bakery | 9 | **3.32** | 24 | **3** | **+21** (rises) |
| **Wu's Wonton King** | Chinese | 9 | **3.32** | 25 | **4** | **+21** (rises) |
| **The Consulate** | French | 9 | **3.32** | 26 | **5** | **+21** (rises) |
| **Woorijip** | Korean | 9 | **3.32** | 28 | **6** | **+22** (rises) |
| **Wo Hop** | Chinese | 9 | **3.32** | 27 | **7** | **+20** (rises) |

**What the table tells you.** The current top-20 NY restaurants all got their videos
in the May 4-13 or late April pipeline runs — they are 3-5 weeks old but still
inside a 30d rectangular window with no decay penalty. Their prop_raw drops to 0.01
(effectively zero) because exponential decay at 900+ hours with h=72h yields
2^(−900/72) ≈ 0.000015. The restaurants rising to the top under the proposed formula
(Uncle Lou, Ugly Baby, etc.) all received 3 videos in the June 8 batch (~2.5 days
ago), which at h=72h yields 2^(−62/72) ≈ 0.55 — so 3 same-day videos score
log₂(4) × 3 × 0.55 ≈ 3.3, substantial recency weight.

> **Overseer F2 re-verification (2026-06-10, independent SQL re-run):** movers
> confirmed — Rowdy Rooster cur_rank 1 (raw 18) → prop_rank 152 (prop 0.01);
> Uncle Lou / Ugly Baby / Supermoon Bakehouse cur_rank 22 (raw 9) → prop 3.31,
> tied at prop_rank 1 with the rest of the 131-restaurant June-8 NY cohort
> (ties broken by raw score then id, per `rankScores`). 151 NY restaurants
> score above 0.01 under decay. Note the proposed top-N is a ~131-way tie at
> 3.31 until batches diversify — the "rank 1-7" rows in the table above are
> tie-order, not strict ordering.

**Important caveat on live data.** Because ALL video ingestion is batch-pipeline
(not organic), both formulas currently reward "batch ran recently" rather than
"restaurant is genuinely buzzing." The decay formula is strictly more correct
(recent batch > old batch), but the real fix for the signal-quality problem is
organic social data or at minimum video publish-date metadata, not just the
ranking formula. The decay formula does exactly what it should given current inputs;
it cannot fix the underlying data sparsity.

---

## 3. Options

### Option A — Implement as specified: exponential decay + per-(restaurant,source,day) log₂ cap (recommended)

Replace the rectangular window count in `computeScoresFromData` with a
contribution function:

```
w(event) = base_weight × log₂(1 + n_sameday) × 2^(−Δt / h)
```

where:
- `base_weight` = existing `WEIGHTS.video` (3), `WEIGHTS.review` (5), `WEIGHTS.photo` (1)
- `n_sameday` = number of events from the same (restaurant, source, day) bucket
- `h` = half-life: **72 hours** for videos, **168 hours** (7 days) for reviews/photos
- `Δt` = age of the event bucket midpoint in hours

The cap is applied **before** the decay weight, so a 40-video backfill day contributes
`log₂(41) ≈ 5.36` effective events, not 40. With decay at t=0 that yields
`5.36 × 3 × 1.0 = 16.1 pts` vs the current `40 × 3 = 120 pts`.

The change requires fetching `created_at` per event (currently discarded after the
cutoff filter) and moving scoring from TypeScript pure counts to a weighted sum with
per-event ages. `fetchRawData` must return timestamps; `computeScoresFromData` must
accept them. The public API (`topTrending`, `topTrendingRestaurants`, `debugTrending`)
is unchanged.

The concept of a "window" is replaced by a decay floor: `2^(−Δt/h) < ε` where ε is
a configurable cutoff (default: 0.001, equivalent to ~10 half-lives). This also
replaces the need for `WINDOW_HOURS` and the `Window` type — though they can be
preserved as UI labels with the decay floor defining the actual lookback.

**Tuning knobs (in `weights.ts`):**
```ts
export const DECAY = {
  videoHalfLifeHours: 72,    // tune up to smooth, down to sharpen recency
  reviewHalfLifeHours: 168,
  photoHalfLifeHours: 168,
  capBase: 2,                // log base for per-day cap (2 = log₂)
  decayFloor: 0.001,         // ignore contributions below this fraction
} as const
```

**Why-chip display note.** The score is now continuous and naturally expressible as
a freshness level. The admin `debugTrending` endpoint can expose `decay_age_hours`
per event batch to power the planned "why-chip" card tooltip
("Trending because: 3 videos in the last 2 days"). The chip text map:
- decay weight ≥ 0.9 → "new this week"
- 0.5–0.9 → "active recently"
- 0.1–0.5 → "picked up earlier"
- < 0.1 → (suppressed from why-chip)

**Tradeoffs:**
- Pros: kills both documented bugs; continuous score with no cliff; per-day cap is
  sybil-adjacent protection for ranking (40 fake videos = 5.4 signal); aligns with
  the ENGAGEMENT report's prescription; formula is transparent and tunable.
- Cons: more complex `fetchRawData` (must return timestamps, not just counts);
  `computeScoresFromData` is no longer a pure count-and-sum (slight unit-test
  surface expansion); the `Window` type becomes a UI artifact rather than a
  functional filter (could confuse future readers); all existing backfilled videos
  score near-zero immediately on deploy (large rank churn on first deploy — see
  rollout note).

### Option B — Exponential decay only, no per-day cap

Simpler implementation: keep `fetchRawData` returning rows with `created_at`,
compute `score += weight × 2^(−Δt/h)` per event, no per-bucket cap.

Tradeoffs: still fixes the cliff-edge bug. Does NOT fix the backfill-spike bug —
40 same-day videos still score `40 × 3 × decay` vs `5 × 3 × decay` for the organic
restaurant; the 8x advantage is preserved. Simpler code.

### Option C — Keep rectangular window, add per-source daily cap only

Add a cap at data-fetch time: `LIMIT 1 per (restaurant_id, DATE(created_at))` in
the SQL queries, or post-filter in `computeScoresFromData`. No decay, no timestamp
pass-through.

Tradeoffs: fixes the backfill-spike bug partially (caps per-day, but multiple days
of backfill still stack linearly). Does NOT fix the cliff-edge. Requires minimal
code change; preserves the `Window` type semantics exactly. Weakest fix.

---

## 4. Recommendation

**Option A.** The two bugs are coupled: the cliff-edge is a recency-signal problem
and the backfill-spike is a volume-cap problem. Option A fixes both in one coherent
change. The formula is well-specified, the tuning knobs are self-documenting, and
the ENGAGEMENT report already committed this to Stage 4 of the roadmap. The
implementation complexity is manageable (the patch is ~160 lines net).

---

## 5. Rollout steps

1. Owner approves this gate (this document + patch review).
2. Deploy behind a feature flag: `NEXT_PUBLIC_TRENDING_FORMULA=decay` (env var).
   Existing `computeAllScores` remains the default; the decay path is code-complete
   but unreachable until the flag flips.
3. Run the admin debug endpoint (`/api/debug/trending?restaurantId=...`) against
   5-10 restaurants in 2 metros with the flag ON to validate scores look sane.
4. Flip flag to ON in staging. Monitor the `/api/trending` response for any `score=NaN`
   or `score=Infinity` (guarded in the patch via `isFinite` check).
5. Flip flag to ON in production during a low-traffic window (early morning).
6. Expect large rank churn on first deploy: all videos older than ~10 days (the
   effective lookback at decay floor 0.001 and h=72h) will score near-zero. This is
   correct behavior — it is not a bug — but communicate to the owner before deploy
   so a sudden "trending rail emptied" does not read as an incident.
7. Remove the feature flag after 2 weeks of stable operation. Remove the `Window`
   type plumbing or demote it to a UI-label-only role.

---

## 6. Rollback plan

The feature flag makes rollback a single env var change. If the flag is already
removed: git revert the two-file commit, `npm run build`, redeploy. Because no
schema changes are involved, there is no database migration to reverse.

---

## 7. Success metrics

- **Primary:** no restaurant in top-10 trending has all its scoring videos older than
  3 days (i.e., the cliff-edge is gone; recency gradient is visible in `debugTrending`).
- **Primary:** a restaurant with 40 same-day backfilled videos does not outscore a
  restaurant with 3 videos across 3 recent days by more than 2× (log-cap working).
- **Secondary:** admin `debugTrending` correctly shows `decay_weight` per event
  bucket, enabling future why-chip display.
- **Secondary:** `topTrending` p99 latency unchanged (the extra timestamp columns
  are small; the decay math is O(n events) same as the existing loop).

---

## 8. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Large rank churn on deploy day reads as a bug | High (certain) | Pre-communicate to owner; have rollback ready; deploy off-peak |
| All metros show empty trending rail if recent batch is >10d old | Medium | Tune `decayFloor` upward or extend the effective half-life; `allowZeroScores` fallback in callers already exists |
| Future pipeline batch runs look like "organic trending" under decay | Medium | Longer-term fix: use video `published_at` field if added; for now, document in CLAUDE.md "Known landmines" |
| Formula is harder to explain than "count events in window" | Low | `debugTrending` + why-chip copy makes it self-documenting at the UI layer |
| Unit tests break (currently test pure count logic) | Low | Tests need update to pass `created_at` timestamps and to exercise both flag states. The patch does NOT include test fixtures (corrected by overseer F2 — the original claim was wrong); test updates are an implementation task alongside the patch |

---

## 9. Overseer F2 amendments (2026-06-10)

1. **Patch regenerated.** The original `trending-decay.patch` was corrupt as a
   git artifact: hunk headers had wrong line counts (e.g. `@@ -1,8 @@` spanning
   19 source lines), and the first `weights.ts` hunk referenced context lines
   that do not exist in the real `weights.ts` (it duplicated the docstring from
   `trending.ts`). `git apply --check` failed. Regenerated from the real files;
   now applies cleanly with `git apply --check -p1`.
2. **Feature flag implemented in the patch.** The original patch replaced the
   formula outright, contradicting rollout step 2 ("decay path unreachable
   until the flag flips"). The regenerated patch gates the decay path behind
   `NEXT_PUBLIC_TRENDING_FORMULA=decay` via `decayEnabled()`; the legacy
   rectangular path (counts AND window-bounded fetch cutoff) is byte-for-byte
   behavior-identical with the flag off.
3. **`trending_counts` semantics fixed.** The original patch stored the full
   weighted contribution (base_weight × cap × decay) in `EventCounts`, so a
   3-video restaurant would report `videos: 3.31` weight-units. The regenerated
   patch divides by the base weight so counts are effective event-equivalents,
   matching the patch's own comment and the why-chip copy.
4. **Live-data corrections.** NY June-8 batch is 324 videos / 131 restaurants
   (not 1,907 / 765 — those figures don't reconcile with each other or the DB);
   decay weight for the June-8 cohort is ≈0.55 (~62h), not 0.63; movers table
   re-verified by independent SQL (see §2 note).
