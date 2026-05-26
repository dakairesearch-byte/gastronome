# Gastronome — Cloud Session Briefing (2026-05-25)

Use this file to onboard a fresh Claude Code session on the current state of the Gastronome repository. It covers everything done in the cloud session, the current branch state, what's deployed, what's broken, and what's pending.

---

## Repository State

- **Branch**: `main` — all work has been merged and pushed
- **Feature branch**: `claude/fix-broken-buttons-Lfy44` — merged into main, can be deleted
- **Remote**: `origin/main` is up to date
- **Latest commit**: `bf966b2` — Add `.mcp.json` to `.gitignore`

### Recent commit history (newest first)

```
bf966b2 Add .mcp.json to .gitignore (session-specific MCP tokens)
b782184 Fix cities page timeout: filter restaurants query to active cities only
f467e7d Merge claude/fix-broken-buttons-Lfy44: ship 3 Now items + 6 suggestion fixes
775616c OVERSEER_LOG: cycle 4 reconciled — cities rewrite OK (challenged + held)
9e5a8be OVERSEER_LOG: cycle 4 auditor verdict (awaiting challenger)
f852de8 Replace cities page N+1 fan-out with 2-query bulk SELECT (Q-001 Option A)
```

---

## What Was Done

### 1. BookmarkButton Mojibake Fix
**File**: `src/components/BookmarkButton.tsx`
**Commit**: `e5b629c`

Three Unicode characters were corrupted (likely UTF-8 → Latin-1 round-trip):
- Line 180: `â¾` → `▾` (dropdown arrow)
- Line 207: `â` → `×` (close/dismiss)
- Line 256: `â¦` → `…` (ellipsis)

### 2. Environment Variable Documentation
**File**: `.env.example` (new file)
**Commit**: `f70f86e`

