# Proposal: Resolving the 811 "unbrowsable" restaurants (city-rollup)

- **Date:** 2026-06-07
- **Author:** Remediation Worker 4 (Cities & Schema)
- **Status:** PROPOSED — needs owner approval. No data was changed by this item.
- **Decision gate:** product/UI decision (affects browse surface) + data op >50 rows. Per CLAUDE.md decision gates this must be ASKed, not done.

---

## Problem

The `cities` table has 20 rows (6 active: New York, Los Angeles, Chicago,
San Francisco, Austin, Miami). The browse/discover surface only lists
**active** cities, and the per-city restaurant query matches whole-value,
case-insensitive on `restaurants.city` (`.ilike('city', <cities.name>)` —
see `src/app/page.tsx`, `src/lib/hooks/useDiscoverResults.ts`,
`src/lib/hooks/useCity.ts`).

Consequently, any restaurant whose `restaurants.city` is **not** an exact
(case-insensitive) match to an active city name is **unreachable from the
city browse UI**. It can still surface in free-text search, but it has no
city home.

### Measured impact (live DB, 2026-06-07, project `trwdqzsfgeydafojajbh`)

| Metric | Value |
|---|---|
| Restaurants with a non-null city | 3,340 |
| Restaurants whose city is NOT in `cities` | **811 (24.3%)** |
| Distinct "orphan" city strings | **106** |
| Restaurants with NULL city | 0 |

Top orphan cities (full top-40 captured during analysis):

| City | Restaurants | Obvious parent metro |
|---|---|---|
| Brooklyn | 269 | New York |
| Queens | 64 | New York |
| Miami Beach | 47 | Miami |
| Oakland | 39 | San Francisco (Bay Area) |
| Bronx | 27 | New York |
| Santa Monica | 25 | Los Angeles |
| Coral Gables | 24 | Miami |
| Staten Island | 21 | New York |
| Astoria | 18 | New York (Queens) |
| Flushing | 17 | New York (Queens) |
| West Hollywood | 15 | Los Angeles |
| Alhambra | 15 | Los Angeles |
| Culver City | 13 | Los Angeles |
| Long Island City | 12 | New York (Queens) |
| Beverly Hills | 12 | Los Angeles |

Nearly all of the 811 are **boroughs, neighborhoods, or suburbs of the 6
metros we already run**, not new markets. Classifying the orphans by their
natural parent metro:

| Parent metro | Restaurants | Distinct orphan cities |
|---|---|---|
| New York (Brooklyn, Queens, Bronx, Staten Island, Astoria, Flushing, LIC, …) | **460** | 15 |
| Los Angeles (Santa Monica, WeHo, Culver City, Pasadena, Beverly Hills, …) | **135** | 22 |
| Miami (Miami Beach, Coral Gables, Coconut Grove, Hialeah, …) | **99** | 12 |
| San Francisco / Bay Area (Oakland, Berkeley, San Jose, …) | **51** | 6 |
| Napa / Sonoma wine country (Yountville, Sonoma, Healdsburg, …) | **16** | 5 |
| OTHER — long tail, no obvious active parent | **50** | 46 |

**≈761 of 811 (93.8%) belong to an existing active metro.** The "OTHER"
bucket is 46 cities almost all with a single restaurant — and on
inspection most of *those* are also within the 6 metros, just not caught
by a first-pass keyword list (e.g. Van Nuys / Gardena / Pomona / Temple
City / Topanga = LA; Jamaica / College Point / East Elmhurst / Richmond
Hill / Rockaway Park = NYC/Queens; St Helena / Rutherford / Sebastopol =
Napa-Sonoma; Fort Lauderdale / Plantation = Miami; Round Rock / Cedar
Park / Pflugerville / Sunset Valley = Austin; Schaumburg / Chicago
Heights = Chicago). The true "no metro we serve" residual is on the order
of a dozen rows (e.g. Pecos TX, Pine Plains NY, North Salem NY, Elk CA).

---

## Why NOT mass-rewrite now

`restaurants.city` is also the value shown on the restaurant card and the
restaurant detail page, and it is used for "more in this city" rails
(`.ilike('city', restaurant.city)`). Overwriting Brooklyn → New York would
make a Williamsburg spot display "New York" and pull Manhattan neighbors
into its rail — a **user-visible content change** and a loss of
neighborhood granularity. It also can't be done by us unilaterally: it
trips three decision gates (user-visible UI change, >50-row data op, and
"picking between approaches with tradeoffs"). Hence: proposal only.

---

## Option A — Metro rollup (boroughs/suburbs → parent metro)

Keep the 6 active metros. Map each orphan city to its parent metro so it
becomes browsable under that metro, **without destroying the granular
locality**.

**Recommended mechanism (non-destructive):** add a nullable
`restaurants.metro` (or `metro_city`) column, backfill it from a
city→metro lookup, and change the browse predicate to match on `metro`
(falling back to `city`) instead of `city`. The displayed neighborhood
(`Brooklyn`, `Santa Monica`) stays intact on the card/detail page; only
*browse membership* rolls up.

