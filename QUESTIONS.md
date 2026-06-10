# Open Questions for D

> Size limit: archive answered questions older than 14 days into QUESTIONS-archive-<YYYY-MM>.md.

Entry format:

## YYYY-MM-DD HH:MM — <agent-name> — Q-<id>
**Context:** what they were working on
**Question:** the specific decision needed
**Options:**
  A) option one — tradeoff
  B) option two — tradeoff
  C) option three — tradeoff
**Agent recommendation:** A, because…
**Blocking:** which BACKLOG.md item is paused on this
**Status:** open | answered: <pick + notes> | needs-revision: <reason> | wrong-gate: <reason>

---

## 2026-05-23 — api-builder — Q-001

**Context:** BACKLOG Now `[api]` — `src/app/cities/page.tsx:49-99` fires ~8 queries/city (`Promise.all` of 6 `count:'exact'` + sample + union-OR Michelin count), ~40 round-trips for 5 cities. Must stay byte-identical to today's UI and agree with `/cities/[slug]` totals.

**Question:** Which shape replaces the fan-out?

**Options:**
  A) In-place rewrite: one `restaurants` SELECT per page (`city, michelin_stars, michelin_designation, james_beard_winner, eater_38, google_rating, cuisine`) with `ilike` city match, bucket counts/avgs in JS. No new endpoint, no schema change → DO-eligible. Risk: pulls every row's small payload (~few KB/city) on each render; `revalidate=60` caps cost.
  B) New RPC `get_city_stats()` returning aggregated rows. Cleaner, single round-trip, server-side aggregation. Trips api-builder "new endpoint" gate + may want a `(city, accolade-flag)` index (>100k row gate on `restaurants` — currently not, but trajectory says yes).
  C) Materialized view `city_stats_mv` refreshed nightly. Fastest at read time; staleness window + refresh job to own.

**Agent recommendation:** A — smallest blast radius, no new surface area, preserves slug-page consistency via the same `ilike` predicate, ship-day appropriate. Revisit B if payload grows.

**Blocking:** BACKLOG Now `[api]` cities aggregate.

**Status:** answered: Option A — in-place rewrite, one SELECT bucketed in JS. No new RPC, no schema change. Ship-day appropriate.

---

## 2026-06-10 — stage0-planning — Q-002 (gate1)

**Context:** Preparing Stage-0 decision gate from ENGAGEMENT_AND_COMMUNITY_SCORING_2026-06-09.md §8 gate (1). The middleware at `src/lib/supabase/middleware.ts` lines 92-97 issues a 307 redirect to `/onboarding` for every anonymous request — Googlebot included. The RLS migration `20260530000001_aggregator_tables_rls.sql` already grants the Supabase `anon` role SELECT on all public restaurant tables. The wall is middleware-only and protects nothing that RLS does not already protect. Every growth loop in the engagement report transmits through a pasted URL; every shared link currently dead-ends at the onboarding wall. UIUX catalog item onboarding-02 (P0 ⭐ panel 3/3) documents the companion defect: the redirect strips `url.search`, so users who sign up from a shared link land on home, never on the shared page. The OG Score Card (per-restaurant og:image) is a separate follow-on item scoped out of this patch — it is useless until this gate passes.

**Question:** Should the no-anonymous-browsing decision be reversed? Specifically: remove the anonymous redirect block from middleware so public restaurant/city/explore pages render for unauthenticated visitors, while write actions remain gated via the existing `openSignInModal()` component-level flow. Companion change: thread `?next=<pathname>` through the onboarding redirect for authed-but-incomplete users so deep links survive sign-up (fixes onboarding-02).

