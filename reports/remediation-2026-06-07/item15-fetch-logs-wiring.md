# Item 15a — `fetch_logs` wiring plan (pipeline audit trail)

**Worker:** W5-security-ops · **Date:** 2026-06-07 · **Action:** proposed / scripted (code wiring, no DB mutation)

## Problem

`public.fetch_logs` has **0 rows**. It is the project's *general-purpose pipeline
audit log* (per CLAUDE.md), but **no pipeline script ever INSERTs into it**.

Evidence (grep across repo, excluding `node_modules`):

| File | Uses `fetch_logs` how |
|------|----------------------|
| `scripts/healthCheck.ts` (L88–103) | **READS** it to detect a stale pipeline; emits `"fetch_logs is empty"` warning when empty (currently always firing) |
| `scripts/wipeRestaurants.ts` (L21, L38) | **DELETES** from it during wipes |
| `src/types/database.ts` (L397, L934) | type definition only |

No script writes it. By contrast `scripts/scrapeMenusV101.ts` (L693, L710) does
write a *menu-specific* audit table, `restaurant_menu_fetches` — so the audit
*pattern* exists; it just was never extended to the general `fetch_logs` table.

## Live schema of `fetch_logs` (verified 2026-06-07, drifted from any older assumption)

| column | type | null | default |
|--------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | YES | — (FK `fetch_logs_restaurant_id_fkey`) |
| `source` | text | NO | — |
| `status` | text | NO | — |
| `error_message` | text | YES | — |
| `metadata` | jsonb | YES | `'{}'::jsonb` |
| `started_at` | timestamptz | YES | `now()` |
| `completed_at` | timestamptz | YES | — |

Note: there is **no `created_at`** column. `healthCheck.ts` already orders by
`started_at` — any writer must populate `started_at` (it defaults to `now()`)
and set `completed_at` at the end of the run so freshness checks work.

## Which scripts should INSERT into `fetch_logs`

Add **one run-level row per pipeline invocation** (open at start, close at end).
`restaurant_id` stays NULL for batch/run-level rows; per-restaurant detail can
stay in the source-specific tables (e.g. `restaurant_menu_fetches`). Target the
pipeline *entry points*, not every helper:

| Script | suggested `source` value |
|--------|--------------------------|
| `scripts/scrapeMenusV101.ts` | `menus_v101` |
| `scripts/enrichWithGooglePlaces.ts` | `google_places_enrich` |
| `scripts/enrichPlacesAndPhotos.ts` | `google_places_photos` |
| `scripts/computeTopDishes.ts` | `compute_top_dishes` |
| `scripts/computeTopDishesFromChips.ts` | `compute_top_dishes_chips` |
| `scripts/scrapeChipsApify.mjs` | `google_chips_apify` |
| `scripts/scrapeGoogleReviewsBulk.ts` | `google_reviews` |
| `scripts/scrapeTiktokEngagement.mjs` | `tiktok_engagement` |
| `scripts/scrapeIgLikes.mjs` | `instagram_likes` |
| `scripts/applyMichelinHistory.ts` | `michelin_history` |
| `scripts/insertFromAccoladesStaging.ts` | `accolades_ingest` |
| `scripts/markAndPurgeClosed.ts` | `closures_sweep` |
| shell orchestrators (`runMenusV101Sharded.sh`, `burst_supervisor.sh`) | wrap child run; rely on the TS child to log |

## Patch shape (drop-in helper)

Create `scripts/lib/fetchLog.ts` and call it from each entry point. Uses the
**service-role** client (these are server-side scripts; service_role bypasses the
RLS that now protects the table — see Items 13/14).

```ts
// scripts/lib/fetchLog.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type FetchLogStatus = 'started' | 'ok' | 'partial' | 'errored'

/** Opens a fetch_logs row; returns the row id. */
export async function startFetchLog(
  sb: SupabaseClient,
  source: string,
  metadata: Record<string, unknown> = {},
): Promise<string | null> {
  const { data, error } = await sb
    .from('fetch_logs')
    .insert({ source, status: 'started', metadata })  // started_at defaults to now()
    .select('id')
    .single()
  if (error) { console.warn(`[fetch_logs] open failed for ${source}: ${error.message}`); return null }
  return data.id
}

/** Closes a previously-opened fetch_logs row. */
export async function finishFetchLog(
  sb: SupabaseClient,
  id: string | null,
  status: FetchLogStatus,
  patch: { error_message?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  if (!id) return
  const { error } = await sb
    .from('fetch_logs')
    .update({ status, completed_at: new Date().toISOString(), ...patch })
    .eq('id', id)
  if (error) console.warn(`[fetch_logs] close failed (${id}): ${error.message}`)
}
```

Usage at an entry point (e.g. top of `scrapeMenusV101.ts main()`):

```ts
const logId = await startFetchLog(supabase, 'menus_v101', { shard, batchSize })
try {
  // ... existing pipeline work ...
  await finishFetchLog(supabase, logId, 'ok', {
    metadata: { processed, ok: okCount, rejected: rejectedCount, items: itemTotal },
  })
} catch (e) {
  await finishFetchLog(supabase, logId, 'errored', { error_message: String(e).slice(0, 400) })
  throw e
}
```

## Why this is wiring-only (not run here)

This is application code, not a data fix — there is nothing correct to backfill
(we must NOT fabricate historical run rows; that would poison the freshness
signal `healthCheck.ts` depends on). Once the helper is added and a pipeline
runs, `fetch_logs` populates naturally and the `"fetch_logs is empty"` health
warning clears on its own. Recommend a `schema-guardian`/`data-steward` PR to add
`scripts/lib/fetchLog.ts` and the call sites above.

## Lane / gate note

Touches `scripts/` (data-steward lane). No schema change required — `fetch_logs`
already exists with the right shape. Adding the helper + call sites is a
behavior-preserving instrumentation change (DO, then report), but since it spans
many entry points it is best landed as one reviewed PR.
