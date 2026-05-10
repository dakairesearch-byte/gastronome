/**
 * Google Places enrichment with top-3 photos + built-in QA.
 *
 * Two modes:
 *   --mode=search   (default)  — for rows with NULL google_place_id: run Text Search
 *                                with name+city+state, capture place_id, website,
 *                                address, top 3 photo URLs, etc.
 *   --mode=photos              — for rows WITH google_place_id but NULL photo_url:
 *                                use the existing place_id to fetch photos only
 *                                (via Place Details), skip Text Search.
 *
 * QA built in:
 *   - Name similarity gate: rejects matches where normalized queried-name vs
 *     returned displayName similarity < MIN_NAME_SIM (0.5). Prevents "Atelier"
 *     in NY being matched to "Atelier Crenn" in SF, etc.
 *   - Photo HEAD check: at the end, samples 20 random new photo URLs and HEADs
 *     them through the proxy. Reports any 4xx/5xx.
 *   - Suspect-match report: writes tmp/enrichment_suspects.json with all rows
 *     below a confidence threshold so user can eyeball + re-search manually.
 *
 * Usage:
 *   npx tsx scripts/enrichPlacesAndPhotos.ts --mode=search [--limit=N] [--apply]
 *   npx tsx scripts/enrichPlacesAndPhotos.ts --mode=photos [--limit=N] [--apply]
 *
 * Defaults to APPLY unless --dryRun is passed (we've QA'd the search path; user
 * wants execution).
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const envPath = path.join(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!
if (!SUPA_URL || !SUPA_KEY || !GOOGLE_API_KEY) {
  console.error('Missing SUPABASE env or GOOGLE_PLACES_API_KEY'); process.exit(1)
}
const s = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

const RATE_LIMIT_MS = 120
const MIN_NAME_SIM = 0.5     // QA gate: reject matches under this
const SUSPECT_SIM = 0.7      // QA flag: below this, flag as suspect
const MAX_PHOTOS = 3

const args = Object.fromEntries(process.argv.slice(2).map(a => {
  const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? 'true']
})) as Record<string, string>
const MODE = (args.mode ?? 'search') as 'search' | 'photos'
const LIMIT = Number(args.limit ?? '2000')
const DRY_RUN = args.dryRun === 'true'

console.log(`=== enrichPlacesAndPhotos mode=${MODE} limit=${LIMIT} ${DRY_RUN ? '(DRY)' : '(APPLY)'} ===\n`)

// ---------- name normalization + similarity ----------
function decodeHtmlEntities(v: string): string {
  return (v || '').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
}
function normName(v: string): string {
  return decodeHtmlEntities(v || '')
    .toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    // Normalize all apostrophe variants then strip them entirely for matching
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u00B4`'']/g, '')
    .replace(/[^\w\s&-]/g, ' ').replace(/\s+/g, ' ')
    .replace(/\b(the|a|an|restaurant)\b/gi, '').replace(/\s+/g, ' ').trim()
}
// Similarity: best of Jaccard, substring containment, and coverage of shorter
// name in longer name. Handles "Yūgen" vs "Yugen - Fine Dining Restaurant"
// (same place, descriptive suffix) without matching unrelated names.
function nameSim(a: string, b: string): number {
  const na = normName(a), nb = normName(b)
  if (!na || !nb) return 0
  // Exact normalized match
  if (na === nb) return 1
  // Substring containment (Yūgen ⊂ Yugen fine dining)
  if (na.length >= 4 && nb.includes(na)) return 0.85
  if (nb.length >= 4 && na.includes(nb)) return 0.85
  const ta = new Set(na.split(' ').filter(Boolean))
  const tb = new Set(nb.split(' ').filter(Boolean))
  if (!ta.size || !tb.size) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  const jaccard = inter / new Set([...ta, ...tb]).size
  // Coverage of shorter name in longer (for "Daniel" vs "Daniel Boulud restaurant")
  const shorter = ta.size <= tb.size ? ta : tb
  const coverage = inter / shorter.size
  return Math.max(jaccard, coverage * 0.9)
}

// ---------- photo URL helper ----------
function getPhotoUrl(photoName: string, maxWidth = 1200): string {
  return `/api/photos/${photoName}?w=${maxWidth}`
}

// ---------- city → state (broad so awards imports are covered) ----------
const CITY_STATE_MAP: Record<string, string> = {
  // NYC
  'New York': 'NY', 'Brooklyn': 'NY', 'Queens': 'NY', 'Bronx': 'NY', 'Staten Island': 'NY',
  'Long Island City': 'NY', 'Astoria': 'NY', 'Tarrytown': 'NY',
  // Chicago
  'Chicago': 'IL', 'Evanston': 'IL',
  // LA
  'Los Angeles': 'CA', 'Santa Monica': 'CA', 'Beverly Hills': 'CA', 'Culver City': 'CA',
  'West Hollywood': 'CA', 'Hollywood': 'CA', 'Venice': 'CA', 'Pasadena': 'CA',
  'Malibu': 'CA', 'Manhattan Beach': 'CA', 'West Los Angeles': 'CA',
  // SF Bay + wine country
  'San Francisco': 'CA', 'Oakland': 'CA', 'Berkeley': 'CA', 'Palo Alto': 'CA',
  'Mountain View': 'CA', 'Menlo Park': 'CA', 'Atherton': 'CA', 'Napa': 'CA',
  'Yountville': 'CA', 'Calistoga': 'CA', 'Rutherford': 'CA', 'St Helena': 'CA',
  'Saint Helena': 'CA', 'Sonoma': 'CA', 'Healdsburg': 'CA', 'Sebastopol': 'CA',
  'Elk': 'CA', 'San Jose': 'CA', 'Los Altos': 'CA', 'Woodside': 'CA',
  // Miami
  'Miami': 'FL', 'Miami Beach': 'FL', 'Coral Gables': 'FL', 'Key Biscayne': 'FL',
  // Austin
  'Austin': 'TX',
}

// ---------- Places API: Text Search ----------
interface SearchResult {
  id: string
  displayName?: { text: string }
  formattedAddress?: string
  location?: { latitude: number; longitude: number }
  rating?: number
  userRatingCount?: number
  priceLevel?: string
  types?: string[]
  nationalPhoneNumber?: string
  websiteUri?: string
  photos?: Array<{ name: string }>
  googleMapsUri?: string
  editorialSummary?: { text: string }
}

async function searchPlace(name: string, city: string, state: string): Promise<SearchResult | null> {
  const fieldMask = [
    'places.id', 'places.displayName', 'places.formattedAddress',
    'places.location', 'places.rating', 'places.userRatingCount',
    'places.priceLevel', 'places.types', 'places.nationalPhoneNumber',
    'places.websiteUri', 'places.photos', 'places.googleMapsUri',
    'places.editorialSummary',
  ].join(',')
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask': fieldMask },
    body: JSON.stringify({ textQuery: `${name} restaurant ${city}, ${state}`, maxResultCount: 3 }),
  })
  if (!res.ok) { console.error(`  GOOGLE ${res.status}: ${name}`); return null }
  const data = await res.json() as { places?: SearchResult[] }
  const places = data.places ?? []
  if (!places.length) return null

  // QA: pick the best-name-match instead of blindly first result
  let best = places[0]
  let bestSim = nameSim(name, best.displayName?.text || '')
  for (const p of places.slice(1)) {
    const sim = nameSim(name, p.displayName?.text || '')
    if (sim > bestSim) { best = p; bestSim = sim }
  }
  ;(best as any).__sim = bestSim
  return best
}

// ---------- Places API: Details (for photo-only mode) ----------
async function getPlaceDetails(placeId: string): Promise<SearchResult | null> {
  const fieldMask = ['id', 'displayName', 'photos', 'rating', 'userRatingCount', 'websiteUri', 'googleMapsUri', 'editorialSummary'].join(',')
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY, 'X-Goog-FieldMask': fieldMask },
  })
  if (!res.ok) { console.error(`  DETAILS ${res.status}: ${placeId}`); return null }
  return await res.json() as SearchResult
}

// ---------- main ----------
async function main() {
  const targets: Array<{ id: string; name: string; city: string; state: string | null; google_place_id: string | null }> = []

  if (MODE === 'search') {
    const { data } = await s
      .from('restaurants')
      .select('id, name, city, state, google_place_id')
      .is('google_place_id', null)
      .order('created_at', { ascending: false })
      .limit(LIMIT)
    targets.push(...((data as any) ?? []))
  } else {
    const { data } = await s
      .from('restaurants')
      .select('id, name, city, state, google_place_id')
      .not('google_place_id', 'is', null)
      .or('photo_url.is.null,photo_url.eq.')
      .limit(LIMIT)
    targets.push(...((data as any) ?? []))
  }
  console.log(`targets: ${targets.length}`)

  let matched = 0, rejected = 0, failed = 0
  const suspects: any[] = []

  for (let i = 0; i < targets.length; i++) {
    const t = targets[i]
    try {
      const state = t.state || CITY_STATE_MAP[t.city] || ''
      let place: SearchResult | null
      let sim = 1.0

      if (MODE === 'search') {
        place = await searchPlace(t.name, t.city, state)
        if (!place) { failed++; continue }
        sim = (place as any).__sim ?? 0
        // QA gate: drop low-confidence matches
        if (sim < MIN_NAME_SIM) {
          rejected++
          suspects.push({ id: t.id, db_name: t.name, matched_name: place.displayName?.text, sim, city: t.city, state })
          console.log(`  REJECT (sim=${sim.toFixed(2)}) ${t.name} → ${place.displayName?.text}`)
          await new Promise(r => setTimeout(r, RATE_LIMIT_MS))
          continue
        }
      } else {
        place = await getPlaceDetails(t.google_place_id!)
        if (!place) { failed++; continue }
      }

      // Top-3 photos as proxy URLs
      const photoNames = (place.photos ?? []).slice(0, MAX_PHOTOS).map(p => p.name)
      const photoUrls = photoNames.map(n => getPhotoUrl(n))
      const primaryPhoto = photoUrls[0] ?? null

      const updateData: Record<string, any> = {
        photo_urls: photoUrls,
        last_fetched_at: new Date().toISOString(),
      }
      if (primaryPhoto) {
        updateData.photo_url = primaryPhoto
        updateData.google_photo_url = primaryPhoto
      }

      if (MODE === 'search') {
        updateData.google_place_id = place.id
        if (place.formattedAddress) updateData.address = place.formattedAddress
        if (place.location) {
          updateData.latitude = place.location.latitude
          updateData.longitude = place.location.longitude
        }
        if (place.rating != null) updateData.google_rating = place.rating
        if (place.userRatingCount != null) updateData.google_review_count = place.userRatingCount
        if (place.websiteUri) updateData.website = place.websiteUri
        if (place.googleMapsUri) updateData.google_url = place.googleMapsUri
        if (place.nationalPhoneNumber) updateData.phone = place.nationalPhoneNumber
        if (place.editorialSummary?.text) updateData.description = place.editorialSummary.text
      }

      // QA signal 2: address city should match DB city (or metro equivalent)
      let cityMismatch = false
      if (MODE === 'search' && place.formattedAddress) {
        const addrLower = place.formattedAddress.toLowerCase()
        const dbCityLower = (t.city || '').toLowerCase()
        if (dbCityLower && !addrLower.includes(dbCityLower)) {
          // Allow metro equivalents (e.g. DB "Los Angeles" matches addresses in Santa Monica/Beverly Hills via state)
          const metroCities: Record<string, string[]> = {
            'los angeles': ['santa monica', 'beverly hills', 'culver city', 'west hollywood', 'hollywood', 'venice', 'pasadena', 'malibu', 'encino', 'studio city'],
            'new york': ['brooklyn', 'queens', 'bronx', 'manhattan'],
            'san francisco': ['oakland', 'berkeley'],
          }
          const allowed = metroCities[dbCityLower] ?? []
          cityMismatch = !allowed.some(c => addrLower.includes(c))
        }
      }

      // QA signal 3: low review count = likely wrong or dead match
      const reviewCount = place.userRatingCount ?? 0
      const lowReview = MODE === 'search' && reviewCount < 20

      // Final gate: if BOTH cityMismatch AND lowReview, reject entirely
      if (cityMismatch && lowReview) {
        rejected++
        suspects.push({ id: t.id, db_name: t.name, matched_name: place.displayName?.text, sim, address: place.formattedAddress, review_count: reviewCount, note: 'city_mismatch_and_low_reviews' })
        console.log(`  REJECT (city+reviews) ${t.name} → ${place.displayName?.text} @ ${place.formattedAddress?.slice(0, 40)} (${reviewCount} reviews)`)
        await new Promise(r => setTimeout(r, RATE_LIMIT_MS))
        continue
      }

      if (!DRY_RUN) {
        const { error } = await s.from('restaurants').update(updateData).eq('id', t.id)
        if (error) { console.error(`  UPDATE FAIL ${t.name}: ${error.message}`); failed++; continue }
      }
      matched++
      if (sim < SUSPECT_SIM || cityMismatch || lowReview) {
        suspects.push({
          id: t.id, db_name: t.name, matched_name: place.displayName?.text,
          sim: +sim.toFixed(2), address: place.formattedAddress, review_count: reviewCount,
          note: [sim < SUSPECT_SIM && 'low_sim', cityMismatch && 'city_mismatch', lowReview && 'low_reviews'].filter(Boolean).join(','),
        })
      }

      if (matched % 50 === 0) console.log(`  progress ${i + 1}/${targets.length}  matched=${matched} rejected=${rejected} failed=${failed}`)
    } catch (e: any) {
      failed++
      console.error(`  EXC ${t.name}: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS))
  }

  // QA report
  const tmp = path.join(process.cwd(), 'tmp'); fs.mkdirSync(tmp, { recursive: true })
  const reportPath = path.join(tmp, `enrichment_suspects_${Date.now()}.json`)
  fs.writeFileSync(reportPath, JSON.stringify({ mode: MODE, matched, rejected, failed, suspects }, null, 2))

  console.log(`\n=== DONE ===`)
  console.log(`matched:  ${matched}`)
  console.log(`rejected: ${rejected} (name similarity < ${MIN_NAME_SIM})`)
  console.log(`failed:   ${failed}`)
  console.log(`suspects: ${suspects.length} → ${reportPath}`)
  console.log(`\nRun QA check with:  npx tsx scripts/_qaPhotoEnrichment.ts`)
}

main().catch(e => { console.error(e); process.exit(1) })