- Alternative mechanism: a `city_aliases(alias, parent_city_id)` table the
  browse query joins through. Same effect, zero writes to `restaurants`,
  fully reversible, and it doubles as the canonical place to curate future
  spellings. **This is the cleanest variant.**
- Avoid the destructive variant (UPDATE `restaurants.city` in place):
  it loses neighborhood granularity and is the one that trips the
  user-visible-content gate hardest.

**Row impact**
- New schema: 1 nullable column **or** 1 small alias table (~106 seed rows).
- Backfill: ~761 restaurants gain a metro (read-mostly; with the alias-table
  variant, **0** rows in `restaurants` change).
- `cities` table: unchanged (still 6 active metros).
- Browse coverage: **75.7% → ~99%+** of cities-having restaurants become
  browsable. NY metro page would jump 697 → ~1,157; LA 465 → ~600;
  Miami 277 → ~376; SF 392 → ~443.
- `cities.restaurant_count` would need to be redefined to count via the
  rollup (one-line change to the recompute in item 10a).

**Pros:** preserves neighborhood labels; no new thin city pages; matches
how users think ("food in NYC" includes Brooklyn); reversible; keeps the
6-metro product focus. **Cons:** needs a curated alias map (one-time, ~106
entries) and a small query change; "Napa/Sonoma" has no active parent so
its 16 stay orphaned unless we also activate a wine-country metro.

---

## Option B — Add the orphan cities as their own `cities` rows

Insert the orphan cities (or the top-N) into `cities`, set `is_active=true`,
and let them appear in the switcher as first-class cities.

**Row impact**
- `cities`: 20 → up to **126** rows (or fewer if we only add the top ones).
- `restaurants`: **0** changes (city strings already match the new rows).
- Browse coverage: rises toward ~99% **only if** we add (and keep active)
  the full long tail.
- UI: the city switcher / sitemap / onboarding city list grow from 6 to
  potentially 100+ entries.

**Pros:** zero writes to `restaurants`; preserves exact locality as the
browseable unit; trivial to implement (INSERTs). **Cons:** floods the
switcher and `/explore` with ~100 cities, many holding a **single**
restaurant (46 of the orphan cities have exactly 1) — thin, low-quality
city pages that dead-end; fragments a single metro across many tiles
(Brooklyn, Queens, Bronx, Manhattan all separate); SEO sitemap bloat with
near-empty pages; onboarding "home city" picker becomes unusable. Setting
100 cities `is_active` is itself a large user-visible change.

---

## Side-by-side

| | A — Metro rollup | B — Add as cities |
|---|---|---|
| Writes to `restaurants` | 0 (alias-table variant) | 0 |
| New `cities` rows | 0 | up to +106 |
| Browse coverage after | ~99% | ~99% (only if all kept active) |
| Neighborhood label kept | Yes | Yes |
| # browseable city tiles | 6 (focused) | up to ~112 (many with 1 restaurant) |
| Thin/dead-end pages | No | Yes (46 single-restaurant cities) |
| Switcher / sitemap / onboarding impact | Minimal | Large (floods all three) |
| Reversibility | High | High (delete the added rows) |
| Implementation cost | Alias map + 1 query change | INSERTs only |
| Long-tail "no metro" residual | ~12 rows still orphaned | covered, but as thin pages |

---

## Recommendation

**Adopt Option A (metro rollup) via a `city_aliases` lookup table.** It
recovers ~99% of the 24.3% unbrowsable inventory while (1) writing zero
rows to `restaurants`, (2) preserving neighborhood granularity on cards
and detail pages, (3) keeping the product's deliberate 6-metro focus, and
(4) avoiding ~100 thin single-restaurant city pages that Option B would
create. It is fully reversible (drop the table / revert the predicate).

Suggested sequencing if approved:
1. Create `city_aliases(alias text, parent_city_id uuid, …)` and seed the
   ~106 alias→metro mappings (curated, reviewed — not auto-guessed).
2. Update the browse predicate to resolve `restaurants.city` through
   `city_aliases` to the parent metro (fall back to direct match).
3. Redefine `cities.restaurant_count` to count via the rollup (one-line
   change to the item-10a recompute).
4. Decide separately whether to stand up a **Napa/Sonoma** (and possibly a
   broader **Bay Area**) metro to home the wine-country 16 + Bay suburbs,
   since those have no current active parent.

Because every step above trips a decision gate (schema change, UI change,
>50-row effect, ranking-adjacent count redefinition), none of it is
executed here. **needsOwnerApproval = true.**

---

## Appendix — queries used (reproducible)

Orphan totals:
```sql
SELECT count(*) AS orphan_restaurants, count(DISTINCT city) AS orphan_cities
FROM restaurants r
WHERE r.city IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cities c WHERE r.city ILIKE c.name);
```

Per-orphan-city breakdown:
```sql
SELECT r.city, count(*) AS n
FROM restaurants r
WHERE r.city IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM cities c WHERE r.city ILIKE c.name)
GROUP BY r.city ORDER BY n DESC;
```
(Parent-metro classification used an explicit alias array per metro; see
the remediation run log. 460 NY / 135 LA / 99 Miami / 51 SF Bay / 16
Napa-Sonoma / 50 long-tail.)
