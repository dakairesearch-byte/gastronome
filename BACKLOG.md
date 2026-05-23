# Backlog

> Size limit: Suggestions section capped at 50 most recent. Drop older.

## Now (active this cycle — exactly 3 items)

- [ ] [steward] Fix computeTopDishes to UPSERT instead of TRUNCATE+INSERT — chip-only restaurants get wiped on overnight rebuild. Acceptance: chip-only restaurants survive a full computeTopDishes run. (Source: known landmine in CLAUDE.md; concrete call site at `scripts/computeTopDishes.ts:1190` — `.delete().neq('restaurant_id', '00000000-…')` followed by bulk INSERT.)
- [ ] [steward] Strip the dropped `james_beard_nominated` column from the seed pipeline — `scripts/seedRestaurants.ts:118` writes the column and `scripts/seed.sh:55` builds it into the row payload. Per CLAUDE.md the column was dropped from `restaurants`, so the next seed run will 4xx from PostgREST. Acceptance: a smoke seed of one fixture row inserts cleanly with no `column "james_beard_nominated" of relation "restaurants" does not exist` error. (Source: `scripts/seedRestaurants.ts:118`, `scripts/seed.sh:55`.)
- [ ] [builder] De-mojibake the JSDoc + inline comments in `src/components/brands/BrandIcons.tsx` — em-dashes render as `â` and ellipses as `â¦` on lines 54, 62, 71, 98, 128, 138, 180 (and the chevron glyph at line 180). Comment-only cleanup, no behavior change. Acceptance: `grep -P '[\x80-\xff]' src/components/brands/BrandIcons.tsx` returns no matches. (Source: `src/components/brands/BrandIcons.tsx:54` and siblings.)

## Next (queued — exactly 7 items, one per non-reviewer lane)

- [ ] [schema] Audit that migration `20260415140000_drop_legacy_ranking_rpcs.sql` is consistent with the codebase — confirm no `.rpc('get_placed_restaurants' | 'get_trending_restaurants' | …)` call site survives in `src/`. Read-only audit, no DDL. Acceptance: a findings note in STATE.md listing zero remaining call sites, or a steward Suggestion if any are found. (Source: `supabase/migrations/20260415140000_drop_legacy_ranking_rpcs.sql`.)
- [ ] [api] Add Vitest coverage for `src/app/api/restaurants/search/route.ts` — route has zero tests today, handles both the local-DB search and the Google Places fallback, with at least four failure branches (empty query, DB error, Google error, merge). Acceptance: tests cover the empty-query, DB-only success, DB+Google merge, and DB-error branches. (Source: `src/app/api/restaurants/search/route.ts:1`.)
- [ ] [ranking] Audit current weights and document signals — write `design/proposals/ranking-audit-<date>.md` cataloguing every input signal (`videos`, `reviews`, `photos` from `src/lib/ranking/weights.ts:12`; `google_rating`, `yelp_rating`, `tiktok_eng`, `ig_eng` from `src/lib/ranking/consensusPicks.ts:179`), the weight values today, what table feeds each signal, and where rollups happen. No formula or weight changes. Required before any tuning question can be answered safely. (Source: `src/lib/ranking/weights.ts:12`, `src/lib/ranking/consensusPicks.ts:179`.)
- [ ] [perf] Profile the per-city stats fan-out on `src/app/cities/page.tsx` — for each city the page issues six `count: 'exact', head: true` queries plus one 500-row sample (lines 49–99), then runs an extra union-OR Michelin count (line 98). With N cities this is ~7N round-trips per request. Acceptance: a findings note with measured query count + median total latency on a warm DB, and a recommended consolidation path (single RPC vs `.in()` aggregate). Read-only. (Source: `src/app/cities/page.tsx:49`.)
- [ ] [builder] Backfill Vitest coverage for `src/lib/ranking/consensusPicks.ts` — only `src/lib/ranking/trending.test.ts` exists today; `consensusPicks` (which is wired into the homepage and explore page) has no test. Pure test addition, no behavior change. Acceptance: tests cover the four-signal scoring math at line 179, the platform-floor disqualifier at line 174, and the log-normalization at lines 164–167. (Source: `src/lib/ranking/consensusPicks.ts:170`.)
- [ ] [design] Critique the cities index page (`src/app/cities/page.tsx:157–289`) — write `design/proposals/cities-index-critique-<date>.md` covering visual hierarchy of the city cards, a11y of the stat-pill cluster (color-only differentiation between Michelin / JBF / Eater), and scannability on mobile. Proposal only; any actual layout change requires an answered question. (Source: `src/app/cities/page.tsx:157`.)
- [ ] [hunter] Verify every column referenced anywhere under `src/` and `scripts/` is present in `src/types/database.ts` — the JBF column landmine showed that drops can outlive their references for weeks. Use the type file as the source of truth (per CLAUDE.md) and append a Suggestion per stale column found. Read-only, findings-only. (Source: `src/types/database.ts` cross-checked against grep of `from('restaurants')\.select`/`.eq`/`.update` call sites.)

