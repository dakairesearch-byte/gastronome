# Engagement & Community Scoring — Synthesis Report

**Date:** 2026-06-09 (synthesized 2026-06-10)
**Inputs:** 6 expert lenses (community-scoring, engagement-gamedesign, ranking-datascience, growth-virality, trust-abuse, differentiation-ethics) · **67 raw ideas → 56 deduped** · 6 one-big-bets
**Context:** 3,340 restaurants, 6 metros, profiles=6 (seeded), reviews=0, follows=0 (true cold start), ~24% scoreless, ~58% menuless, ~38% no video, `mailer_autoconfirm` ON (fake emails are free), Gastronome Score is ratings-only and OWNER-GATED (any formula/weight/input-signal change — even 1% — requires explicit approval per CLAUDE.md decision gates).

---

## 1. TL;DR — the highest-leverage moves, in order

1. **Make every URL shareable: flip the middleware to public-read + ship Score Card OG images, as one bundle.** Every growth loop in this report transmits through a pasted URL, and today `src/lib/supabase/middleware.ts` 307s every anonymous request into the onboarding wizard ("No escape") — Googlebot included. Public read with gated writes, plus an "8.7 · Michelin ★ · 4.8 Google" scorecard rendering in iMessage, is the denominator of the K-factor and starts the SEO clock. **This reverses a documented product decision — it goes to the owner as a decision gate first.** Days of work; multiplies everything else.
2. **Ship the Verdict Stack as the single rating primitive — on a server-side trust ledger from day one.** One interaction ladder: 1-tap "Been" → 1-tap "Would you go back?" → optional anchored whole-number 1-10 → optional dish tags. Every tier is independently useful data. Underneath it, ALL writes go through a `SECURITY DEFINER` RPC that stamps identity tier, IP/UA hash, and a computed `trust_weight` on every row. With autoconfirm ON, assume day-one rows are adversarial; retrofitting provenance onto unattributed rows is impossible, and at reviews=0 this is the cheapest moment ever to build it. (Trust lens's one big bet; the community lens's flagship interaction.)
3. **Pairwise This-or-That duels → a live personal ranked list + a per-metro Crowd Rank ladder displayed BESIDE the Gastronome Score.** Two lenses independently made this their flagship: it's the Beli compulsion loop (⌈log₂ n⌉ taps to place a restaurant in your list), it's the statistically cleanest community signal (scale-free — no anchoring, no inflation), it's fully fun at exactly 1 user, and an ordinal rank cannot visually collide with the calibrated 0-10. Differentiates from Beli by making the crowd ladder public where Beli keeps rankings personal.
4. **Aim community energy at the 24% scoreless catalog (First Fork / Scout / Be-the-First).** Three lenses independently converged here — the strongest cross-lens agreement on a growth mechanic. Vote #1 on an 8k-review restaurant is statistically and emotionally invisible; vote #1 on a scoreless restaurant IS the page. Permanent "First Fork" credit, per-metro coverage meters, 3x Scout XP (photo required) — community contribution lands exactly where the aggregator is blind.
5. **Ship The Verdict: visible cross-source agreement/disagreement.** "Unanimous: every crowd agrees" vs "Contested: critics love it, Yelp shrugs." The agreement math already exists in `src/lib/score.ts` (the AGREEMENT penalty, lines 237-248); this is pure display-layer — **no owner gate triggered** — and it's the one feature Google, Yelp, and Beli structurally cannot copy. It converts the score from a black box into a trust asset. (Differentiation lens's one big bet; ~a sprint of work.)
6. **Home = opinionated rails, Discover = deterministic tools — and ship the impressions log before any learned ranker.** With reviews=0 and follows=0 there is no data to power an infinite personalized feed; four transparent rails beat a fake one. Discover stays filter-first, score-sorted, zero stochasticity (intent + algorithmic "help" = perceived manipulation). The `feed_impressions` table is plumbing with zero visible value and it gates every adaptive idea in §3 — build it early or fly blind on every gated ranking decision forever.
7. **Retention through accumulation, not loss-aversion.** Taste Passport (been-to map, cuisine grid, auto top-10), Taste Profile reveal, Wrapped-style recaps — the Letterboxd loop (your past investment is *there*), not the Duolingo loop (something expires if you lapse). Where the engagement lens proposed streaks and variable-reward spinners, the ethics lens flagged them; §4 surfaces every tension honestly and adds an Engagement decision gate to CLAUDE.md so "we'd never do that" becomes a process, not a mood.

---

## 2. Community scoring: the recommendation

### The pick: a HYBRID ladder — binary "would you go back?" as the headline, the write-in whole-number 1-10 as the calibrated intensity layer, pairwise duels as the fun engine. Restaurant-level upvote/downvote: rejected.

The user floated upvote/downvote vs write-in 1-10. The lenses' verdicts:

