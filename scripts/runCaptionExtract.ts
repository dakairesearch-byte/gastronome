/**
 * Bulk caption → dish aggregator, driven straight against Supabase REST
 * using the anon key. No service-role credential required:
 * `restaurant_highlighted_dishes` has RLS disabled, and
 * `restaurant_videos` has a public read policy.
 *
 * Usage:
 *   npx tsx scripts/runCaptionExtract.ts [--dry-run] [--limit N]
 *
 * Flow:
 *   1. Page through all captioned videos (SELECT id, restaurant_id,
 *      platform, caption FROM restaurant_videos WHERE caption IS NOT NULL).
 *   2. Group by restaurant, run `extractDishesFromCaption` on each caption,
 *      then `aggregateDishes` per (restaurant, platform) bucket.
 *   3. Merge into existing `restaurant_highlighted_dishes` rows so we keep
 *      whatever google_mentions / quotes already live there. Rank by total.
 *   4. Upsert in 200-row batches.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import {
  extractDishesFromCaption,
  aggregateDishes,
  canonicalize,
} from '../src/lib/dishes/extract'

// Load .env.local by hand — we don't want to pull in a dotenv dep.
const envPath = path.join(process.cwd(), '.env.local')
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/)
  if (!m) continue
  if (!process.env[m[1]]) process.env[m[1]] = m[2]
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!SUPA_URL || !SUPA_ANON) {
  console.error('Missing Supabase URL / anon key in .env.local')
  process.exit(1)
}
const supabase = createClient(SUPA_URL, SUPA_ANON, {
  auth: { persistSession: false },
})

interface Args {
  dryRun: boolean
  limit: number | null
}
function parseArgs(): Args {
  const a: Args = { dryRun: false, limit: null }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dry-run') a.dryRun = true
    else if (argv[i] === '--limit') a.limit = parseInt(argv[++i], 10)
  }
  return a
}

type VideoRow = {
  restaurant_id: string
  platform: string
  caption: string
}

async function fetchAllCaptions(): Promise<VideoRow[]> {
  const pageSize = 1000
  const out: VideoRow[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('restaurant_videos')
      .select('restaurant_id, platform, caption')
      .not('caption', 'is', null)
      .order('restaurant_id')
      .range(from, from + pageSize - 1)
    if (error) throw new Error(`fetchAllCaptions: ${error.message}`)
    if (!data || data.length === 0) break
    for (const r of data) {
      if (typeof r.caption === 'string' && r.caption.trim().length > 20) {
        out.push(r as VideoRow)
      }
    }
    if (data.length < pageSize) break
  }
  return out
}

type PerDish = {
  google: number
  tiktok: number
  instagram: number
  other: number
  sampleQuote: string | null
  sampleSource: string | null
}

function bucketPlatform(p: string): 'tiktok' | 'instagram' | 'other' {
  if (p === 'tiktok') return 'tiktok'
  if (p === 'instagram') return 'instagram'
  return 'other'
}

async function fetchExistingDishes(
  restaurantId: string
): Promise<Map<string, PerDish & { rank: number | null }>> {
  const { data, error } = await supabase
    .from('restaurant_highlighted_dishes')
    .select(
      'dish_name, google_mentions, tiktok_mentions, instagram_mentions, other_mentions, sample_quote, sample_quote_source, rank'
    )
    .eq('restaurant_id', restaurantId)
  if (error) throw new Error(`fetchExistingDishes: ${error.message}`)
  const out = new Map<string, PerDish & { rank: number | null }>()
  for (const r of data ?? []) {
    out.set(r.dish_name, {
      google: r.google_mentions ?? 0,
      tiktok: r.tiktok_mentions ?? 0,
      instagram: r.instagram_mentions ?? 0,
      other: r.other_mentions ?? 0,
      sampleQuote: r.sample_quote,
      sampleSource: r.sample_quote_source,
      rank: r.rank,
    })
  }
  return out
}

async function run() {
  const args = parseArgs()
  console.log('Pulling captions from Supabase…')
  const videos = await fetchAllCaptions()
  console.log(`  ${videos.length} captioned videos across ${new Set(videos.map((v) => v.restaurant_id)).size} restaurants`)

  // Group by restaurant
  const byRest = new Map<string, VideoRow[]>()
  for (const v of videos) {
    const arr = byRest.get(v.restaurant_id) ?? []
    arr.push(v)
    byRest.set(v.restaurant_id, arr)
  }

  const restaurants = Array.from(byRest.keys())
  const targetRestaurants = args.limit ? restaurants.slice(0, args.limit) : restaurants

  let touchedRestaurants = 0
  let upsertedRows = 0
  const batchRows: Array<{
    restaurant_id: string
    dish_name: string
    google_mentions: number
    tiktok_mentions: number
    instagram_mentions: number
    other_mentions: number
    mention_count: number
    rank: number
    sample_quote: string | null
    sample_quote_source: string | null
    updated_at: string
  }> = []

  for (const rId of targetRestaurants) {
    const rows = byRest.get(rId)!
    // Group captions by platform and extract
    const byPlat = new Map<
      'tiktok' | 'instagram' | 'other',
      Array<{ caption: string; dishes: ReturnType<typeof extractDishesFromCaption> }>
    >()
    for (const r of rows) {
      const plat = bucketPlatform(r.platform)
      const dishes = extractDishesFromCaption(r.caption)
      if (dishes.length === 0) continue
      const bucket = byPlat.get(plat) ?? []
      bucket.push({ caption: r.caption, dishes })
      byPlat.set(plat, bucket)
    }
    if (byPlat.size === 0) continue

    const merged = await fetchExistingDishes(rId)
    for (const [plat, list] of byPlat) {
      const agg = aggregateDishes(list)
      for (const d of agg) {
        const key = canonicalize(d.dish)
        const cur = merged.get(key) ?? {
          google: 0,
          tiktok: 0,
          instagram: 0,
          other: 0,
          sampleQuote: null,
          sampleSource: null,
          rank: null,
        }
        if (plat === 'tiktok') cur.tiktok += d.mentions
        else if (plat === 'instagram') cur.instagram += d.mentions
        else cur.other += d.mentions
        if (!cur.sampleQuote && d.sampleQuote) {
          cur.sampleQuote = d.sampleQuote
          cur.sampleSource = plat
        }
        merged.set(key, cur)
      }
    }

    // Build ordered rows for this restaurant
    const entries = Array.from(merged.entries())
      .filter(([_, v]) => v.google + v.tiktok + v.instagram + v.other > 0)
      .map(([dish, v]) => ({
        dish,
        total: v.google + v.tiktok + v.instagram + v.other,
        v,
      }))
      .sort((a, b) => b.total - a.total)

    if (entries.length === 0) continue
    touchedRestaurants += 1

    for (let i = 0; i < entries.length; i++) {
      const { dish, total, v } = entries[i]
      batchRows.push({
        restaurant_id: rId,
        dish_name: dish,
        google_mentions: v.google,
        tiktok_mentions: v.tiktok,
        instagram_mentions: v.instagram,
        other_mentions: v.other,
        mention_count: total,
        rank: i + 1,
        sample_quote: v.sampleQuote,
        sample_quote_source: v.sampleSource,
        updated_at: new Date().toISOString(),
      })
    }

    // Flush in ~200-row batches
    if (batchRows.length >= 200) {
      if (args.dryRun) {
        upsertedRows += batchRows.length
      } else {
        const { error } = await supabase
          .from('restaurant_highlighted_dishes')
          .upsert(batchRows, { onConflict: 'restaurant_id,dish_name' })
        if (error) {
          console.warn(`   [upsert batch fail] ${error.message}`)
        } else {
          upsertedRows += batchRows.length
        }
      }
      batchRows.length = 0
    }
  }

  // Final flush
  if (batchRows.length > 0) {
    if (args.dryRun) {
      upsertedRows += batchRows.length
    } else {
      const { error } = await supabase
        .from('restaurant_highlighted_dishes')
        .upsert(batchRows, { onConflict: 'restaurant_id,dish_name' })
      if (error) {
        console.warn(`   [final upsert fail] ${error.message}`)
      } else {
        upsertedRows += batchRows.length
      }
    }
  }

  console.log(
    `${args.dryRun ? 'DRY-RUN ' : ''}Touched ${touchedRestaurants} restaurants, ${upsertedRows} dish rows total.`
  )
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