## Later (icebox — exactly 3 items)

- [ ] [steward] Consolidate the menu-scraper version family — `scrapeMenusV2.ts`, `scrapeMenusV100.ts`, `scrapeMenusV101.ts`, `scrapeMenusBrowser.ts`, `scrapeMenusIframeFollow.ts`, `scrapeMenusOCR.ts`, `scrapeMenusProviders.ts`, and `scrapeMenusVision.ts` all coexist. CLAUDE.md house rule 3 says v100+ supersedes v2; the older versions should be archived once owners confirm no orchestrator (`scripts/runMenusV100Watchdog.sh`, `runMenusV101Sharded.sh`, etc.) still calls them. Touches code modified in the last 30 days → needs an answered question. (Source: `scripts/scrapeMenusV2.ts:1` and siblings.)
- [ ] [ranking] Lift the hard-coded `0.3 * google + 0.3 * yelp + 0.2 * tt + 0.2 * ig` weights out of `src/lib/ranking/consensusPicks.ts:179` into `src/lib/ranking/weights.ts` — `weights.ts` claims to be the single source of truth in its own docstring, but consensus weights live inline today. Changing the location of ranking knobs trips the "Any change to ranking formula, weights, or input signals — even 1%" gate, so this needs an answered question before tuning. (Source: `src/lib/ranking/consensusPicks.ts:179`, `src/lib/ranking/weights.ts:2`.)
- [ ] [builder] Replace the bespoke `requireAdminUser` + 404 redirect pattern in `src/app/api/debug/trending/route.ts:20–23` with a reusable middleware-level admin gate so future debug endpoints inherit the same allowlist semantics without copy-pasting the 404-as-cover trick. Auth model change → needs an answered question. (Source: `src/app/api/debug/trending/route.ts:20`.)

## In review
(items moved here when PRs are open)

## Suggestions (raw ideas, agents append here; cap 50)

(empty — agents populate on first cycle)

---

### Seeding notes (for first cycle reviewer)

- `get_advisors` from the Supabase MCP server was unreachable in this environment (the `mcp__a124b4b5-…__*` tools are pre-allowed in `.claude/settings.json` but the MCP isn't connected to the active session). Every Next/Later item is grounded in `file:line` from the repo rather than a live advisor finding. First cycle's schema-guardian should re-run `get_advisors` and append any real DB warnings to Suggestions.
- The [ranking] Next item is deliberately an audit, not a tuning task — tuning trips the CLAUDE.md ranking gate and must go through QUESTIONS.md.
- The "Strip `james_beard_nominated`" Now item is a script fix only. `src/` was already cleaned in earlier PRs (the matches in `src/` today are all in comments that document the drop) — confirmed via `grep -n james_beard_nominated src/...`.