**Options:**
  A) Full public-read — remove the anonymous redirect block entirely. All routes become readable without an account. Write actions remain gated at the component level (openSignInModal already wired in BookmarkButton, Navigation, profile/page). Add `?next=` deep-link threading to the authed-but-incomplete redirect. Rollback is one comment-toggle or ANONYMOUS_WALL=true env flag. SEO clock starts immediately on deploy. ~2 hours of work.
  B) Selective exemption — add `/restaurants`, `/explore`, `/discover`, `/cities`, `/search`, `/community` to ONBOARDING_EXEMPT_PREFIXES rather than removing the anon guard. Home page `/` and uncharted routes stay behind the wall. Preserves more of the original intent; every new route still needs a manual exemption. Still requires the `?next=` fix; ~same work. Partial SEO win.
  C) Keep the wall, fix only `?next=` deep-link threading — no public access. Shared links require sign-up to view. Googlebot still indexes zero restaurant pages. Growth loops remain dead. Fixes onboarding-02 only.

**Agent recommendation:** A. The wall currently costs zero SEO indexing across 3,340 restaurant pages, a broken K-factor denominator (every shared URL converts to `/onboarding` instead of the target page), and dead growth loops. The wall protects nothing that RLS does not already protect — the Supabase anon key already has SELECT on all public restaurant tables by design. Option A reverses a documented product decision cleanly and starts the SEO clock. Option B is a reasonable fallback if keeping home/profile behind the wall is important. Option C defers the structural problem.

**Blocking:** Stage-1 implementation (Score Card OG images, sitemap SEO, all sharing mechanics in Stage 6). Every sharing K-factor loop in the engagement report is blocked on this gate.

**Status:** open

---

## 2026-06-10 — stage0-planning — Q-003 (gate2)

**Context:** Engagement report §8 Stage 0 gate 2: re-reverse the "Gastronome is a pure aggregator" decision (migration 20260531000002) by reviving the reviews table as the Verdict Stack's backing store, adding a full server-side provenance ledger before any rating UI ships, and placing community output BESIDE (not inside) the Gastronome Score. Live schema verified: reviews table exists with 9 columns (id, restaurant_id, author_id, title NOT NULL, content NOT NULL, rating integer NOT NULL, visit_date, created_at, updated_at), RLS enabled, critics-only INSERT policy, zero production rows.

**Question:** Approve the community layer foundation: (a) extend reviews table with provenance columns + whole-number 1-10 constraint + one-verdict-per-user UNIQUE; (b) create restaurant_comparisons, restaurant_community_stats, user_trust, review_votes, user_rating_stats tables; (c) revoke direct INSERT/UPDATE on reviews from anon + authenticated; (d) establish submit_verdict() SECURITY DEFINER RPC as the only write path; (e) community module placed BESIDE (below) the Gastronome Score block in a distinct "Diners" card, never sharing the 0-10 scale label at low n.

**Options:**
  A) Full schema as specified + RPC skeleton in one migration — provenance on every row from row zero, UNIQUE constraint free to add now. title/content made nullable (no data loss; reviews=0). Recommended by report §6 item 1. Regenerate database.ts after apply.
  B) Minimal first: provenance columns + UNIQUE only, defer RPC revoke to a second PR within the same week — smaller blast radius but leaves the sybil pipe open until PR 2 lands.
  C) New verdicts table instead of extending reviews — clean separation but creates a permanent split data model, doubles query surface, contradicts report recommendation, no benefit at reviews=0.

**Agent recommendation:** A — provenance columns + RPC + REVOKE in one atomic migration. The trust lens's hard rule is explicit: "The RPC ships BEFORE any rating UI." Option A makes that sequence enforceable by blocking feature-builder on api-builder RPC completion. Option B requires disciplined follow-through under deadline pressure; Option C adds permanent complexity for no gain.

**Blocking:** Stage 2 (trust substrate) implementation; Stage 3 Verdict Stack UI; all community scoring work. Also recommend adjudicating alongside Gate 5 (autoconfirm OFF + Google OAuth ON) since §2 rollout Phase 1 requires autoconfirm OFF before any public aggregate renders.

