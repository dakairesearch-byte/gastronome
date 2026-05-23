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

**Status:** open
