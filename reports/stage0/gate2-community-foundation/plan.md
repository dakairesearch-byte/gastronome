# Gate 2 — Community Layer Placement (BESIDE) + Reviews-Table Revival

**Date:** 2026-06-10
**Prepared by:** stage0-planner
**Status:** AWAITING OWNER DECISION
**Depends on:** Gate 5 (autoconfirm OFF + Google OAuth ON) — recommended to adjudicate together
**Blocks:** Stage 2 implementation (trust substrate), all Stage 3 Verdict Stack work

---

## Context

The engagement report (§2, §6, §8) recommends reviving the `reviews` table as the Verdict Stack's backing store, adding a full provenance ledger to every row via a `SECURITY DEFINER` RPC before any rating UI ships, and displaying community output BESIDE (not inside) the Gastronome Score.

This gate reverses the decision encoded in migration `20260531000002_drop_review_aggregate_trigger.sql`, which declared Gastronome a "pure aggregator — no user-authored reviews." That decision is being re-examined because: (a) the verdict stack is structurally different from traditional text reviews; (b) at reviews=0 the migration cost is zero; (c) the trust ledger is only retroactively impossible — now is the cheapest moment forever.

**Live schema verified 2026-06-10:**
- `reviews` table exists with columns: `id uuid`, `restaurant_id uuid`, `author_id uuid`, `title text NOT NULL`, `content text NOT NULL`, `rating integer NOT NULL`, `visit_date date`, `created_at timestamptz`, `updated_at timestamptz`
- RLS is enabled; policies: public SELECT, critics-only INSERT (`profiles.is_critic`), author UPDATE/DELETE
- Table-level grants: anon + authenticated both hold INSERT — the "critics-only INSERT" policy is the only gate, and it can be bypassed if `is_critic` is tampered
- No provenance columns exist yet
- `title` and `content` are NOT NULL — Verdict Stack (no free text at launch) requires making both nullable

---

## The proposed change

### What ships in Stage 2 (trust substrate — weeks 1-3)

1. **Provenance columns on `reviews`** — `would_return`, `dish_tags`, `trust_weight`, `identity_tier`, `visit_verified`, `ip_hash`, `ua_hash`, `quarantined`, plus a whole-number rating CHECK and a per-user-per-restaurant UNIQUE constraint. `title` and `content` made nullable.
2. **Three new tables** — `restaurant_comparisons` (duels), `restaurant_community_stats` (materialized aggregates), `user_trust` (sybil weights).
3. **`review_votes` table** — review helpfulness Wilson-sort substrate.
4. **`user_rating_stats` table** — per-user μ/σ for calibration, updated nightly.
5. **`submit_verdict()` SECURITY DEFINER RPC** — the only write path into `reviews` from authenticated clients; stamps all provenance fields; revokes direct INSERT/UPDATE from `anon` and `authenticated`.
6. **RLS policy replacement** — remove "Critics can create reviews" INSERT policy (RPC bypasses RLS anyway); keep public SELECT; add authenticated SELECT for own rows. `restaurant_comparisons` is public-read with client writes revoked — it carries trust columns clients must not forge; duels write via a Phase 2 `submit_comparison()` SECURITY DEFINER RPC. *(Amended by overseer F2 2026-06-10: the draft migration originally created a direct "Authenticated insert comparisons" policy, contradicting the RPC-only write model.)*

### What does NOT ship until later (explicit phase gates)

- Per-rater calibration going live (Phase 2, §2 rollout — telemetry silently from day one, weights OFF)
- This-or-That duels UI (Phase 2)
- Crowd Rank display (Phase 2, densest 1-2 metros only)
- Community as a fifth source in `score.ts` (Phase 3, owner-gated via QUESTIONS.md, requires ≥500 calibrated ratings + calibration live ≥60d + trust weights + brigade detector)
- `restaurant_community_stats` nightly job (schema ships now; job ships with Stage 3 when there is data to aggregate)
- Trust weights enforced (Phase 2; Phase 1 logs raw trust data silently)
- Brigade detector (Stage 7)

### UI placement (BESIDE — "% would return" module)

This is the UI gate within this gate. See `ui-placement-proposal.md` for the wireframe-in-words. Summary:

The community layer renders in a visually distinct "Diners" card placed **directly below the Gastronome Score block** on the restaurant detail page. It never shares the 0-10 scale label. Three states:
- **Below threshold (n < 5 weighted):** "Be the first to review" CTA + any named individual verdicts from logged-in connections
- **At threshold (n ≥ 5):** "% would return · N diners" as the headline stat, with confidence dots; if numeric ratings also meet the ≥5 / 3-calibrated-raters threshold, "Diner Score X.X" appears below it
- **With Crowd Rank (Phase 2, 10+ comparisons):** "#N in [City]" ordinal badge appended — never a competing 0-10

