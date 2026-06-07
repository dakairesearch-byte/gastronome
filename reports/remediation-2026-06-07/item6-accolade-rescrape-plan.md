# Item 6 — Accolade Gap Rescrape Plan (GATED — owner approval required)

**Date:** 2026-06-07
**Worker:** W3-accolades-integrity
**Status:** QUEUED (needsOwnerApproval=true). Awards data is a CLAUDE.md landmine — NEVER invent. All gaps below must be filled by scraping CANONICAL sources only. No fabrication, no LLM-guessed designations/years/tiers.

---

## Live state confirmed (2026-06-07)

| Table | Columns (live) | Observed gap |
|---|---|---|
| `restaurant_jbf_history` | `id, restaurant_id, year, award_name, status, region, chef_name, source_url, created_at` | `status` is effectively winner-only; finalist / semifinalist tiers missing |
| `restaurant_eater38_history` | `id, restaurant_id, year, city, list_url, created_at` | Only year=2026 present, only ~6 cities |
| `restaurant_michelin_history` | `id, restaurant_id, year, designation, source_url, created_at` | ~1,682 pre-2026 rows have NULL `source_url` |

> NOTE: live schema has DRIFTED from `src/types/database.ts`. The michelin history table has **no `stars` column** — only `designation` (one_star/two_star/three_star/bib_gourmand/etc). JBF uses `status`/`region`/`chef_name`. Eater38 uses `city`/`list_url`. Any scraper MUST target these real columns.

---

## Gap 1 — JBF finalist / semifinalist tiers

**Canonical source:** James Beard Foundation official awards database.
- Restaurant & Chef Awards: https://www.jamesbeard.org/awards/search  (filter by year; each year lists Nominees → Semifinalists, Finalists/Nominees, Winners)
- Historical winners/semifinalists also published as yearly press releases on jamesbeard.org/blog.

**What to capture per row:** `restaurant_id` (fuzzy-match to existing venues by name+city; do NOT auto-create venues), `year`, `award_name` (e.g. "Best New Restaurant", "Outstanding Chef", "Best Chef: New York State"), `status` ∈ {`semifinalist`,`finalist`,`nominee`,`winner`}, `region`, `chef_name`, `source_url` (the specific JBF page the row was read from).

**Scope:** multi-year (suggest 2015–2026), all categories. This is >100 rows and >30 min → **write a script, do not run inline.**

**Script to build:** `scripts/scrapeJbfHistory.ts`
- Iterate years; for each, fetch the JBF awards search results (paginated) for Restaurant & Chef awards.
- Parse each entrant's name/city/category/tier.
- Match to `restaurants` by normalized name + city (reuse the `_norm_name` column already on `restaurants`). Emit unmatched entries to a `scripts/out/jbf-unmatched-<year>.json` review file rather than inventing venues.
- UPSERT into `restaurant_jbf_history` keyed on (`restaurant_id`,`year`,`award_name`,`status`) to stay idempotent.
- Always populate `source_url`.

## Gap 2 — Eater 38 expansion (more years, more cities)

**Canonical source:** Eater's "The Eater 38" / "Essential Restaurants" maps per city.
- Index pattern: https://www.eater.com/maps  → per-city "The 38 Best Restaurants in <City>".
- Cities currently missing should be enumerated against the app's covered metros (NY, LA, SF, Chicago, Miami, plus any others in `restaurants.city`).
- Eater updates these lists periodically; capture the publication/update year from the article and the canonical `list_url`.

**What to capture per row:** `restaurant_id` (match only; never create), `year` (list edition year), `city`, `list_url`.

**Scope:** multiple cities × multiple editions → likely >100 rows → **scripted.**

**Script to build:** `scripts/scrapeEater38.ts`
- For each target city, resolve the current Eater 38 map URL, fetch, parse venue cards.
- Match to `restaurants` by normalized name + city; write unmatched to review file.
- UPSERT into `restaurant_eater38_history` keyed on (`restaurant_id`,`year`,`city`).

## Gap 3 — Michelin history missing `source_url` (~1,682 pre-2026 rows)

**Canonical source:** MICHELIN Guide official site (guide.michelin.com). Each restaurant has a stable guide URL; selections are also published per-year/per-region.

**Approach (does NOT change designations — only backfills provenance):**
- For each `restaurant_michelin_history` row with NULL `source_url`, derive the canonical MICHELIN Guide URL for that restaurant/year.
- Preferred: if the parent `restaurants.michelin_url` is populated, use it as the `source_url` for that restaurant's history rows (cheap, no scrape). Verify the designation on-page matches before writing.
- For rows whose restaurant has NULL `michelin_url`: look up the venue on guide.michelin.com (search by name+city), confirm the year's selection, and store the resolved URL.
- Do NOT alter `designation` or `year`. This is provenance backfill only.

**Scope:** ~1,682 rows → **scripted.**

**Script to build:** `scripts/backfillMichelinSourceUrls.ts`
- Phase A (no network): `UPDATE restaurant_michelin_history h SET source_url = r.michelin_url FROM restaurants r WHERE h.restaurant_id=r.id AND h.source_url IS NULL AND r.michelin_url IS NOT NULL;` (run as a reviewed migration; count first).
- Phase B (scrape): for the remainder, resolve guide.michelin.com URLs and UPSERT `source_url` only. Rate-limit; cache; emit unresolved rows to a review file.

> IMPORTANT consistency note: Item 8 (already applied this session) cleared 28 *invented* starred flags on the `restaurants` table that had no history row and no `michelin_url`. Those are unrelated to the ~1,682 history rows here — those history rows are legitimate and only need `source_url` provenance.

---

## Guardrails (apply to all three scripts)
1. Match-only against existing `restaurants`; never auto-create venues from award lists.
2. Always write `source_url` / `list_url` provenance.
3. Idempotent UPSERTs keyed on natural keys above.
4. Emit unmatched entries to review files; a human resolves ambiguous matches.
5. Back up each target table (`pg_dump`/JSON snapshot) before the first write.
6. No designation/tier/year is ever guessed — if a source can't confirm it, skip and log.
