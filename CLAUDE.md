# Gastronome

Gastronome aggregates restaurant reviews and accolades from multiple
sources — Google Places, Michelin Guide, Eater 38, James Beard Foundation,
The Infatuation, Yelp, Beli, and social video (TikTok/Instagram) — into a
single per-restaurant profile with unified ratings, trending scores, and
curated editorial collections. The app surfaces this data through city
pages, an explore/search experience, and a social layer (reviews,
bookmarks, collections).

@AGENTS.md

---

## Stack

| Layer      | Tech                                                        |
|------------|-------------------------------------------------------------|
| Framework  | Next.js 16.2 (App Router), React 19, TypeScript 5          |
| Styling    | Tailwind CSS v4, CSS custom properties (`globals.css`)      |
| Backend    | Supabase (PostgREST + Auth + Storage)                       |
| Testing    | Vitest, Playwright                                          |
| Runtime    | Node 20+                                                    |

**Supabase project:** `trwdqzsfgeydafojajbh`
Dashboard: https://supabase.com/dashboard/project/trwdqzsfgeydafojajbh

### Env vars required

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY        # scripts only — never ship to client
GOOGLE_PLACES_API_KEY            # server-side Google Places (New) calls
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY  # client-side autocomplete
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY    # interactive Discover map — Maps JavaScript API must be enabled (separate product from Places); falls back to the Places key + StaticMapTile if unset
```

---

## Database tables

Source of truth: `src/types/database.ts`. Key tables:

| Table                            | Role                                                        |
|----------------------------------|-------------------------------------------------------------|
| `restaurants`                    | Core entity. Ratings, photos, coordinates, accolade flags.  |
| `restaurant_highlighted_dishes`  | Per-restaurant dish leaderboard (mention counts, sentiment). |
| `restaurant_top_dishes`          | Ranked top dishes with tier/score and cross-source mentions. |
| `restaurant_menu_items`          | Scraped menu items (name, price, source).                   |
| `restaurant_dish_signals`        | Raw dish mention signals before ranking.                    |
| `restaurant_videos`             | TikTok/Instagram video metadata (likes, views, thumbnails). |
| `restaurant_rating_snapshots`    | Nightly Google/Yelp/Infatuation rating history.             |
| `restaurant_michelin_history`    | Year-over-year Michelin star/designation changes.            |
| `restaurant_jbf_history`         | James Beard recognition by year (winner/finalist/semifinal).|
| `restaurant_eater38_history`     | Eater 38 list membership by year and city.                  |
| `restaurant_menu_fetches`        | Audit log for menu scrape runs (status, item count, errors).|
| `reviews`                        | User-authored reviews (rating, title, content).             |
| `review_photos`                  | Photos attached to reviews.                                 |
| `profiles`                       | User profiles, onboarding prefs, home city.                 |
| `follows`                        | User→user follow graph.                                     |
| `cities`                         | Active cities with slugs and photo URLs.                    |
| `fetch_logs`                     | General-purpose pipeline audit log.                         |

> **`james_beard_nominated` was dropped.** The column no longer exists on
> `restaurants`. Winner status is `james_beard_winner`; nominee/finalist
> data lives in `restaurant_jbf_history`. Do not reference the old column.

---

## Pipeline scripts (`scripts/`)

| Script                       | Purpose                                                     |
|------------------------------|-------------------------------------------------------------|
| `enrichWithGooglePlaces.ts`  | Enriches restaurants via Google Places API (photos, ratings, coords). Rate-limited at 100ms/req. |
| `seedRestaurants.ts`         | Seeds restaurants from a JSON fixture into Supabase.        |
| `wipeRestaurants.ts`         | Wipes restaurant data (preserves profiles and follows).     |
| `enrich.sh`                  | Shell wrapper around enrichWithGooglePlaces with inline Supabase + Google API keys. |
| `seed.sh`                    | Shell wrapper for seedRestaurants, reads from `gastronome-seed-data-with-accolades.json`. |
| `fix-cuisine.sh`             | Re-enriches cuisine field for restaurants via Google Places. |

Run TS scripts with: `npx tsx scripts/<name>.ts`

---

## Known landmines

- **computeTopDishes truncates.** If/when a `computeTopDishes` pipeline is
  added, it must UPSERT into `restaurant_top_dishes`, not
  TRUNCATE+INSERT — truncation drops chip-only restaurants that have no
  other mention source.
- **Scrape ceiling ~5 restaurants/min.** Runs over 30 minutes must use
  scheduled background jobs — long-running sandbox processes die when idle.
- **Never invent accolades.** Awards seed data was previously
  invented/stale. Always rescrape from the canonical source (Michelin
  Guide, JBF site, Eater). If a scrape can't run, leave the field null
  rather than guessing.
- **JBF awards are restaurant-level only.** The `restaurant_jbf_history`
  table tracks recognition at the restaurant, not at the chef level.
  Infatuation ratings are current-only (no history table).
- **Some pipeline scripts may live in git stash.** `git reset --hard
  origin/main` will delete untracked scripts that were stashed but never
  committed. Check `git stash list` before resetting.
- **Shell wrappers contain inline secrets.** The `.sh` scripts in
  `scripts/` embed Supabase service-role keys and Google API keys
  directly. Do not commit new secrets; move them to env vars.

---

## House rules

1. **Never auto-merge to main.** All merges require explicit user approval.
2. **Pivot before scraping.** SQL pivots from existing mention/signal
   tables before launching any new scrape run. (NYC coverage went
   28%→93% in seconds via pivot — scraping would have taken hours.)
3. **Menu scraper versions.** If a `menu scraper v100` exists, it
   supersedes any older v2/v2.3 versions. Do not call older versions.
4. **Next.js version.** This runs Next.js 16 which has breaking changes
   from training-data versions. Read
   `node_modules/next/dist/docs/` before writing new route handlers or
   page components. Heed deprecation notices.

---

## Project layout

```
src/
├── app/            # Next.js App Router pages and API routes
├── components/     # React components (cards/, auth/, brands/, explore/, search/, home/)
├── lib/            # Shared utilities
│   ├── supabase/   # Client, server, middleware, pagination helpers
│   ├── ranking/    # Trending algorithm (trending.ts, weights.ts)
│   ├── google/     # Google Places API client (places.ts)
│   ├── hooks/      # Custom hooks (useAuthUser.ts)
│   ├── restaurant.ts  # Photo URL fallback chain, cuisine display helpers
│   ├── format.ts      # Rating/count formatters
│   └── collections.ts # localStorage-backed favorites/collections
├── types/          # database.ts (Supabase generated types + manual additions)
scripts/            # Data pipeline scripts (enrich, seed, wipe)
supabase/
└── migrations/     # SQL migrations (001_aggregator_pivot through 20260415)
public/
└── logos/          # Brand SVG assets (Michelin, JBF, Eater, Google)
```

---

## Pointers

- `src/types/database.ts` — canonical type definitions for all Supabase tables.
- `src/lib/ranking/trending.ts` — trending score algorithm (30-day window, engagement-weighted).
- `src/lib/restaurant.ts` — photo URL fallback chain, cuisine display, fallback images.
- `supabase/migrations/` — migration history; the aggregator pivot (`001_`) is the foundational schema.
- `BACKLOG.md` — input queue for work items and Suggestions from agents.
- `STATE.md` — agent activity log (last 2 cycles inline; older archived).
- `QUESTIONS.md` — decision-gate questions awaiting answers.

---

## Agent lineup

Nine specialist lanes plus two reconciling overseers:

| Agent                | Lane scope                                                  | Writes to                         |
|----------------------|-------------------------------------------------------------|-----------------------------------|
| data-steward         | Scrapers, backfills, coverage pivots                        | `scripts/`                        |
| schema-guardian      | Migrations, indexes, types, RLS                             | `supabase/`                       |
| api-builder          | Supabase RPC, edge functions, server actions                | `api/`, `supabase/functions/`     |
| ranking-specialist   | Ranking algorithm, weights, scoring (**never without an answered question**) | `app/lib/ranking/` |
| performance          | Bundle size, query latency, web vitals (read-only)          | Findings only                     |
| bug-hunter           | Read-only latent-bug scan                                   | `BACKLOG.md` only                 |
| code-reviewer        | PR review (never merges)                                    | Review comments only              |
| feature-builder      | Frontend implementation                                     | `app/`                            |
| design-ux            | Design proposals + a11y critique                            | `design/proposals/`               |
| overseer-a           | First-pass auditor                                          | `OVERSEER_LOG.md` only            |
| overseer-b           | Challenger; produces reconciled verdict                     | `OVERSEER_LOG.md` only            |

Lane boundaries are strict. If an agent spots work belonging to another
lane, it files a Suggestion tagged with that lane — never crosses.

---

## Decision gates — when to ASK vs DO

**ASK** (write to QUESTIONS.md, pause the thread):
- Any user-visible UI change (copy, layout, color, component, screen, interaction)
- Any data operation touching >50 rows in production
- Any new scrape estimated >30 min or >100 restaurants
- Any schema change (CREATE/ALTER/DROP table or column)
- Any awards rescrape (history matters; never overwrite without confirmation)
- Any change to ranking formula, weights, or input signals — even 1%
- Any new database index on a table >100k rows
- Any new or modified RLS policy
- Any new or modified edge function auth model
- Any change affecting bundle size >10% or LCP >100ms
- Any new external API integration or rate-limit budget change
- Picking between 2+ viable approaches with meaningful tradeoffs
- Any deletion of code touched in the last 30 days, even if "obviously dead"

**Engagement gate — also ASK before shipping any of these as a default-on feature:**
- Any mechanic using **loss-framing or expiry** (streaks with guilt pushes, "your streak expires
  tonight", anything that frames absence as a loss rather than an opportunity)
- Any **interpersonal comparison in a notification** ("3 friends ate here without you", "you've
  fallen behind", any push containing another user's name/action as social pressure)
- Any **variable-ratio reward schedule** (randomized spinners, loot-box-adjacent reveals,
  unpredictable point payouts — includes Tonight's Pick unless it is quality-gated and re-spin
  capped per the adopted shape in §4 of reports/ENGAGEMENT_AND_COMMUNITY_SCORING_2026-06-09.md)
- Any **contribution-volume leaderboard** (ranking users by count of reviews, check-ins, votes,
  or any raw activity metric — profiles must describe taste, never activity volume)

The gate blocks *defaults*, not features. An opt-in version a user explicitly enables is not a
default — it does not require this gate (the user consented). Exception: notification framings
on the "Banned forever" list in reports/stage0/gate3-engagement-gate/notification-policy.md
never ship, opt-in or not. The gate requires: a QUESTIONS.md entry, an explicit owner approval,
and a written one-sentence user-benefit rationale that cannot be paraphrased as "it improves
retention."

**Two code-enforced defaults (apply at implementation time, not today):**
- Social/comparison notifications are **opt-in**. The default notification set is Gastronome-world
  news only ("a restaurant you saved just earned a Michelin star") — never interpersonal comparison
  by default.
- No public-profile metric counts raw contribution volume. Profiles surface taste signal (cuisines
  explored, neighborhoods covered, score distribution) — never a "N reviews written" badge or
  leaderboard position computed from activity count.

**DO** (act, then report in STATE.md):
- Read-only investigation
- Test additions, comments, behavior-preserving refactors
- Bug fixes with clear root cause and no UI surface area
- Data backfills <50 rows from existing pivot tables (no new scrapes)
- CREATE INDEX on a small table (<100k rows)
- Type regeneration after an approved migration
- Following an explicit prior answer in QUESTIONS.md (cite the question ID)

When in doubt, ASK. A blocked agent waiting is cheaper than an agent
shipping the wrong thing.

---

## Two-overseer reconciliation protocol

After the nine lane agents return, two overseers run sequentially:

**Overseer-A (Auditor)** — applies Decision Gates and lane rules, produces
initial verdict per QUESTIONS.md entry, draft PR, and Suggestion:
`OK | NEEDS-REVISION | WRONG-GATE | FLAGGED | LANE-VIOLATION | DEDUPE | DROP`.

**Overseer-B (Challenger)** — reads A's verdict and must either `ENDORSE`
(with reason) or `COUNTER` (with proposed alternative + reason). B must
counter at least 20% of A's verdicts per cycle; if B endorses everything,
escalate "all-endorse cycle" as a sign A is miscalibrated.

Reconciliation (B performs): B endorsed → A stands. B countered, A
stronger → "challenged + held". B countered, B stronger → "revised after
challenge". Genuinely 50/50 → "split-verdict"; D breaks the tie via the
digest. Output: ONE reconciled verdict per item in `OVERSEER_LOG.md`.

Hard rules: overseers are read-only, no new opinions about what to build,
never edit BACKLOG.md work items or QUESTIONS.md entries, never override
D's prior decisions. "Clean cycle" is valid output. Overseer-B must be a
sincere adversary, not a reflexive contrarian.

---

## Coordination file size limits

| File              | Inline cap               | Archive target                          |
|-------------------|--------------------------|------------------------------------------|
| `STATE.md`        | Last 2 cycles            | `STATE-archive-<YYYY-MM>.md` monthly    |
| `OVERSEER_LOG.md` | Last 5 cycles            | `OVERSEER-archive-<YYYY-MM>.md`         |
| `QUESTIONS.md`    | Answered <14 days        | `QUESTIONS-archive-<YYYY-MM>.md`        |
| `BACKLOG.md`      | 50 most recent Suggestions | Drop older                             |

Every agent must rotate-then-read when over the limit. This is a hard
rule — unbounded log growth is the single biggest token waste in
multi-agent setups.