**Status:** open

---

## 2026-06-10 — stage0-planning — Q-004 (gate3)

**Context:** Engagement & Community Scoring report §4 ("The Engagement Gate") identified four mechanic classes — loss-framing/expiry, interpersonal-comparison notifications, variable-ratio reward schedules, and contribution-volume leaderboards — that are effective but ethically contested. The report recommended adding a named decision gate to CLAUDE.md so these trades are deliberate rather than defaults-drift. Two code defaults were also proposed: social/comparison notifications opt-in, no public contribution-volume metrics.

**Question:** Adopt the Engagement decision gate in CLAUDE.md (engagement-gate.patch) and the accompanying notification policy?

**Options:**
  A) Adopt as written — add the Engagement gate paragraph + two code defaults to CLAUDE.md; add notification-policy.md as a standing policy doc. ~30 min, zero src/ changes, zero migrations.
  B) Adopt with narrower scope — gate variable-ratio rewards only; treat loss-framing and comparison notifications as normal product decisions without a gate. Faster; defends less.
  C) Defer — build the mechanics first, add governance later. No CLAUDE.md change now.

**Agent recommendation:** A — the gate is trivially cheap and expensive to retrofit. The honest trade stated plainly: some banned-by-default mechanics genuinely drive month-1 retention (Beli's forced ranking, Duolingo's streak). This gate is not "they don't work." It is "we choose slower month-1 growth for month-12 trust, once, in writing." Option C means every future engagement proposal relitigates this trade from scratch; Option B surrenders the two classes most likely to generate user complaints (FOMO pushes, streak guilt). The patch is one hunk, ~25 lines, rollback in 2 minutes.

**Blocking:** Any future BACKLOG item proposing streaks, FOMO notifications, variable-ratio spinners (unrestricted), or activity-count leaderboards is blocked on this gate. Directly prerequisite to the social notifications design and public-profile design when those features are built.

**Status:** open

---

## 2026-06-10 — stage0-planning — Q-005 (gate4)

**Context:** Stage 0 gate 4 of the ENGAGEMENT_AND_COMMUNITY_SCORING_2026-06-09 roadmap. `src/lib/ranking/trending.ts` uses a rectangular time window (default 7d) with no recency gradient and no per-source volume cap. Two documented bugs: (a) cliff-edge — score drops to zero at the window boundary with no real-world signal change; (b) backfill-spike — 40 TikToks ingested in one pipeline run contribute 120 pts vs 15 pts for an organic 1-video/day-for-5-days restaurant. Live DB simulation (project trwdqzsfgeydafojajbh, 2026-06-10): under the current 30d formula, NY top-20 trending restaurants all have their videos from the April–May backfill batches (3-6 weeks old) and score 12-18 pts; 20+ restaurants with 3 recent videos from the June 8 batch sit at rank 22-41 and are invisible to trending. Under the proposed decay formula those June-8 restaurants rise to ranks 1-20, and the stale April-batch restaurants fall to 150+. The ENGAGEMENT report (§3) prescribes this fix as Stage 4 prerequisite for the QFA blended ranker.

**Question:** Approve replacing the rectangular-window event count in `trending.ts` with exponential decay `w·2^(−Δt/h)` (h=72h videos, 168h reviews/photos) plus per-(restaurant, source, day) log₂(1+n) caps?

**Options:**
  A) Full fix: exponential decay + per-day log₂ cap — kills both cliff-edge and backfill-spike; 40-video batch contributes ~16 pts at ingestion vs 120 pts today, decaying to ~8 pts after 72h; one organic video/day for 5 days contributes ~7.9 pts. Requires `fetchRawData` to return `created_at` per event; `computeScoresFromData` signature changes. Large rank churn on first deploy (all videos older than ~10 days score near-zero). Tuning knobs in `weights.ts`: `videoHalfLifeHours` (72), `reviewHalfLifeHours` (168), `capBase` (2), `decayFloor` (0.001).
  B) Decay only, no cap — fixes cliff-edge, does NOT fix backfill-spike. 40-video batch still wins 8× over organic at ingestion. Simpler implementation.
  C) Per-day cap only, no decay — fixes backfill-spike partially (multi-day backfills still stack), does NOT fix cliff-edge. Minimal code change; preserves Window type semantics exactly.