No `score.ts` changes. No formula gate triggered by this gate.

---

## Options

### A — Full schema as specified + RPC (RECOMMENDED)

Ship all provenance columns, all new tables, the RPC, and revoke direct writes in one migration. Aligns with the report's hard rule: "no rating UI ships before this."

**Pros:** One migration, one PR, the trust ledger is in place from row zero. Future columns (calibration fields, brigade flags) are additive. The UNIQUE constraint on `(user_id, restaurant_id)` is free to add now and catastrophically expensive to retrofit later.

**Cons:** Larger migration to review. Makes `title` and `content` nullable — a breaking change for any code that currently writes reviews (confirmed: zero production reviews exist, so no data migration needed, but the TypeScript types will need regeneration).

**TypeScript note:** After applying, regenerate `src/types/database.ts` from Supabase (normal post-migration step, schema-guardian lane).

### B — Minimal: provenance columns + UNIQUE only, defer RPC

Add only the provenance columns and the UNIQUE constraint. Leave RLS INSERT policy in place, defer the RPC to a second PR.

**Pros:** Smaller first migration.

**Cons:** Directly contradicts the trust lens's core requirement: "Revoke client INSERT on reviews (current RLS allows it — a free sybil pipe tonight)." If a rating UI ships before the RPC is in place, provenance is never stamped. The report is explicit: "The trust ledger ships BEFORE any rating UI." This option is safe only if the RPC follows in the same week before any UI work starts.

### C — New table `verdicts` rather than extending `reviews`

Leave `reviews` alone, create a new `verdicts` table for the Verdict Stack.

**Pros:** Clean separation; no breakage risk to existing code paths.

**Cons:** The report explicitly recommends extending `reviews` to avoid a split data model. `review_photos` already FK-references `reviews`; if users later add photos to verdicts those go to a different table. Two tables means two queries everywhere. The migration 20260531000002 comment explicitly left the `reviews` table intact for this kind of future extension. Option C creates complexity for no gain at reviews=0.

---

## Recommendation

**Option A.** The provenance-first constraint is the report's highest-trust-lens requirement and the cost is zero at reviews=0. Option B is acceptable only as a 48-hour stepping stone if the owner wants a smaller first review. Option C adds permanent complexity for no benefit.

---

## Rollout steps

1. Owner approves this gate (and Gate 5 re: autoconfirm OFF timing).
2. schema-guardian applies `20260610_community_foundation.sql` (this gate dir) — runs in a transaction, idempotent guards throughout.
3. api-builder implements `submit_verdict()` RPC body (skeleton in `submit_verdict_rpc.sql`; body logic is a Stage 2 implementation task, not this gate).
4. schema-guardian regenerates `src/types/database.ts`.
5. No UI work begins until Step 3 is complete and tested.
6. `restaurant_community_stats` nightly job scaffolded (no data yet; job is a no-op until Stage 3).

---

## Rollback plan

All DDL in the migration is reversible:
- `ALTER TABLE reviews DROP COLUMN <col>` for each added column (no data to lose; reviews=0)
- `DROP TABLE` for each new table (all new, no data)
- `REVOKE ... GRANT ...` to restore previous privileges
- Re-add the "Critics can create reviews" INSERT policy

A companion `20260610_community_foundation_rollback.sql` is provided in this gate dir for reference.

---

## Success metrics (Stage 2 complete)

- `submit_verdict()` RPC exists and is callable by authenticated users
- Direct INSERT on `reviews` from `authenticated` role returns permission denied
- `user_trust`, `restaurant_community_stats`, `restaurant_comparisons`, `review_votes`, `user_rating_stats` tables exist with correct RLS
- TypeScript types regenerated without errors
- Zero production reviews exist (verified pre-migration; confirm post-migration)

---

## Key risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| `title`/`content` nullable breaks existing review-write code | Low (reviews=0, no active write path) | Verify in type regeneration; any broken path was dead code |
| RPC not shipped before UI work starts | Medium | Add to CLAUDE.md lane rules: feature-builder blocked on api-builder RPC completion |
| `is_critic`-gated INSERT policy was load-bearing for some admin flow | Low | Verified: 0 rows in reviews; check if any scripts reference it |
| `rating integer` vs `numeric` — CHECK constraint syntax | Verified | Live column is `integer`; CHECK uses `BETWEEN 1 AND 10` (integers satisfy floor() check natively) |
| UNIQUE constraint `(author_id, restaurant_id)` blocks re-vote edits | Addressed | RPC uses `INSERT ... ON CONFLICT (author_id, restaurant_id) DO UPDATE` (upsert) |