| Mechanism | Verdict | Why, for THIS app |
|---|---|---|
| **Up/down on restaurants** | **Reject** | Collapses "transcendent" and "pretty good" into one bit, measures popularity (which Google volume already measures better), duplicates "would you go back?" with worse semantics — and on adversarial grounds it's the cheapest signal to spam while giving you nothing to fingerprint (the trust lens's point: a 1-10 distribution per user is itself an abuse detector; context-free upvotes are not). **Keep up/down where it belongs:** dish votes and review helpfulness, ranked by Wilson lower bound. |
| **Write-in whole-number 1-10** | **Adopt as the intensity tier — with guardrails** | Three lenses (community-scoring, ranking, differentiation-ethics) independently picked it over up/down. Pros: granularity, matches the 0-10 brand (one scale to learn), enables per-rater calibration (an upvote has no per-user scale to calibrate against), and pays the rater immediately via taste-match ("Gastronome 8.4 · your likely take: 9+"). Cons at cold start: J-shaped self-selection, lumping at 7/8, near-zero information below n≈30 while *looking* authoritative. So it ships with an anchored rubric, calibration, Bayesian shrink, and a min-n gate — and it is never the headline number early. |
| **Binary "Would you go back?"** | **Adopt as the headline stat** | Two lenses converged independently. Revealed-preference framing is structurally inflation-immune (you can't grade-inflate yes/no), it gets 5-10x the response rate of a numeric scale, so it becomes statistically meaningful *first*, and "93% would return · 41 diners" stays honest at tiny n. The 1-10 × return-rate contrast is editorial gold: a 7.2 with 95% return is a beloved neighborhood spot; an 8.5 with 60% return is a bucket-list one-timer. |
| **Pairwise This-or-That (Elo/Bradley-Terry)** | **Adopt as the addiction engine** | Two lenses' flagship bet. Scale-free, transitively information-dense, the proven Beli hook, and it works at exactly one user (personal ranked list). The global per-metro ladder is seeded from the algorithmic score so it's sane at zero comparisons. |

**Why hybrid, not one mechanism:** each tier has a different volume/information tradeoff, and the aggregation needs exactly that pyramid — high-n low-bit signals (been, would-return) stabilize the estimate early; low-n high-bit signals (1-10, comparisons) add resolution later. Friction-laddering means every tap is a complete signal and nobody writes an essay to count.

### The interaction: the Verdict Stack (bottom-sheet on restaurant page + post-visit prompt)

- **Tier 1 — "Been here"** (1 tap). Builds the visit graph; gates everything else (you can only score/duel places you've marked Been). Onboarding backfill ("tap every place you've been" against the metro top-100 grid) seeds 20-50 logs in session one.
- **Tier 2 — "Would you go back?"** (1 tap, yes/no). The headline community stat.
- **Tier 3 — optional whole-number 1-10**, anchored picker: 5 = "perfectly fine", 7 = "great", 8 = "excellent", 9 = "all-timer", **10 visually reserved — "a 10 doesn't exist yet"** (mirrors the algorithmic score's unreachable-10; on-brand, deflationary, and yes it will generate support questions — that's a feature, it teaches the scale).
- **Tier 4 — "What did you eat?"** — chips from `restaurant_menu_items`/`restaurant_top_dishes` + free-text add (trigram-matched), 🔥 on what delivered. Writes into `restaurant_dish_signals` with `source='community_vote'`; quietly crowdsources the 58% menu gap. UPSERT into `restaurant_top_dishes`, never truncate (CLAUDE.md landmine); the blend weight in that pipeline is arguably a gated change — flag in QUESTIONS.md.
- **After any tier:** one skippable This-or-That duel vs a same-metro, similar-price place the user has marked Been. Never two uninvited in a row. **Never forced** — Beli gates your list behind ranking; we don't (ethics gate, §4).
- **No free text anywhere at launch** (trust lens): you can't defame anyone with the number 7. Integers + curated chips have near-zero moderation surface; text ships later behind Tier-1 identity + LLM screening + report queue.

### Data model sketch

```sql
-- Verdicts: extend existing reviews table (title/content become optional)
ALTER TABLE reviews
  ADD COLUMN would_return boolean,                           -- tier 2
  ADD COLUMN dish_tags text[],                               -- tier 4
  -- provenance, stamped server-side by submit_verdict() RPC; raw client INSERT revoked
  ADD COLUMN trust_weight numeric NOT NULL DEFAULT 0,
  ADD COLUMN identity_tier smallint NOT NULL DEFAULT 0,
  ADD COLUMN visit_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN ip_hash text, ADD COLUMN ua_hash text,
  ADD COLUMN quarantined boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT rating_whole_1_10
    CHECK (rating IS NULL OR (rating BETWEEN 1 AND 10 AND rating = floor(rating))),
  ADD CONSTRAINT one_verdict_per_user UNIQUE (user_id, restaurant_id);
-- "Been" = a row with NULL rating; edits are versioned, re-votes UPDATE.

CREATE TABLE restaurant_comparisons (                        -- duels
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  winner_id uuid NOT NULL REFERENCES restaurants(id),
  loser_id  uuid NOT NULL REFERENCES restaurants(id),
  prompted_context text,
  created_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX one_pair_per_user ON restaurant_comparisons
  (user_id, least(winner_id, loser_id), greatest(winner_id, loser_id));

CREATE TABLE restaurant_community_stats (                    -- recomputed by scheduled
  restaurant_id uuid PRIMARY KEY,                            -- RPC, NOT a trigger —
  n_been int, n_ratings int,                                 -- migration 20260531000002
  mean_raw numeric, mean_calibrated numeric,                 -- already dropped a review-
  ci_halfwidth numeric, weighted_n numeric,                  -- aggregate trigger once
  n_return int, n_return_yes int,
  elo numeric, n_comparisons int,
  computed_at timestamptz
);

CREATE TABLE user_trust (                                    -- sybil weighting, §6
  user_id uuid PRIMARY KEY,
  weight numeric NOT NULL DEFAULT 0.25,                      -- 0..2, never displayed
  components jsonb, computed_at timestamptz
);

CREATE TABLE review_votes (                                  -- review helpfulness (Wilson)
  review_id uuid, user_id uuid, vote smallint,
  UNIQUE (review_id, user_id)
);
```

Per-user rating stats (μ_u, σ_u for calibration) live in a small `user_rating_stats` table updated by the same nightly job. RLS per existing migration patterns (20260530000001); INSERT/UPDATE on `reviews` revoked from the `authenticated` role — writes only via the RPC.

### Aggregation math (new `src/lib/communityScore.ts`, deliberately mirroring `score.ts` conventions so a future merge is reviewable)

1. **Per-rater calibration first** (the Netflix-Prize lesson — user-bias removal is the single biggest accuracy win; three lenses converged on this):
   `calibrated_i = clamp(μ_pop + (r_i − μ_u)·(σ_pop / σ_u'), 1, 10)`
   where μ_u is shrunk toward μ_pop with pseudo-count 5 (a user's first ~3 ratings barely move) and σ_u' = max(σ_u_shrunk, 0.75). Self-disables below ~5 ratings/user — the correct failure mode. **Never show the per-rating calibrated value**; show only the aggregate, plus the "tough critic" framing on profiles ("Your average: 6.4 vs community 7.1") — a status mechanic and anti-inflation pressure in one.
2. **Trust-weighted, trimmed Bayesian shrink:**
   `C = (μ0·k + Σ w_i·calibrated_i) / (k + Σ w_i)` with **prior μ0 = 6.8** (catalog-median quality) and **pseudo-count k = 8** — the exact pattern of `score.ts shrink()`. w_i ∈ [0.05, 2.0] from `user_trust` × identity tier × visit-verification (§6). Before the mean, **trim the top/bottom 10% of weight mass** (trust lens) so a handful of 10s/1s moves the number ~zero. Note the shrink is itself sybil defense: 20 sock-puppet 10s at w=0.25 contribute Σw = 5 < k — the prior still wins.
3. **Min-n display rules:**
   - 1-10 aggregate: hidden until **weighted n ≥ 5 AND ≥ 3 distinct calibrated raters**. Below that, show the individual named verdicts ("Nick: 8 — would go back") — feels alive, fabricates nothing. Five Tier-0 sybils (Σw = 0.25) show nothing; five verified locals publish.
   - % would return: shown at **n ≥ 5** (one grumpy verdict must never render as "0% would return"); display the raw proportion with visible n ("93% · 41 diners"), rank by Wilson lower bound (z = 1.96).
   - Crowd Rank: hidden below **10 comparisons**; ladder sorted by Elo lower-confidence bound (Elo − 2σ_elo). Below threshold: "Unranked — settle it."
   - Displayed counts are fuzzy-banded (23 → "20+") so the exact gaming threshold and per-vote deltas stay invisible.
4. **Confidence treatment:** 95% interval via t-approx `s/√n_eff`, rendered as 1-3 "confidence dots" beside the number — never fake precision.
5. **Update cadence:** aggregates recompute on a **randomized daily batch** (±20% timing jitter), never on insert — the user's own rating appears instantly on their profile, but the public number's response to any one vote is unobservable. An attack you can't measure is an attack you abandon.
6. **Elo / Bradley-Terry for duels:** online Elo (K = 32 for a restaurant's first 30 comparisons, then 16), K scaled by voter trust weight, **seeded from the algorithmic score** — `R_init = 1500 + 100·(GastronomeScore − 7)`, scoreless start at 1400 — so the ladder is sane at zero votes. Nightly job fits proper Bradley-Terry (MM algorithm, ~20 lines) with Elo as warm start → `restaurant_community_stats.elo`.

### BESIDE, FEEDS-INTO, or SEPARATE? **BESIDE at launch. FEEDS-INTO as an owner-gated phase 3. REPLACE never.**

Every one of the six lenses independently landed on "alongside, not inside" for v1 — unanimous cross-lens agreement, the strongest signal in this exercise. The aggregator's credibility IS the algorithmic score.

- **Phases 1-2 (BESIDE):** the community layer renders as (a) "% would return · n diners" in a visually distinct "Diners" module under the score block, (b) "Community 7.4 · 20+ ratings" with confidence dots once gates pass, and (c) **Crowd Rank as an ordinal** ("#12 in Austin · 87 head-to-heads"). The ordinal is deliberate: two disagreeing numbers on the same 0-10 scale read as a bug; a rank reads as a different lens — and it launders early Elo noise honestly (rank #3 vs #5 is defensible when a fake-precise "8.7" isn't). None of this touches `score.ts`, so **no formula gate is triggered** (UI placement still goes through the normal UI decision gate). A bounded community term may also enter *feed ranking* (not the displayed score) in phase 2 — that IS a gated ranking-formula change → QUESTIONS.md.
- **Phase 3 (FEEDS-INTO, owner-gated):** propose community as a **fifth source** entering `contributions[]` exactly the way the sparse Beli source already does (`score.ts:218` shrinks a sparse /10 social source toward a prior), with **self-extinguishing weight `w_c = 0.35·n/(n+40)`**. Worked example: n=4 → w_c = 0.032 vs Google's 0.62 — a 9.0-vs-8.0 disagreement nudges the blend +0.05. At n=200 → w_c = 0.29, ~+0.3 before the existing AGREEMENT penalty (k=0.8 beyond 0.3 tolerance) drags divergence back toward the skeptical source. Community counts toward the 2-source corroboration ceiling only at **n ≥ 50 calibrated raters** (5 friends can't unlock the 9.2+ elite band). Elegant corollary: for the 24% scoreless, community becomes the only source and the existing single-source cap (8.0-8.5) applies automatically — an uncorroborated crowd can't claim elite status, which is exactly right. **Explicitly a CLAUDE.md decision-gate item:** file in QUESTIONS.md with these exact constants; until approved, run the identical math behind a preview flag on an internal `/lab` page so the owner sees real deltas on real restaurants before deciding. Do not propose before trust-weighting is live — once community feeds the headline number, you've created the motive for review-bombing and owner self-rating.
- **REPLACE: never.** And **never SEPARATE-and-equal** either — a co-equal second 0-10 on the page invites "which is real?" confusion. Visual hierarchy subordinates the community layer until volume earns it.

### Rollout

- **Phase 1 (weeks 0-6):** trust-ledger RPC + provenance columns FIRST; then Verdict Stack tiers 1-2 (+ optional 1-10 behind the anchored picker); "% would return" beside the score at n ≥ 5; individual named verdicts below min-n; calibration telemetry (per-user mean/σ) and trust *logging* (not yet weighting) silently from day one; First Fork prompts at the scoreless 24%; structured-only input; autoconfirm OFF before any public number renders.
- **Phase 2 (months 2-4):** per-rater calibration live; This-or-That duels + personal ranked list; **Crowd Rank in the 1-2 densest metros only** (6 thin comparison graphs would fragment); dish 🔥 votes into the top-dishes pipeline; trust weights enforced; community estimate as a bounded feed-ranking factor (gated, QUESTIONS.md); review-helpfulness Wilson sort (👍-only at first — downvotes feel hostile in a tiny community).
- **Phase 3 (month 5+, metric-gated, not date-gated):** file the fifth-source proposal when ALL of: ≥500 calibrated ratings platform-wide; per-user calibration live ≥60 days; trust weighting + brigade detector live; median rated restaurant ≥30 weighted votes. Owner adjudicates via QUESTIONS.md with the `/lab` preview.

---

## 3. Ranking

### The honest split: HOME = opinionated rails, DISCOVER = deterministic tools

With follows=0 and reviews=0 there is no data to power an infinite personalized feed — and a fake-TikTok feed of restaurant cards is a worse product than four great rails. **Home** (`src/app/page.tsx`): "Trending this week" (decayed trending), "Best of [home city]" (score-sorted, multi-source only), "For your tastes" (taste vector), "Worth a look" (uncertainty-bonus / Uncharted pool, capped at one rail). Each rail has one transparent objective — which also makes rails the right A/B substrate. **Discover** (`src/app/discover/page.tsx`): deterministic, filter-first, sorted by Gastronome Score within filters, explicit sort selector (Score / Distance / Trending), map mode, zero stochasticity, unrated entries grouped at the bottom under "unrated" — never interleaved silently. A user on Discover has intent; algorithmic "help" there reads as manipulation and erodes the score's credibility, which is the brand. Replace rails with a blended feed only behind an explicit metric gate (e.g. >500 weekly active voters), not a vibe. Honest cost: rails demo worse to investors pattern-matching to Beli/TikTok; sparse metros will show rail overlap — dedupe top-down and accept shorter rails.

### The blended ranker, when it's earned: QFA (Quality × Freshness × Affinity)

`rank = Q^1.0 · (1+T)^0.5 · A^0.3` — Q = gastronomeScore/10 (or imputed prior), T = decayed trend ∈ [0,1] per city, A = taste affinity bounded to [0.85, 1.15] so personalization is a re-ranker, never a gatekeeper. Multiplicative means a zero-trend great restaurant still ranks; log-rank is a linear model you can later fit to click data. Fixes today's pathology where trending is the ONLY sort and a mediocre place with 5 backfilled TikToks outranks an 8.9 with none. **Gated formula change → QUESTIONS.md with the exact exponents**, plus a why-chip per card ("9.1 + trending + Italian like you").

Supporting fixes, roughly in order:

- **Exponential decay + per-source caps in trending** (`src/lib/ranking/trending.ts`): replace rectangular windows with `w_e·2^(−Δt/h)` (h = 72h videos, 7d reviews/votes) — kills both the cliff-edge and the no-recency-gradient flatness — and cap per (restaurant, source, day) at log₂(1+n) so a 40-TikTok backfill dump contributes ~5.4 points, not 120 (the documented backfill-spike bug). Small, gated, high-value; one QUESTIONS.md entry covers both.
- **Taste vector v0:** ~20 hand-built floats (cuisine one-hots, price tier, geo bucket, accolade flag, buzz decile) seeded from `profiles.favorite_cuisines` (exists today, decorative) with pseudo-weight m=10, updated online `v ← (1−η)v + η·x_r` per positive event (η graded by signal strength). No ML infra at 3,340 items. Caveat: onboarding cuisine answers are aspirational — m=10 means behavior wins within ~two sessions.
- **Day-0 cold start: 70/20/10 interleave** — 70% city-best (multi-source only), 20% onboarding-taste-matched, 10% explore pool; linear handover to full QFA by ~30 interactions. Anonymous users get the same rails off geo-IP with a one-tap city switcher (never guess harder for travelers).
- **Explore/exploit:** phase 1 is free — Plackett-Luce sampling via Gumbel noise on log-scores with a `hash(user_id, date)` seed (stable today, fresh tomorrow; tune τ so P(top-3 unchanged) > 0.9 while ranks 5-30 rotate). Breaks the rich-get-richer exposure starvation that would otherwise concentrate all community signal on the incumbent top 10. Phase 2 (Thompson sampling on Beta(clicks+1, impressions−clicks+1) posteriors) only after the impressions log exists; do not build it first. Keep seeds replayable in the admin debug endpoint (`debugTrending` pattern).
- **MMR diversity pass:** greedy re-rank, `λ·rel − (1−λ)·max sim` with λ≈0.75, sim = 0.5·cuisine + 0.3·neighborhood + 0.2·price; hard backstop: window of 5 → max 2 same cuisine/neighborhood. **Skip the cuisine term when the user explicitly filtered by cuisine** — diversity against stated intent is wrong.
- **Occasion chips:** date night / quick lunch / solo as feature-boost vectors `exp(θ_c·f_r)` over data that already exists (hours, price, coords, Google chips like "cozy" / "quick bite"). Compute boosts only over features present and renormalize — otherwise the 58% menuless places get silently penalized twice. Keep the chip visible and sticky; wrong inference is worse than none.

### Cold start & fairness to the thin/scoreless 24%

If unscored = 0 in any blended ranker, a quarter of the catalog is permanently invisible, never earns votes, never gets scored — a death spiral. The fix has four parts (ranking + ethics lenses, converging):

1. **Empirical-Bayes imputation:** Q_imputed = median gastronomeScore of the (city, cuisine) cohort, shrunk toward city median below cohort n=8, **minus a −0.3 honesty haircut** so imputation never outranks evidence (the scoreless set is adversely selected; monitor the haircut).
2. **UCB uncertainty bonus in dedicated explore slots only** (e.g. feed positions 6 and 13): rank by Q + c·σ — optimism in the face of uncertainty allocates exposure proportional to information gain.
3. **Evidence gate for exposure:** photo + hours + address required before a thin page can spend a feed slot.
4. **Never display the imputed number.** Cards say "New to Gastronome — no score yet"; the displayed score stays `score.ts`-only. Pages show honest coverage lines ("1 of 4 rating sources · no menu yet") with a "Request coverage" demand signal feeding the backfill pipeline — admitted ignorance is differentiation; discovered padding is a trust kill-shot.

This is the supply side of the First Fork flywheel: exposure → votes → real community signal → imputation retired.

### Foundation (prerequisite for everything learned)

`feed_impressions` (session_id, user_id nullable, surface, position, restaurant_id, event ∈ {impression, click, save, vote}, created_at) — BRIN index on created_at, `navigator.sendBeacon` batching, insert-only RLS, nightly rollup into `restaurant_exposure_stats`. Position logging enables inverse-propensity weighting later (position-1 clicks ≈ 10x position-10 from bias alone). Today `src/lib/events.ts` is a content changelog, not a user-event log — **you currently cannot answer "did the ranking change help" at all**, which makes every gated ranking decision unfalsifiable. Privacy posture (retention window, session anonymization) decided up front; ad-blocker undercount (~10-25%) is fine for ranking, never for billing-grade metrics.

---

## 4. Addictive & fun (ethically)

### The core loop

**Visit → 1-tap log → verdict chip → one duel → your list reshuffles → checklist/Hit List progress ticks → the app answers "where next?" (Tonight's Pick, checklists, Hidden Gems) → next visit.** Every step is single-player (cold-start-proof), every step deposits an identity artifact, and the loop closes at the moment of highest intent: deciding where to eat next.

### The mechanics, each with its behavioral engine

| Mechanic | Behavioral reason | Ethics status |
|---|---|---|
| One-tap Been log + onboarding backfill grid | Endowment: each log makes the app more *mine* — the strongest zero-community retention force (Letterboxd grew for years as a solo diary). Backfill seeds 20-50 logs in session one. | Clean |
| This-or-That duels → live personal ranking | Thurstone's law: comparative judgment beats absolute rating — choosing between two memories is fun; writing a number is homework. Variable reward of watching your own list reorder ("wait, is Via Carota really my #4?") provokes more duels. | ⚠ **Forced ranking as a toll** (Beli gates your own list behind it) = holding the user's data hostage. **Adopted alternative: duels always skippable, list always visible.** |
| Checklists ("Eater 38 — 12/38" progress rings) | Goal-gradient (effort accelerates near completion) + Zeigarnik (open loops nag). 100% editorial data (Eater/Michelin/Beli_NYC_Sublists.xlsx), zero community needed. Milestone sub-rewards at 10/25/38. | Clean (accepts some tourist box-ticking) |
| Taste Profile reveal at 10/25/50 logs ("Heat-Seeking Value Hunter") | Identity scaffolding + the most shareable reward class (self-discovery — a horoscope backed by data). The lock itself is a progression goal. | Clean if copy is sharp; an inaccurate archetype does negative work — stays locked below 10 logs |
| Taste Ledger ("an 8 puts this above 84% of your 31 spots") | Relative judgment > absolute scales; natural deflationary pressure (users who see four stacked 9s start hoarding 9s unprompted). Shares one data structure with the calibration math; rating-vs-duel contradictions feed the trust weight. | Clean; contradiction prompts must be playful and dismissible forever |
| Hit List: 10-slot want-to-go queue + cross-off ceremony | Implementation intentions decay unless the loop closes; bottomless saves become guilt graveyards (Pocket). A cap converts hoarding into curation gameplay; cross-off confetti is a completed-goal hit bottomless lists never deliver. | Clean (uncapped "someday" overflow shelf is the pressure valve) |
| Tonight's Pick spinner + one Daily Pick per metro | Variable-ratio reward attached to a genuine job (6:45pm decision fatigue); Wordle-style one-per-day scarcity = appointment mechanic, zero community required. | ⚠ **Variable-ratio = slot-machine-adjacent** (trips the Engagement Gate below). Adopted shape: quality-gated pool only (never the scoreless 24%), two re-spins then a gentle commit — the commitment device is the point, not the spin |
| Weekly Bite Streak (log OR duel OR cross-off counts; 1 free freeze/month) | Loss aversion — the strongest known retention mechanic — tuned to dining's real weekly cadence (daily streaks force fake logs, then the post-loss churn cliff). | ⚠ **Direct lens conflict, surfaced honestly:** the ethics lens bans loss-framed mechanics outright ("a streak on restaurant visits is functionally a spending-pressure mechanic"; broken-streak users churn harder than no-streak users), and the engagement lens itself flags guilt pushes as trust-burning. **Resolution: do NOT ship in v1.** The monthly Plate recap delivers the cadence pull without the loss frame. If ever revisited: opt-in, pausable, no guilt pushes, through the Engagement Gate. |
| Taste Rank XP + 5 levels (Apprentice → Legend) | Self-determination theory: levels signal real competence only if ungrindable — XP for breadth (first photo on a thin page: 25xp; checklist completion: 100xp) with per-kind daily caps and diminishing returns **in v1, not patched in**. Hidden payoff: levels become a sybil-resistance input. | ⚠ Contribution-volume leaderboards buy volume with quality and incentivize the fake check-ins that poison the community signal (ethics red line). XP never rewards raw tap counts; public profiles describe taste, not contribution volume |
| Badges with teeth (~15 total, criterion-based, some hidden; "Day One" founder badge) | Scarcity economics: a badge is worth what it costs to earn. "Day One" converts the cold-start weakness into status — exactly how Beli/Letterboxd seeded their early snob-adopter cores. Hidden badges add variable-reward discovery. | ⚠ Badge inflation is the death mode — write "badges are scarce" into the design law; hidden badges shown as ??? silhouettes |
| Scout mechanic: "Uncharted" pages pay 3x XP + permanent "First logged by @nick" | Pioneer status (first-ascent culture, Foursquare mayorships) pointed precisely at the weakest inventory; permanent credit is an endowment that makes the Scout return. | ⚠ Strongest abuse magnet in the list (parking-lot land grabs). Ship-gates: photo required, 1 claim/day, admin-revocable, cosmetic only — never touches the score |
| Taste Match % + friends-only weekly leaderboard | Festinger: comparison motivates among similar, known others — a 6-person league where you're 2nd is electric; global boards demoralize everyone below rank 50. A high-match friend's #1 is the best restaurant rec that exists anywhere. | Clean with guardrails: ≥5-shared-item overlap floor before any % renders (non-negotiable), cosmetic crown only, nothing to farm. Month 2-3 — dead at zero friends |
| "My 2026 in Food" + monthly Plate recaps (`@vercel/og` cards) | The Wrapped effect: identity broadcast is the only acquisition channel users run for you; knowing December's card is coming makes March logging feel like deposits. Monthly minis keep it warm and double as the retention email. | Clean; gate annual card at ≥10 visits with a charming low-volume fallback; share by explicit action only, never auto-published |
| Taste Passport (been-to map, cuisine bingo grid, auto top-10) | Accumulated personal value (Letterboxd diary, Strava log): users return because their past investment is THERE. Survives notification fatigue; nothing expires, nothing decays. | Clean — this is the ethics lens's *replacement* for streaks, and the honest shape of dining frequency (weekly-active, not daily-active) |
| Notifications: the "news about YOUR world" rule | Notification trust is a battery. Every push must contain new information about a restaurant the user has a relationship with ("Lilia — on your Hit List — just made the new Eater 38"). Gastronome's accolade/buzz ingestion is an event feed competitors can't match. | **Banned by written policy:** streak-guilt pushes, "we miss you," FOMO ("3 friends ate here without you"), anything without a user-specific noun. ≤2 pushes/week, ≤1 digest, per-category opt-outs |

### The Engagement Gate (make ethics operational)

Add an "Engagement decision gate" to `epicurious/CLAUDE.md` (Decision gates section) mirroring the score gate: any mechanic using (a) loss-framing/expiry, (b) interpersonal comparison in notifications, (c) variable-ratio reward schedules, or (d) contribution-volume leaderboards requires explicit owner approval with a written user-benefit rationale. Two defaults enforced in code: all social/comparison notifications opt-in; no public-profile metric that counts contributions rather than describing taste. The gate blocks *defaults*, not features — optional, user-initiated versions can pass. Honest tension, stated plainly: some banned mechanics genuinely work (Beli's forced ranking, Duolingo's owl). Declining them is choosing slower month-one growth to win month twelve — the owner should make that trade knowingly, once, in writing, rather than relitigating it per feature.

---

## 5. Growth / cold-start — how to not feel dead at 0 users

1. **Public-read everything + Score Card OG images** (TL;DR #1). The viral loop is share → friend sees the actual answer (score, sources, photos) → wants to save/vote → signs up → shares their own links. Forced capture of zero traffic is zero; capture-rate × ~0 visitors < lower-rate × organic traffic. Gate WRITES behind the existing `SignInModal` with context-aware copy ("Sign up to save Lucali"). Fallback OG card for the scoreless 24% ("Unrated — be the first to weigh in") or a quarter of shares look broken. Bonus: 9:16 share variant with QR for IG Stories.
2. **Single-player-first.** The Log→Duel loop, checklists, Taste Profile, Hit List, and Taste Passport are fully fun at exactly 1 user — Beli's core loop is solo. The app must never *need* a community to feel alive while the community forms.
3. **Pages never look empty.** Below min-n, individual named verdicts with avatars instead of a blank aggregate; `external_reviews` snippets fill the social-proof gap; honest coverage lines ("not enough evidence yet" — confident, not apologetic).
4. **First Fork / Scout / Be-the-First** (3-lens convergence): route contribution prompts at the ~800 scoreless restaurants where vote #1 is the entire signal; permanent First Fork credit; per-metro coverage meter ("Austin: 61 of 214 unscored spots claimed") — iNaturalist/OSM completionism. Gate on Been + photo; cosmetic only.
5. **Beli import → "You vs The Critics" defection card.** Flips Beli's sunk-cost lock-in (hundreds of painstaking pairwise ranks) into a defection incentive; pg_trgm fuzzy matching is already enabled and `Beli_NYC_Sublists.xlsx` proves the pipeline. Instantly populates an empty profile for the highest-value persona (competitive NYC food rankers). CSV/screenshot fallback; never store Beli credentials; sharp wedge, not broad acquisition.
6. **Tastemaker pages.** Auto-generate "As seen on @handle" pages from `restaurant_videos.author_username` (≥5 videos), then tell creators they exist. Ego-bait → claim → broadcast to pre-clustered, metro-local food audiences; `/community` launches populated with 50+ credible curated lists instead of 6 seeded profiles. Strictly attributive, takedowns honored same-day; expect ~5-10% claim rate (still worth it).
7. **Settle It + Pick Tonight group-chat artifacts.** A versus-poll URL ("Carbone 8.4 vs Don Angie 8.6 — chat says otherwise") and a constraints→swipe group decision wizard put the score to work inside existing same-metro chats — structural K-factor, and the 6-metro focus becomes an asset: every debate seeds density where you have inventory. Algorithmic score displayed as immovable ground truth so brigading a poll wins nothing. Guest participation is a narrow, owner-flagged exception to the auth policy (signed cookie scoped to `/pick/*`, capped).
8. **Programmatic SEO + dish leaderboards** (2-lens convergence): `/[city]/best/[dish-slug]` from `restaurant_top_dishes` + `restaurant_dish_signals`, ranked by Gastronome Score with the evidence trail ("mentioned in 14 reviews + 6 TikToks"). The query class ("best birria tacos east village") nobody else can answer from data. Quality gate non-negotiable: ≥3 restaurants with evidence AND ≥2 with scores per page; fewer good pages beat many bad ones. The patient compounding layer (3-6 months) under the fast loops — blocked entirely today by the middleware wall.
9. **The Gastronome 10 weekly movers digest:** per-metro new entries / risers / buzziest, snapshot-diffed weekly, OG card per issue, email via Resend to users + the existing `waitlist_signups`. Lead with objectively new things (entries, videos, accolades) — never rank jitter; manufacturing drama from noise corrodes the calibrated-score brand. Sleeper loop: restaurants screenshot "Ranked #7 in SF" to their own followers — free B2B distribution to your exact audience.
10. **Founding Critic referral (⚠ handled carefully):** first 250 *active* users per metro get a permanent badge + their top-10 featured on the city page — the payoff is distribution, not credits, and per-metro caps respect density physics. Invites count only when the invitee completes onboarding AND performs 3+ real actions (count engaged users, not emails). Turn autoconfirm OFF before any referral mechanic; show scarcity progress only above a demand floor ("247 of 250 remaining" for weeks is anti-social-proof).

---

## 6. Trust & anti-abuse — must-haves before community scoring ships

The trust lens's framing, adopted wholesale: with `mailer_autoconfirm` ON, identity costs nothing, so **behavior — not identity — must be the unit of trust**, and provenance must be captured at insert time or it is lost forever. Restaurant ratings are one of the few community signals with direct cash value to manipulators. In dependency order:

1. **Server-side write path + per-rating trust ledger (ships BEFORE any rating UI).** Revoke client INSERT on `reviews` (current RLS allows it — a free sybil pipe tonight); all writes via a `submit_verdict()` RPC stamping identity_tier, ip_hash, ua_hash, visit_verified, and computed trust_weight on every row. Aggregation always sums weights, never counts rows. At reviews=0 there is no migration burden — the cheapest moment ever. (Note: re-reverses the 20260531000002 "no user reviews" decision — flag through the owner gate.)
2. **Identity ladder; flip Google OAuth on; autoconfirm OFF before public numbers.** Tier 0 (email-only) w=0.05 → Tier 1 (Google OAuth/phone) w=0.5 → Tier 2 (Tier 1 + 14d age + breadth across ≥3 restaurants/≥2 neighborhoods) w=1.0. Sybil economics flip: 100 fake emails ≈ 5 real Google accounts ≈ 1 established user. Tier-0 users still see their rating everywhere on their own profile — full product experience, near-zero aggregate influence, and never show them the weight.
3. **Trust-weighted, trimmed, Bayesian-shrunk batch aggregation** (§2 math): trimmed mean drops top/bottom 10% of weight mass; k=8 prior pseudo-count beats sock-puppet armies; randomized daily recompute with jitter denies attackers a feedback loop. Client reads only materialized columns.
4. **Weighted-n display gate:** no public number below weighted n ≥ 5 / 3 calibrated raters; "Early signal — 3 diners" copy below; fuzzy-banded counts; provenance always visible ("Diner Score 8 · 20+ ratings").
5. **Hard caps regardless of trust:** one rating per (user, restaurant), edits versioned; ≤3 first-ratings/day on restaurants with <5 ratings; per-IP daily caps; 1 Scout claim/day.
6. **Reviewer credibility (nightly):** breadth + scale-usage entropy (all-10s accounts self-identify) + consensus-correlation against the algorithmic score — which gives Gastronome a trusted prior most cold-start communities lack. Weight consensus gently (~30% of the blend) or you build a sycophancy machine that punishes honest contrarians. Cap any single account's influence on any single restaurant.
7. **Verified-visit multiplier (~3x) — only paired with COI containment.** Geofenced check-in (≤75m, plausible hours) multiplies weight; never a hard gate, never a displayed guarantee (GPS spoofing exists). Critical interaction: staff pass the geo check every shift, so verified-visit *helps* owner self-boosting unless venue-loyalty fingerprinting ships with it (>60% concentration on one venue, or check-ins spanning all dayparts → weight zeroed for that venue only, quietly). Plus a legitimate owner channel: claim flow (doc/phone verification), info-edit rights, dispute inbox; claimed owners hard-excluded from rating their own venue.
8. **Brigade detector with auto-quarantine (not auto-delete):** nightly anomaly pass — velocity z-spikes, new-account concentration (>50% of a day's raters <7d old), shared ip/ua clusters, bimodal 1s-and-10s distributions. `quarantined=true` excludes from aggregation, restoration is one UPDATE. Cross-check the social/video signal: real virality has TikTok exhaust, brigades usually don't. Never auto-ban on IP alone (dorms/CGNAT). Display falls back to algorithmic-score-only — possible precisely because community sits BESIDE the score.
9. **Structured-only input at launch:** integers + curated chips; no public free text until moderation capacity exists (Tier-1 identity + LLM screen + report queue when it ships). You can't defame anyone with the number 7. Honest cost: choosing safety over Beli-style notes culture for ~6 months.
10. **The honesty line (policy, written down):** every number labeled with whose opinion it is ("Diner Score — from N Gastronome users"); scoreless shows "Not yet rated" — **never synthesize, extrapolate, or seed fake ratings** (FTC fake-review liability + the reputational kill-shot for a trust product); quarantine framed as "not yet counted," never a public fraud accusation; owners get a dispute channel with an SLA (rate-limited per venue); publish the plain-English `/methodology` page from the `score.ts` doc comment plus a public covenant: *no payment, partnership, or advertiser status has ever changed a score or a rank, and never will.* One-way door — it forecloses sponsored placement forever; the owner should choose it knowingly. Log raw + weighted aggregates from day one so attacks are auditable post-hoc; ship the logging before the weighting.

---

## 7. Full idea catalog (56 deduped from 67 raw)

Ideas raised independently by multiple lenses are marked **(×N)** — treat convergence as a strong prior. ⚠ = flagged dark-pattern-adjacent; healthier shape in §4.

| # | Idea | Lens | Effort | Impact | One-line |
|---|---|---|---|---|---|
| 1 | Verdict Stack rating ladder (Been → return? → 1-10 → dishes) | community + engagement **(×2)** | M | flagship | Friction-laddered tiers; every tap is independently useful data; includes 1-tap Been log + onboarding backfill |
| 2 | Anchored whole-number 1-10 picker ("a 10 doesn't exist yet") | community + ranking + ethics **(×3)** | M | high | Keep the user's 1-10; rubric anchors + guardrails stop "everything is an 8" |
| 3 | Per-rater calibration (shrunk z-normalization per user) | community + ranking + trust **(×3)** | S | high | A tough critic's 8 and a generous rater's 8 are different facts; Netflix-Prize biggest win |
| 4 | This-or-That pairwise duels (Elo/Bradley-Terry) | community + engagement **(×2 flagship bets)** | L | flagship | The Beli hook with cleaner math; scale-free, ⌈log₂ n⌉ taps, genuinely fun, solo-viable |
| 5 | Crowd Rank: per-metro Elo ladder BESIDE the score | community | M | high | Ordinal rank can't visually collide with the calibrated 0-10; seeded from the algorithmic score |
| 6 | "Would you go back?" return-rate headline ("93% · 41 diners") | community + engagement **(×2)** | S | high | Revealed-preference binary, inflation-immune, meaningful first at tiny n |
| 7 | Up/down via Wilson LB — dishes & review helpfulness ONLY | community | S | medium | Cheap triage where it belongs; never the restaurant score; 👍-only at launch |
| 8 | Dish-level 🔥 votes into the existing top-dishes pipeline | community | M | high | Community as one more source in restaurant_dish_signals; crowdsources the 58% menu gap |
| 9 | Phase-3 gated fifth source in gastronomeScore() | community + ranking **(×2)** | M | flagship | w_c = 0.35·n/(n+40): 4 votes whisper, 400 speak; owner-gated via QUESTIONS.md + /lab preview |
| 10 | First Fork / Scout / Be-the-First scoreless wedge | community + engagement + ethics **(×3)** | S-M | high | Aim votes where marginal information is highest; permanent founder credit; coverage meters |
| 11 | Taste Ledger (percentile of your own ratings) | community | M | medium | "Above 84% of your 31 spots" — self-knowledge that trains deflation; feeds trust consistency |
| 12 | Taste-match calibration ("Gastronome 8.4 · your likely take: 9+") | ethics | M | high | First ten ratings pay the rater immediately — personalized score display, zero score.ts changes |
| 13 | Checklist quests from accolade lists (Eater 38: 12/38) | engagement | M | high | Goal-gradient + Zeigarnik over editorial data; 100% cold-start-proof |
| 14 | Taste Profile reveal at 10/25/50 logs (12 archetypes) | engagement | M | high | Data-backed horoscope; identity maintenance becomes the logging motive |
| 15 | Weekly Bite Streak ⚠ | engagement | S | medium | Loss aversion at dining's real cadence — ethics lens vetoes for v1; recap cadence instead |
| 16 | Tonight's Pick spinner + one Daily Pick per metro ⚠ | engagement | S | high | Variable reward on a real job + Wordle scarcity; quality-gated pool, two re-spins, gentle commit |
| 17 | Taste Rank XP + 5 ungrindable levels ⚠ | engagement | M | medium | Breadth-anchored competence; caps + diminishing returns in v1; doubles as sybil backbone |
| 18 | Badges with teeth (~15, criterion, some hidden, "Day One") ⚠ | engagement | S | medium | Scarcity economics; early becomes status; inflation is the death mode |
| 19 | Scout mechanic: Uncharted pages pay 3x XP + permanent credit ⚠ | engagement | M | medium | Pioneer status pointed at the weakest inventory; photo-gated, revocable, cosmetic only |
| 20 | Taste Match % + friends-only weekly leaderboard + dyadic share card | engagement + growth **(×2)** | L | high | Festinger among knowns; the dyadic card names ONE person, who signs up to correct the record |
| 21 | "My 2026 in Food" + monthly Plate recap cards | engagement | M | high | Wrapped effect; gate at ≥10 visits; lives or dies on visual polish |
| 22 | Hit List: 10-slot capped queue + cross-off ceremony | engagement | S | medium | Saves become curation gameplay instead of a guilt graveyard; overflow shelf as valve |
| 23 | Notifications: "news about YOUR world" rule, calm by default | engagement | L | high | Every push = new info about a restaurant you have a relationship with; guilt/FOMO banned in CLAUDE.md |
| 24 | Taste Passport (been-to map, cuisine grid, auto top-10) | ethics | M | high | Accumulation, never expiry — the Letterboxd line; the ethical replacement for streaks |
| 25 | Engagement decision gate added to CLAUDE.md | ethics | S | medium | Loss-framing, FOMO pushes, variable rewards, volume leaderboards → owner approval required |
| 26 | QFA feed ranker (Q^1.0 · (1+T)^0.5 · A^0.3) | ranking | M | flagship | Bounded multiplicative blend fixes trending-only sort; gated, with why-chips |
| 27 | Taste vector v0 (20 floats, onboarding-seeded, online-updated) | ranking | M | high | favorite_cuisines is collected and decorative today; no ML infra at 3,340 items |
| 28 | Exponential decay + per-source log-caps in trending | ranking | S | high | Kills the cliff-edge window and the documented backfill-spike bug; one gated change |
| 29 | Explore/exploit: seeded daily shuffle now, Thompson later | ranking | S | high | Free Plackett-Luce rotation breaks rich-get-richer; bandits only after impressions exist |
| 30 | MMR diversity pass (λ≈0.75, skip under explicit filters) | ranking | S | medium | No window of 5 with 3 of the same anything; <3% relevance loss for big variety gain |
| 31 | Scoreless fairness: imputed prior −0.3 + UCB slots + evidence gate | ranking | M | high | Quarter of the catalog must not be invisible; never display the imputed number |
| 32 | Day-0 rails: 70/20/10 interleave from onboarding data | ranking | M | high | City-best / taste-matched / explore; a learned policy at zero data would fit noise |
| 33 | Occasion chips (date night / quick lunch / solo) | ranking | L | high | exp(θ·f) boosts over hours/price/Google-chips data that already exists; renormalize over present features |
| 34 | HOME = rails, DISCOVER = deterministic (the honest split) | ranking | M | high | Four transparent rails beat a fake infinite feed at 0 community events; metric gate to graduate |
| 35 | feed_impressions event log foundation | ranking | M | flagship | What was shown, where, what was clicked — prerequisite for everything learned; currently impossible to evaluate any ranking change |
| 36 | Uncharted rail + honest "what we know / don't know" empty states | ethics | M | medium | Admitted ignorance over quiet padding; "Request coverage" demand signal feeds the backfill pipeline |
| 37 | Tear down the anonymous wall (public-read, gated writes) | growth | S | flagship | Every loop currently 307s to death — Googlebot included; reverses a documented decision → owner gate |
| 38 | Score Card OG images on every restaurant URL (+ 9:16 variant) | growth | M | flagship | The score becomes the debate-settling artifact in every group chat; scoreless fallback card required |
| 39 | Settle It: group-chat versus polls | growth | M | high | The algorithmic verdict provokes; the counter-vote requires signup; score shown as immovable ground truth |
| 40 | Beli import → "You vs The Critics" defection card | growth | L | high | Flips Beli's sunk-cost lock-in into identity-bait for the exact target persona; pg_trgm already enabled |
| 41 | Tastemaker pages from restaurant_videos creators | growth | M | high | Ego-bait → claim → broadcast; /community launches populated with 50+ credible lists, not 6 seeded profiles |
| 42 | Programmatic SEO dish pages + dish leaderboards | growth + ethics **(×2)** | L | flagship | "Best birria in East Village" answered from a dish-signal moat nobody else has; ≥3-restaurant evidence gate non-negotiable |
| 43 | The Gastronome 10: weekly metro movers digest | growth | M | medium | Changing rankings get checked weekly; restaurants share their own rank (free B2B distribution) |
| 44 | Pick Tonight: group decision wizard | growth | L | medium | Attacks "where are WE eating" — weekly re-entry into the same chat; narrow guest-cookie exception → owner gate |
| 45 | Founding Critic: per-metro scarcity referral ⚠ | growth | M | medium | Status + city-page visibility payoff; engaged-action gate; autoconfirm OFF first; beware scarcity theater |
| 46 | Server-side RPC write path + per-rating trust ledger | trust | M | flagship | Provenance stamped at insert or lost forever; aggregates sum weights, never count rows; ships BEFORE rating UI |
| 47 | Identity ladder (Tier 0 w=0.05 → Tier 2 w=1.0; OAuth on) | trust + community + ethics **(×3)** | M | high | Don't block fake emails — make them worthless; 100 sybils ≈ 1 established user |
| 48 | Verified-visit geofence multiplier (~3x) | trust | M | high | Physical presence costs attackers a subway ride per vote; weight multiplier, never a hard gate; pair with #52 |
| 49 | Reviewer credibility (breadth + entropy + gentle consensus) | trust | L | high | Weight is earned by rating like a human; consensus capped ~30% so contrarians survive |
| 50 | Trimmed weighted aggregation + shadow batching | trust | M | flagship | Trimmed mean + k=8 shrink + jittered daily recompute: attackers fly blind; own rating shows instantly |
| 51 | Weighted-n display gate ("Early signal — 3 diners") + fuzzy counts | trust | S | high | No number below weighted n≥5; five sybils show nothing, five verified locals publish |
| 52 | Owner/COI containment: claim flow + venue-loyalty fingerprinting | trust | L | medium | The account that lives at one restaurant is staff; zero its weight there only; give owners a legit channel |
| 53 | Brigade detector + auto-quarantine (reversible, never delete) | trust | L | high | Velocity/new-account/IP-cluster/bimodality tells; virality false-positives cross-checked against TikTok exhaust |
| 54 | Structured-only moderation: integers + chips, free text never-at-launch | trust | S | high | You can't defame anyone with the number 7; zero moderation queue at zero staff |
| 55 | The honesty line + Honesty Moat (/methodology, changelog, no-pay covenant, dispute SLA) | trust + ethics **(×2)** | S | flagship | Platform-not-author posture; never synthesize ratings; the covenant is a one-way door the owner chooses knowingly |
| 56 | The Verdict: cross-source consensus card (Unanimous / Contested) + Hidden Gems by residual | ethics | S / M | flagship / high | The agreement math already exists in score.ts — the one feature no single-source competitor can copy; residual (quality − fame) yields the only quantitatively defensible "underrated" list |

*(Merges: Been log + verdict chip → #1/#6; pairwise duels ×2 lenses → #4; write-in 1-10 ×3 lenses → #2; trust tiers ×3 → #47; dyadic Taste Match cards → #20; dish SEO pages + dish leaderboards → #42; honesty line + Honesty Moat → #55; Be-the-First/First Fork/Scout core → #10 with the XP variant kept at #19.)*

---

## 8. Sequenced roadmap

**Stage 0 — Owner decisions (week 0).** Five gates to adjudicate before code: (1) reverse the no-anonymous-browsing decision (public read, gated writes); (2) approve the community-layer placement (BESIDE; UI gate) and the reviews-table revival (re-reverses 20260531000002); (3) adopt the Engagement decision gate in CLAUDE.md; (4) trending decay + caps formula change; (5) operational: turn `mailer_autoconfirm` OFF and flip Google OAuth ON.

**Stage 1 — Make URLs alive (weeks 1-2).** Middleware flip → Score Card OG images (+ scoreless fallback) → **The Verdict consensus card** (display-only, no gate) → sitemap/SEO clock starts. *Depends on: gate 1.*

**Stage 2 — The trust substrate (weeks 1-3, parallel).** Provenance migration + `submit_verdict()` RPC + revoke client INSERT → `user_trust` + raw/weighted logging (weighting OFF) → `restaurant_community_stats` nightly job + weighted-n display gate. **Hard rule: no rating UI ships before this.** *Depends on: gate 2, gate 5.*

**Stage 3 — The single-player loop (weeks 3-7).** Verdict Stack tiers 1-2 + onboarding backfill grid → optional anchored 1-10 (calibration telemetry silent) → Hit List (repurpose `user_favorites`) → checklists from accolade data → "% would return" at n ≥ 5 + named verdicts below min-n → First Fork prompts + honest empty states (data-quality pass on scoreless rows first) → structured-only input. *Depends on: Stage 2 complete.*

**Stage 4 — Ranking foundations (weeks 3-7, parallel).** `feed_impressions` log → trending decay + caps (gate 4) → seeded explore shuffle → HOME rails / DISCOVER split → day-0 70/20/10 interleave → taste vector v0 → scoreless imputation + UCB explore slots → MMR pass. *Impressions gate every later learned ranker.*

**Stage 5 — Depth & fun (months 2-4).** This-or-That duels + personal ranked list → Taste Ledger → Crowd Rank in the 1-2 densest metros → dish 🔥 votes (top-dishes blend weight → QUESTIONS.md) → per-rater calibration live → trust weights enforced + identity ladder → Taste Profile reveal → Taste Passport → XP/badges (caps in v1) → Scout mechanic (photo-gated) → Tonight's Pick / Daily Pick (through the Engagement Gate). *Depends on: Stage 3 volume; trust logging matured ≥30d.*

**Stage 6 — Growth loops (months 3-5).** Beli import → Tastemaker outreach → Settle It → programmatic SEO dish pages (evidence gates) → weekly movers digest → notifications infra (news-about-YOUR-world rule) → monthly Plate recaps → Hidden Gems rail. Taste Match % and Founding Critic only after real user density. *Depends on: Stage 1 (every loop transmits via URL).*

**Stage 7 — Hardening + the gated blend (months 4-6+).** Verified-visit multiplier + COI containment + owner claim flow → brigade detector + quarantine → reviewer credibility job → Thompson sampling on real impressions → QFA blended feed behind the >500-weekly-active-voters metric gate → **QUESTIONS.md proposal for community as the fifth source** (prereqs: ≥500 calibrated ratings; calibration live ≥60d; trust weights + brigade detector live; median rated restaurant ≥30 weighted votes), previewed with real deltas on `/lab`. *Owner adjudicates; until then the community layer stays BESIDE.*

**Gating-dependency summary:** public-read unlocks all sharing/SEO loops → the trust ledger unlocks any rating UI → autoconfirm-OFF + weighted-n gates unlock any public aggregate → the impressions log unlocks any learned ranking → calibration history + trust weights + volume thresholds unlock the fifth-source proposal → owner approval unlocks any touch of `score.ts`, trending weights, the top-dishes blend, or a loss-framed engagement mechanic.
