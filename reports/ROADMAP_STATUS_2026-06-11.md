# Gastronome Roadmap Status — 2026-06-11

**Project:** epicurious / trwdqzsfgeydafojajbh
**Compiled by:** gates-wrapup agent
**Git refs below from:** `git log --oneline` (top 9, 2026-06-11)

---

## Stage status table

| Stage | Name | Status | Notes |
|---|---|---|---|
| 0 | Decision gates | **Shipped** — a8d4d77, c79c5fd | Q-002..Q-006 all owner-approved 2026-06-10. Middleware public-read, community schema, engagement gate in CLAUDE.md, trending decay code, auth ops runbook. |
| 1 | URLs alive | **Shipped** — a7dcfcc | Verdict consensus card (display-only), Score Card OG images, sitemap/SEO base. |
| 2 | Trust substrate | **Shipped** — a7dcfcc | submit_verdict() SECURITY DEFINER RPC, provenance columns on reviews, INSERT/UPDATE revoked from authenticated, user_trust + restaurant_community_stats + user_rating_stats tables, weighted-n display gate logic. |
| 3 | Single-player loop | **Shipped** — 492b347 | Verdict Stack tiers 1-2 + onboarding backfill grid, Hit List, checklists, First Fork prompts, named verdicts below min-n, honest empty states. |
| 4 | Ranking foundations | **Shipped** — 15c4aac, cbec6f1 | feed_impressions log, trending decay + caps (Q-005 Option A, code complete), HOME transparent rails, DISCOVER split, taste vector v0, seeded explore shuffle. |
| 5 | Depth & fun | **Built-but-dormant / in progress** | Duels schema + computeCommunityStats.ts (Elo nightly) exist. Crowd Rank data pipeline live. Public display gated (Q-010, open). This-or-That duel UI not yet shipped. Taste Profile, Taste Passport, XP/badges, Scout, Tonight's Pick not yet shipped. |
| 6 | Growth loops | **Not started** | Beli import, Tastemaker outreach, Settle It, programmatic SEO dish pages, weekly movers digest, notifications infra, monthly Plate recaps, Founding Critic referral all pending. Blocked on owner external actions (see below). |
| 7 | Hardening + gated blend | **Not started** | Verified-visit multiplier, brigade detector, reviewer credibility job, Thompson sampling (Q-008), QFA blended feed (Q-009), community as fifth source (Q-007) all metric-gated or awaiting volume. |

---

## Built-but-dormant: behind display gates or env flags

| Item | What exists | What is blocking display |
|---|---|---|
| Trending decay formula | Fully implemented in `src/lib/ranking/trending.ts` per Q-005 Option A, commit c79c5fd | `NEXT_PUBLIC_TRENDING_FORMULA=decay` env var not yet set in Vercel. **Immediately actionable** (Q-009 sub-decision (a)). |
| Crowd Rank data | `restaurant_community_stats.elo`, `n_comparisons`, nightly Elo job (`scripts/computeCommunityStats.ts`) all live | Public ladder UI not built; display gated on ≥10 comparisons per restaurant + owner approval of dense-metro choice (Q-010, open). |
| Community score display | Community stats recomputed nightly; weighted-n gate logic wired | Display of "Community 7.4 · 20+ ratings" gated on ≥5 weighted n AND ≥3 calibrated raters — no user votes yet exist to trigger it. |
| Trust weights | user_trust table exists with default weight=0.25 | Trust weighting logic in aggregation deliberately OFF until calibration has ≥60d history (Q-007 prereq 2). |

---

## Metric-gated (cannot ship until thresholds are met)

| Gate question | Metric threshold | Earliest realistic |
|---|---|---|
| Q-007 Community as fifth source in score.ts | ≥500 calibrated ratings platform-wide; calibration live ≥60d; trust weights + brigade detector live; median rated restaurant ≥30 weighted votes | Month 6–12 (volume-dependent) |
| Q-008 Thompson sampling on feed_impressions | ≥30 days of impression data in feed_impressions | ~2026-07-14 (30d after Stage 4 deploy) |
| Q-009(b) QFA blended feed | ≥500 weekly active voters | Volume-dependent; no date estimate |
| Q-010 Crowd Rank public ladder | ≥200 total comparisons + ≥30 restaurants with ≥10 comparisons in the densest metro | Volume-dependent; duels UI not yet shipped |

---

## Owner external actions required (not code work)

These items require console access, third-party accounts, or outreach. No amount of code commits unblocks them.

| Item | Where | Notes |
|---|---|---|
| Q-006: Google Cloud OAuth client + Supabase Google provider | Supabase dashboard + Google Cloud Console | Runbook at `reports/stage0/gate5-auth-ops/RUNBOOK.md`. Fixes P0 broken Google button. |
| Q-006: Resend SMTP + mailer_autoconfirm=false + HIBP | Supabase dashboard + Resend.com | Must ship BEFORE any public aggregate number renders (engagement report §6 item 2). |
| Q-006: Vercel env vars | Vercel dashboard | Required: `NEXT_PUBLIC_GOOGLE_AUTH`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_SITE_URL`. Maps JavaScript API must be enabled separately from Places API. |
| Q-009(a): NEXT_PUBLIC_TRENDING_FORMULA=decay | Vercel dashboard | One env var. Immediately actionable — formula is already deployed. Fixes documented April-backfill ranking bug. |
| Stage 6: Beli import pipeline | Engineering + outreach | Requires user CSV/screenshot flow design; no API available. |
| Stage 6: Tastemaker outreach | Manual | `restaurant_videos.author_username` with ≥5 videos auto-generates pages; creators must be notified manually. |
| Stage 6: Push notifications | Apple Dev / FCM accounts | Required before any notification infra ships. |

---

## Commit reference (git log --oneline, top 9, 2026-06-11)

```
cbec6f1  Fix CI lint: defer rail personalization setState, prefer-const x2
80f2c71  Fix CI: omit optional submit_verdict params instead of passing null
15c4aac  Stage 4: feed impressions log, HOME transparent rails, explore lib, taste vector v0
4914116  Fix CI lint: sync setState-in-effect (BackfillGrid, VerdictSheet) + JSX apostrophe
492b347  Stage 3: Verdict Stack, community module, First Fork, Hit List, checklists, onboarding backfill
a7dcfcc  Stages 1-2: OG score cards, Verdict consensus card, submit_verdict RPC, community stats job, SEO base
fd4aa26  Fix CI: trending types vs regenerated nullable created_at + test fixtures
c79c5fd  Apply all five approved Stage-0 gates (Q-002..Q-006, owner: "approve all 5")
a8d4d77  Stage-0 decision packages: 5 gate plans + verified patches, Q-002..Q-006 filed
```

Stages 0–4 are all represented by committed, CI-passing code. Stages 5–7 are data + private surfaces only (as required by SHARED FACTS) until owner adjudicates the open questions above.
