# Agent State Log

> Size limit: keep only the last 2 cycles inline. Older entries roll to STATE-archive-<YYYY-MM>.md (see CLAUDE.md "Coordination file size limits").

## Last cycle: 2026-06-11 (gates-wrapup — Q-007..Q-010 + roadmap status)

## Per-agent status (gates-wrapup this cycle)
- **gates-wrapup**: DONE — appended Q-007..Q-010 to `QUESTIONS.md` (all status: open). Created `reports/ROADMAP_STATUS_2026-06-11.md` (one-page stage table: shipped 0-4, built-but-dormant gates/flags, metric-gated Q-007..Q-010, owner external actions). Rotated old Previous cycle to `STATE-archive-2026-05.md`. No `src/` changes; no migrations; no schema changes.

## Open questions added this cycle
- **Q-007** (open): community as fifth source in score.ts — `w_c = 0.35·n/(n+40)`, metric-gated, `/lab` preview first. Stage 7.
- **Q-008** (open): Thompson sampling on feed_impressions Beta posteriors — gated on ≥30d impression data (~2026-07-14 earliest). Stage 7.
- **Q-009** (open): (a) flip `NEXT_PUBLIC_TRENDING_FORMULA=decay` in Vercel **immediately actionable today** — one env var, formula already deployed; (b) QFA blended feed gated on ≥500 weekly active voters. Stage 7.
- **Q-010** (open): Crowd Rank public ladder in densest metro — gated on ≥200 comparisons + ≥30 restaurants with ≥10 each. Stage 5/7.

## Immediately actionable owner action (no code needed)
- Set `NEXT_PUBLIC_TRENDING_FORMULA=decay` in Vercel dashboard. Fixes documented April-backfill ranking bug. Formula is already deployed (commit c79c5fd). See Q-009(a).

## Open PRs
- No new PRs this cycle. Stages 0-4 committed to main.

## Blockers
- All Stage 5-7 work blocked on either volume thresholds (metric gates) or owner external actions (Vercel env vars, Google OAuth setup, Resend SMTP, autoconfirm OFF). See `reports/ROADMAP_STATUS_2026-06-11.md`.

---

## Previous cycle: 2026-05-23 (api-builder — Q-001 implementation)

## Per-agent status (api-builder this cycle)
- **api-builder**: Implemented Q-001 Option A (answered: Option A, in-place rewrite). Rewrote `src/app/cities/page.tsx` to replace the per-city `Promise.all` fan-out (8 queries/city, ~40 round-trips for 5 cities) with exactly 2 round-trips: (1) `cities` SELECT, (2) one `restaurants` SELECT of `city, michelin_stars, michelin_designation, james_beard_winner, eater_38, google_rating, cuisine` — all cities bucketed in JS using case-insensitive key match (same semantics as `ilike`). Michelin union logic preserved via JS filter (`michelin_stars > 0 || michelin_designation !== null`). Avg rating and top cuisines computed over full city bucket (not a 500-row sample). UI JSX is byte-identical. TypeScript check: only pre-existing repo-wide env errors (missing `next`/`react`/`lucide-react` declarations); zero errors introduced by this change. BACKLOG Now `[api]` item marked done.

## Open PRs
- PR #18 — "Replace Hidden Gems with Consensus Picks collection" (open, under revision).
- Branch `claude/fix-broken-buttons-Lfy44` has `.env.example` commit; draft PR needs manual creation.

## Blockers
- None. Q-001 unblocked and shipped.

---

## Archived: cycles 1–10 + design-ux cycle 11 + 6-lane no-op cycle → STATE-archive-2026-05.md