**Agent recommendation:** A — the two bugs are coupled (recency and volume) and Option A fixes both in one coherent change prescribed by the ENGAGEMENT report. The formula is self-documenting via `weights.ts` tuning knobs and the `debugTrending` admin endpoint can expose per-event decay weights to power the planned why-chip ("Trending because: 3 videos in the last 2 days"). Deploy behind a `NEXT_PUBLIC_TRENDING_FORMULA=decay` flag to allow staged rollout and instant rollback with no schema changes.

**Blocking:** Stage 4 ranking foundations (trending decay + caps → seeded explore shuffle → HOME rails / DISCOVER split). Also blocks the QFA blended ranker (Gate 5, not yet proposed).

**Status:** open

---

## 2026-06-10 — stage0-planning — Q-006 (gate5)

**Context:** Stage 0 gate 5 — operational auth. Two interlocked changes required before Stage 2 (trust substrate + any public community aggregate): (1) Google OAuth provider enablement (currently OFF; every "Continue with Google" click navigates to a raw 400 JSON page — onboarding-01, P0 in the UIUX catalog, 3/3 panel), (2) mailer_autoconfirm=false (currently ON; fake emails cost nothing, creating free sybil pipes the identity ladder is designed to defeat). Verified via DB: 6 total users, 0 Google OAuth users, 1 stuck-unconfirmed since 2026-04-11. Turning autoconfirm OFF makes email delivery load-bearing — Supabase's built-in mailer is rate-limited at ~3/hr and not for production use, so an SMTP provider must be chosen first. Engagement report §6 item 2 and §2 phase 1 rollout both state autoconfirm OFF is a hard prereq before any public aggregate number renders; §5 item 10 states it must precede any referral mechanic.

**Question:** Approve the full auth operations package: (a) create Google Cloud OAuth client and enable Google provider in Supabase, (b) select Resend as SMTP provider, (c) flip mailer_autoconfirm=false + enable HIBP password protection — all executed in the order in RUNBOOK.md; or choose a partial/deferred path?

**Options:**
  A) Full path: Google OAuth + Resend SMTP + autoconfirm OFF + HIBP, all at once (~1 hour of dashboard work). Fixes the P0 broken button, closes the sybil pipe, makes identity tier meaningful for the trust ledger. Recommended. See gate5-auth-ops/RUNBOOK.md for exact console paths and Management API curl.
  B) Google OAuth only now; defer autoconfirm/SMTP. Fixes the visible P0 immediately. Autoconfirm stays ON — identity ladder works but Tier-0 sybil economics remain soft. Must revisit before any referral mechanic or public aggregate number.
  C) autoconfirm OFF + SMTP now; Google OAuth later. Closes the sybil pipe first. Leaves the P0 broken Google button in place (interim patch hides it, not fixes it); delays the only social-login path.

**Agent recommendation:** A — the changes are coupled (autoconfirm OFF without SMTP breaks new signups; Google OAuth without fixing autoconfirm adds Tier-1 users to a still-porous identity model); doing them together in one sitting is less risky than two separate dashboard sessions. Resend's free tier (3,000 emails/month) covers Gastronome's entire early growth phase. The interim patch (google-button-guard.patch) should be deployed regardless of choice to prevent the JSON 400 while setup is in progress.

**Blocking:** Stage 2 trust substrate (submit_verdict() RPC + identity tier stamping); any public community aggregate number ("% would return · N diners"); Founding Critic / referral mechanic (Stage 6).

**Status:** open
