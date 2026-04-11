import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { fetchYelpData } from '@/lib/apify/yelp'
import { fetchInfatuationData } from '@/lib/apify/infatuation'
import { fetchMichelinData } from '@/lib/apify/michelin'
import { fetchTikTokVideos } from '@/lib/apify/tiktok'
import { fetchInstagramVideos } from '@/lib/apify/instagram'

export const maxDuration = 300

const BATCH_SIZE = 5
const DELAY_MS = 3000

type ScraperFn = (id: string, name: string, city: string) => Promise<any>

interface ScrapeJob {
  restaurantId: string
  name: string
  city: string
  scrapers: { name: string; fn: ScraperFn }[]
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { secret, offset = 0, limit = 30, tier = 'yelp', city = 'New York' } = body

    if (secret !== process.env.BATCH_SCRAPE_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createServerSupabaseClient()

    // Build query based on tier
    let query = supabase
      .from('restaurants')
      .select('id, name, city, michelin_stars, michelin_designation, james_beard_winner, james_beard_nominated, eater_38, yelp_url, infatuation_url, michelin_url')
      .eq('city', city)

    // Filter based on what tier we're running
    if (tier === 'yelp') {
      query = query.is('yelp_url', null)
    } else if (tier === 'michelin') {
      query = query.is('michelin_url', null)
    } else if (tier === 'infatuation') {
      query = query.is('infatuation_url', null)
    }

    query = query
      .order('google_rating', { ascending: false, nullsFirst: true })
      .range(offset, offset + limit - 1)

    const { data: restaurants, error: fetchError } = await query

    if (fetchError || !restaurants) {
      return NextResponse.json(
        { error: 'Failed to fetch restaurants', details: fetchError?.message },
        { status: 500 }
      )
    }

    // Build scrape jobs based on tier
    const jobs: ScrapeJob[] = restaurants.map((r) => {
      const scrapers: { name: string; fn: ScraperFn }[] = []

      if (tier === 'yelp') {
        scrapers.push({ name: 'yelp', fn: fetchYelpData })
      } else if (tier === 'michelin') {
        if (r.michelin_stars > 0 || r.michelin_designation) {
          scrapers.push({ name: 'michelin', fn: fetchMichelinData })
        }
      } else if (tier === 'infatuation') {
        scrapers.push({ name: 'infatuation', fn: fetchInfatuationData })
      } else if (tier === 'social') {
        scrapers.push({ name: 'tiktok', fn: fetchTikTokVideos })
        scrapers.push({ name: 'instagram', fn: fetchInstagramVideos })
      } else if (tier === 'all_missing') {
        if (!r.yelp_url) scrapers.push({ name: 'yelp', fn: fetchYelpData })
        if (!r.michelin_url && (r.michelin_stars > 0 || r.michelin_designation)) {
          scrapers.push({ name: 'michelin', fn: fetchMichelinData })
        }
        if (!r.infatuation_url) scrapers.push({ name: 'infatuation', fn: fetchInfatuationData })
      }

      return { restaurantId: r.id, name: r.name, city: r.city ?? city, scrapers }
    })

    // Filter out jobs with no scrapers to run
    const activeJobs = jobs.filter((j) => j.scrapers.length > 0)

    const results: any[] = []

    // Process in batches
    for (let i = 0; i < activeJobs.length; i += BATCH_SIZE) {
      const batch = activeJobs.slice(i, i + BATCH_SIZE)

      const batchResults = await Promise.allSettled(
        batch.map(async (job) => {
          const scraperResults: Record<string, any> = {}
          for (const scraper of job.scrapers) {
            try {
              scraperResults[scraper.name] = await scraper.fn(
                job.restaurantId,
                job.name,
                job.city
              )
            } catch (err) {
              scraperResults[scraper.name] = {
                success: false,
                error: err instanceof Error ? err.message : String(err),
              }
            }
          }
          return {
            id: job.restaurantId,
            name: job.name,
            scrapers: job.scrapers.map((s) => s.name),
            results: scraperResults,
          }
        })
      )

      for (const outcome of batchResults) {
        results.push(
          outcome.status === 'fulfilled'
            ? outcome.value
            : { status: 'error', reason: outcome.reason }
        )
      }

      // Delay between batches
      if (i + BATCH_SIZE < activeJobs.length) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
      }
    }

    return NextResponse.json({
      success: true,
      tier,
      city,
      fetched: restaurants.length,
      jobsRun: activeJobs.length,
      jobsSkipped: jobs.length - activeJobs.length,
      nextOffset: offset + limit,
      hasMore: restaurants.length === limit,
      results,
    })
  } catch (error) {
    console.error('refresh-all error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
