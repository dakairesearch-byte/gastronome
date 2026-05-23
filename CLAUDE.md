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

<!-- TODO: BACKLOG.md, STATE.md, and .claude/agents/ are referenced in
     project docs but do not exist in this repo yet. Create them when
     the multi-agent lane workflow is set up. -->

- `src/types/database.ts` — canonical type definitions for all Supabase tables.
- `src/lib/ranking/trending.ts` — trending score algorithm (30-day window, engagement-weighted).
- `src/lib/restaurant.ts` — photo URL fallback chain, cuisine display, fallback images.
- `supabase/migrations/` — migration history; the aggregator pivot (`001_`) is the foundational schema.