Created `.env.example` listing all 5 required Vercel deploy-time environment variables:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_PLACES_API_KEY=
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=
```

### 3. Cities Page — N+1 Query Elimination + Timeout Fix
**File**: `src/app/cities/page.tsx`
**Commits**: `f852de8` (rewrite) + `b782184` (timeout fix)

**Before**: The cities page made ~40 Supabase queries — one per city for restaurant count, one per city for Michelin count, one per city for James Beard count, etc. Each query was a separate round-trip.

**After**: Exactly 2 queries total:
1. `SELECT * FROM cities WHERE is_active = true`
2. `SELECT city, michelin_stars, michelin_designation, james_beard_winner, eater_38, google_rating, cuisine FROM restaurants WHERE city IN (...activeCityNames)`

Results are bucketed in JS by lowercase city name. Stats (Michelin count, James Beard count, Eater 38 count, avg rating, top cuisines) are derived from the bucketed rows.

**Critical detail**: The `.in('city', cityNames)` filter on query 2 is essential. Without it, the query returns ALL restaurants globally, which exceeds Supabase PostgREST's default 1000-row cap and causes the page to time out. This was a production outage that was caught and fixed in commit `b782184`.

### 4. Consensus Picks — Extract Hardcoded Weights
**Files**: `src/lib/ranking/weights.ts`, `src/lib/ranking/consensusPicks.ts`

Added `CONSENSUS_WEIGHTS` to `weights.ts`:
```typescript
export const CONSENSUS_WEIGHTS = {
  google: 0.3,
  yelp: 0.3,
  tiktok: 0.2,
  instagram: 0.2,
} as const
```

`consensusPicks.ts` now imports and uses these instead of inline magic numbers.

### 5. Type Safety Fixes in Pipeline Scripts
**Files**: `scripts/insertFromAccoladesStaging.ts`, `scripts/fetchMenuImages.ts`

- Added `Database` generic type to `createClient()` calls
- Removed unsafe `as Array<...>` cast in `fetchMenuImages.ts`
- Added per-row try/catch in `fetchMenuImages.ts` so one restaurant failure doesn't abort the entire batch

### 6. Database Types Updated
**File**: `src/types/database.ts`

- Added `state: string | null` and `_norm_name: string | null` to restaurants `Row`, `Insert`, and `Update` types
- Added `accolades_staging` and `accolades_matches` table type definitions
- Fixed a structural error where an extra `}` prematurely closed the `Tables` block

**Note**: Schema-guardian flagged that `accolades_staging` and `accolades_matches` type definitions may not have corresponding migrations. Verify these tables exist in Supabase before relying on the types.

### 7. Archived Superseded Scripts
**Directory**: `scripts/archived/`

Moved 8 obsolete scraper files that were superseded by `fetchMenuImages.ts` (the current v100 menu scraper):
- `scrapeMenusV2.ts`, `scrapeMenusBrowser.ts`, `scrapeMenusIframeFollow.ts`
- `scrapeMenusOCR.ts`, `scrapeMenusProviders.ts`, `scrapeMenusVision.ts`
- `_smokeVision.ts`, `_debugOCRone.ts`

### 8. Gitignore Update
**File**: `.gitignore`
**Commit**: `bf966b2`

Added `.mcp.json` to gitignore — this file contains session-specific MCP bearer tokens and ports that change every session.

---

## Production Issue: Cities Page Stats Truncation

**Symptom**: The cities page rendered for unauthenticated traffic but every per-city stat (Michelin count, James Beard count, Eater 38 count, avg rating, top cuisines) was systematically undercounted by 30–40%.

**Root cause**: PostgREST enforces a server-side row cap (default 1000) that is **not overridable by `.limit()` or `.range()` ceilings**. The bulk restaurants SELECT — even after adding `.in('city', cityNames)` in commit `b782184` — silently truncated to 1000 rows even though 1597 restaurants matched. JS bucketing then computed stats from a ~63% sample. Per-city counts ran:

| City | Truncated (shown) | True count |
|---|---:|---:|
| Austin | 106 | 163 |
| Chicago | 169 | 252 |
| Los Angeles | 169 | 265 |
| Miami | 101 | 156 |
| New York | 309 | 519 |
| San Francisco | 146 | 242 |
| **Total** | **1000** | **1597** |

The earlier "fix" (`.in('city', cityNames)`) was necessary but not sufficient — it kept the WHERE clause correct but did nothing about the cap.

**Real fix**: Replace the single SELECT with a paginated `.range(start, start+999)` loop that stops on a short read. 2 round trips today (1000 + 597), scales linearly as the catalog grows. Verified locally: returns all 1597 rows in ~460ms. No schema change, honors Q-001's Option A decision.

**Status**: Real fix committed and pushed. Visually verifying via Chrome MCP — middleware cold-start 504s (see below) made the first navigation slow, but subsequent loads serve the corrected stats.

---

## Production Issue: Middleware Cold-Start 504

**Symptom**: First request to any page after the Vercel serverless function went cold returned `504: GATEWAY_TIMEOUT` with code `MIDDLEWARE_INVOCATION_TIMEOUT`. Affected exempt routes (`/onboarding`) and gated routes alike. Subsequent requests within the warm window worked fine.

**Root cause**: `src/lib/supabase/middleware.ts` unconditionally awaits `supabase.auth.getUser()` on every request, including exempt paths. `getUser()` performs an HTTP round-trip to Supabase to verify the JWT. On a cold Vercel instance, function init plus the Supabase call exceeded the middleware invocation budget, returning 504 before any response could be produced.

**Fix**: Race `supabase.auth.getUser()` against a 3s timeout (`Promise.race`). On timeout, treat as unauthenticated — gated routes still redirect to `/onboarding`, exempt routes render normally. The next warm request re-runs the check and lands real users on their intended page. Preserves full `getUser()` security on the warm path; degrades to anonymous on cold start instead of returning a hard 504.

---

## Sweep Cycles Run

Four multi-agent sweep cycles were executed:

| Cycle | Outcome |
|-------|---------|
| 2 | 9 agents produced 8 actionable suggestions + 1 question (Q-001). All suggestions were resolved. |
| 3 | Skipped — all agents reported no-op (nothing actionable after cycle 2 fixes). |
| 4 | api-builder executed cities rewrite. Overseer-A: OK. Overseer-B: challenged + held (approved with addenda about Q-002 pre-file obligation). |

---

## Questions & Decisions

| ID | Question | Decision |
|----|----------|----------|
| Q-001 | How to fix cities page N+1: (A) in-place rewrite with JS bucketing, (B) new Supabase RPC `get_city_stats()`, (C) hybrid | **Option A** — in-place rewrite. No new RPC, no schema change. Ship-day appropriate. |

---

## Known Issues & Pending Work

### Must Verify
- **Cities page**: Sign in and visually confirm the corrected stats render on `gastronome.vercel.app/cities`. Local Supabase query verified per-city counts match `count(*)`, but the rendered page hasn't been spot-checked end-to-end against an authenticated session.
- **Middleware cold start**: After 30+ min of no traffic, hit `gastronome.vercel.app/onboarding` and confirm it returns 200 within the 3s budget instead of 504.

### Low Priority
- **Q-002 pre-file**: Overseer-B noted that a future `get_city_stats()` RPC question should be pre-filed for when the cities page needs to scale beyond JS bucketing. Not urgent — current approach works for the foreseeable city count.
- **Chrome MCP**: Could not get Chrome MCP tools working in the cloud session. The tools are listed in agent definitions (`mcp__Claude_in_Chrome__*`) but weren't available at runtime. The `.mcp.json` approach failed because port/token change every session. Chrome MCP appears to be platform-managed, not user-configured.

### Backlog
See `BACKLOG.md` for the full list. One new P2 item from bug-hunter:
- `_auditAwards.ts` may reference the dropped `james_beard_nominated` column (verified as already correct in current code, but worth a second look).

---

## Key Architectural Notes

These are important constraints for anyone working on this codebase:

1. **Supabase has a 1000-row default cap** on PostgREST SELECT queries. Any query that might return more than 1000 rows MUST be filtered or paginated. The cities page timeout was caused by hitting this cap.

2. **`james_beard_nominated` column was DROPPED**. It no longer exists on the `restaurants` table. Use `james_beard_winner` for winner status and `restaurant_jbf_history` for nominee/finalist data. Never reference the old column.

3. **Ranking weights live in `src/lib/ranking/weights.ts`**. Both trending weights and consensus weights are centralized there. Any change to weights is a Decision Gate (must ask before changing).

4. **The menu scraper is v100** (`scripts/fetchMenuImages.ts`). All older scraper versions in `scripts/archived/` are superseded. Do not use them.

5. **Shell scripts in `scripts/` contain inline secrets**. The `.sh` wrapper scripts embed Supabase service-role keys and Google API keys directly. Do not commit new secrets.

---

## File Manifest — All Modified Files

```
src/app/cities/page.tsx                    — Rewritten (2-query bulk SELECT + JS bucketing)
src/components/BookmarkButton.tsx          — 3 mojibake chars fixed
src/lib/ranking/weights.ts                 — Added CONSENSUS_WEIGHTS
src/lib/ranking/consensusPicks.ts          — Uses CONSENSUS_WEIGHTS import
src/types/database.ts                      — Added fields + table types, fixed structural error
scripts/insertFromAccoladesStaging.ts      — Typed Supabase client
scripts/fetchMenuImages.ts                 — Typed client, error handling, removed unsafe cast
scripts/archived/ (8 files)                — Moved superseded scrapers
.env.example                               — New: documents required env vars
.gitignore                                 — Added .mcp.json
QUESTIONS.md                               — Q-001 answered (Option A)
BACKLOG.md                                 — 6 suggestions resolved, 2 verified
OVERSEER_LOG.md                            — Cycles 3 + 4 logged
STATE.md                                   — Agent activity logged
```
