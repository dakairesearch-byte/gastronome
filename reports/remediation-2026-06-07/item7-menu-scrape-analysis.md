# Item 7 — Menu coverage failure analysis & re-scrape priority plan

Worker: W2-media · Date: 2026-06-07 · Project: `trwdqzsfgeydafojajbh`
Action: INVESTIGATE + SCRIPTED (no destructive DB changes made for this item)

## 1. Headline coverage gap

| Metric | Value |
|---|---|
| Operational restaurants | 3,278 |
| Operational with **no** menu items | **1,909 (58.2%)** |
| — of those, **have** a website | 1,014 |
| — of those, have **no** website | 895 |
| — of those, **never even attempted** a fetch | 1,335 (440 of which have a website) |
| Restaurants with ≥1 menu item | 1,382 (all restaurants) |

So "58% have no menu" splits cleanly into two populations:

- **895 no-menu-no-website** — out of reach of the current website-gated scraper.
  Not addressed by this plan (they need a different source: Google "view menu"
  link, Yelp menu tab, or a delivery aggregator). Flagged as a follow-up.
- **1,014 no-menu-but-have-website** — the addressable re-scrape pool. This is
  what `scripts/rescrapeMenusPriority.mjs` targets.

## 2. Why fetches fail — `restaurant_menu_fetches` buckets

All-time status distribution (5,710 fetch rows):

| status | n | % |
|---|---|---|
| `no_content` | 2,812 | 49.2 |
| `ok` | 992 | 17.4 |
| `no_items` | 988 | 17.3 |
| `rejected` | 783 | 13.7 |
| `rejected_unclear` | 135 | 2.4 |

Latest-status-per-restaurant (1,868 distinct restaurants attempted; only **745**
ever reached `ok`):

| latest status | restaurants | has website | operational |
|---|---|---|---|
| `no_content` | 1,011 | 1,011 | 991 |
| `ok` | 512 | 512 | 503 |
| `rejected` | 300 | 300 | 296 |
| `no_items` | 33 | 33 | 33 |
| `rejected_unclear` | 12 | 12 | 12 |

### Key structural finding
**Every menu fetch ever attempted was on a restaurant that has a website**
(`no_website = 0` in *every* status bucket). The scraper is website-gated by
construction. Consequences:

1. The 895 no-website restaurants are invisible to it — no amount of re-scraping
   changes them. They need a non-website menu source.
2. **440 operational restaurants that DO have a website were never attempted** —
   pure missed coverage, the cheapest wins available.

### What the failure messages actually say
Top `error_message` values per bucket:

- `no_content` (the 49% bucket):
  - `no menus found via fetch or browser` — **2,256** (the website was reached but
    no menu page/markup was located: menu behind JS, in a PDF, on a 3rd-party
    ordering domain, or simply not published)
  - `no_images` — 267, `no json-ld menus found on any page` — 159, `ocr_empty` — 122
  - a handful of `page.evaluate` crashes (≤5) — transient, safe to retry
- `rejected` (13.7%): `rejected-quality verdict=unclear food=0%` — **507**, plus
  `verdict=mixed food=0%` and several `verdict=food_menu` rows that were rejected
  despite high food ratios → **the quality gate is over-rejecting**; a menu *was*
  extracted but discarded. These are high-value re-tries against the newer v101
  quality verdict.
- `no_items`: `v2 food_ratio=0.00 ... verdict=empty` — 491 (legacy `website-v2`
  source; superseded by v101 per house-rule #3).

Source breakdown confirms the failures are spread across scraper generations
(`website-v101`, `website-v100`, `website-ocr`, `website-browser`, legacy
`website-v2`/`website`). The legacy `website-v2` `no_items` rows (491) and
`rejected_unclear` rows (135) predate v101 and should simply be re-run on v101.

## 3. Re-scrape priority plan

Implemented in `scripts/rescrapeMenusPriority.mjs` (writes
`tmp/menu-rescrape-priority-ids.txt`, optionally shells out to the canonical
`runMenusV101Sharded.sh`). Candidate pool = operational + has-website + no menu
items = **1,014**. Tiers (verified live):

| tier | definition | count | rationale |
|---|---|---|---|
| **1** | never attempted (has website) | **440** | brand-new coverage; cheapest yield, no prior failure to fight |
| **2** | latest = `rejected` / `rejected_unclear` | **150** | a menu WAS found but the quality gate killed it; re-pass on v101's newer verdict often clears these |
| **3** | latest = `no_items` / `no_content` | **424** | needs the deeper browser/OCR path; lowest yield, run last |

Within each tier, rank by: prior fetch had a `menu_url` (a menu page was located
before) → `is_featured` → `review_count + google_review_count` (popularity).

High-traffic examples currently with no menu (audience impact):

| restaurant | city | popularity | latest status |
|---|---|---|---|
| Dishoom | New York | 28,969 | (never attempted) |
| Au Cheval | Chicago | 12,026 | no_content |
| La Carreta | Miami | 10,408 | no_content |
| Puerto Sagua | Miami Beach | 8,678 | no_content |
| Hula Hut | Austin | 7,988 | no_content |
| Franklin Barbecue | Austin | 7,145 | (never attempted) |
| Kura Sushi | Austin | 7,098 | rejected |

## 4. Recommended execution (NOT run here — scrape-ceiling rule)

```bash
# 1) build prioritized worklist (dry, just writes the id file)
node scripts/rescrapeMenusPriority.mjs

# 2) start with the cheap wins
node scripts/rescrapeMenusPriority.mjs --tier=1 --run --shardCount=5
# then tier 2 (quality-gate re-pass), then tier 3 (deep fetch)
```

Run as a **scheduled background job** (≈5 restaurants/min ⇒ 1,014 candidates is
multiple hours; per CLAUDE.md long runs must not be inline).

## 5. Follow-ups out of scope for this item

- **895 no-website restaurants**: need a non-website menu source (Google Places
  "menu" link / Yelp menu tab / delivery aggregator). Separate scraper lane.
- **Quality-gate calibration**: 35+ `rejected` rows had `verdict=food_menu
  food=100%` yet were discarded — the over-rejection deserves a ranking/quality
  review (different lane; do not tune here).
- Legacy `website-v2` rows (491 `no_items` + 135 `rejected_unclear`) should be
  re-run on v101 and their stale audit rows superseded.

## 6. Provenance of every number

All figures are live `execute_sql` results against `trwdqzsfgeydafojajbh` on
2026-06-07. No menu rows were added, deleted, or modified for this item — it is
investigation + a runnable, un-run script only.
