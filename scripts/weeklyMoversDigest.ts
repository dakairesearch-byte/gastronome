/**
 * weeklyMoversDigest.ts
 *
 * Stage 6, idea #43 — "The Gastronome 10 weekly metro movers digest."
 *
 * Per-active-metro digest of objectively NEW facts only:
 *   • New restaurants added this ISO-week (created_at window)
 *   • Accolade changes ingested in the last 7 days (restaurant_michelin_history /
 *     restaurant_eater38_history rows with created_at in the window — ledger-new
 *     rows only, so the same accolade is never re-announced in later weeks)
 *   • Buzziest by video ingestion volume this week (restaurant_videos rows
 *     with created_at in the window, counted per restaurant)
 *
 * NEVER surfaces rank jitter — only ledger-new facts.
 *
 * Output:
 *   reports/digests/digest-<ISO-week>.md   (markdown, always written)
 *   reports/digests/digest-<ISO-week>.json (machine-readable, always written)
 *
 * Email (Resend API):
 *   • REQUIRES --send flag (off by default — never auto-sends)
 *   • REQUIRES RESEND_API_KEY in env
 *   • Sends to all waitlist_signups emails via the Resend /emails/batch
 *     endpoint, 50 per request, individually addressed (one recipient per
 *     email object — the list is never exposed in a shared to: header)
 *
 * Usage:
 *   npx tsx scripts/weeklyMoversDigest.ts               # dry-run, writes files
 *   npx tsx scripts/weeklyMoversDigest.ts --send        # write files + send email
 *   npx tsx scripts/weeklyMoversDigest.ts --week=2026-W23  # specific ISO week
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

// ─── Env loading (.env.local, matching existing TS script convention) ────────
const ROOT = process.cwd()
const envPath = path.join(ROOT, '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '')
  }
}

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPA_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
if (!SUPA_URL || !SUPA_KEY) {
  console.error('[weeklyDigest] Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(SUPA_URL, SUPA_KEY, { auth: { persistSession: false } })

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? 'true']
  }),
) as Record<string, string>

const SEND = args.send === 'true'
const WEEK_ARG = args.week ?? null   // e.g. "2026-W23"

// ─── ISO week helpers ─────────────────────────────────────────────────────────
/** Returns { isoWeek: "2026-W23", weekStart: Date, weekEnd: Date } for a given date */
function isoWeekOf(d: Date): { isoWeek: string; weekStart: Date; weekEnd: Date } {
  // ISO week: Monday-based
  const jan4 = new Date(d.getFullYear(), 0, 4)
  const startOfYear = new Date(jan4)
  const dayOfWeek = (jan4.getDay() + 6) % 7   // 0=Mon..6=Sun
  startOfYear.setDate(jan4.getDate() - dayOfWeek)

  const daysSinceStart = Math.round((d.getTime() - startOfYear.getTime()) / 86400000)
  const weekNum = Math.floor(daysSinceStart / 7) + 1

  const weekStart = new Date(startOfYear)
  weekStart.setDate(startOfYear.getDate() + (weekNum - 1) * 7)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  weekEnd.setHours(0, 0, 0, 0)

  const year = d.getFullYear()
  const isoWeek = `${year}-W${String(weekNum).padStart(2, '0')}`
  return { isoWeek, weekStart, weekEnd }
}

/** Parse a "YYYY-Www" string into its start/end dates */
function parseIsoWeek(w: string): { isoWeek: string; weekStart: Date; weekEnd: Date } {
  const m = w.match(/^(\d{4})-W(\d{2})$/)
  if (!m) throw new Error(`Invalid ISO week format: ${w}`)
  const year = parseInt(m[1], 10)
  const week = parseInt(m[2], 10)
  // ISO week 1 contains Jan 4
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = (jan4.getDay() + 6) % 7
  const weekStart = new Date(jan4)
  weekStart.setDate(jan4.getDate() - dayOfWeek + (week - 1) * 7)
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  weekEnd.setHours(0, 0, 0, 0)
  return { isoWeek: w, weekStart, weekEnd }
}

// ─── Pagination helper ────────────────────────────────────────────────────────
async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const PAGE = 1000
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) {
      console.error(`[weeklyDigest] ${label} fetch error:`, error.message)
      process.exit(1)
    }
    all.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return all
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const { isoWeek, weekStart, weekEnd } = WEEK_ARG
    ? parseIsoWeek(WEEK_ARG)
    : isoWeekOf(new Date())

  const winStart = weekStart.toISOString()
  const winEnd   = weekEnd.toISOString()
  const sevenDaysAgo = new Date(weekEnd.getTime() - 7 * 86400000).toISOString()

  console.log(`[weeklyDigest] week=${isoWeek} window=${winStart} → ${winEnd}`)
  console.log(`[weeklyDigest] SEND=${SEND}`)

  // ─── 1. New restaurants this week ─────────────────────────────────────────
  type RestRow = {
    id: string; name: string; city: string | null; neighborhood: string | null
    michelin_stars: number | null; michelin_designation: string | null
    eater_38: boolean | null; james_beard_winner: boolean | null
    created_at: string | null
  }
  const newRestaurants = await fetchAll<RestRow>((from, to) =>
    sb.from('restaurants')
      .select('id,name,city,neighborhood,michelin_stars,michelin_designation,eater_38,james_beard_winner,created_at')
      .gte('created_at', winStart)
      .lt('created_at', winEnd)
      .order('created_at', { ascending: false })
      .range(from, to),
    'new restaurants',
  )
  console.log(`[weeklyDigest] new restaurants this week: ${newRestaurants.length}`)

  // ─── 2. Accolade changes via history tables (created_at window) ──────────
  // Only rows INGESTED this window count as "changes". Filtering by
  // year=currentYear would re-surface the same accolades every week all year —
  // the digest charter is ledger-new facts only, announced exactly once.
  const { data: michelinChanges, error: michelinErr } = await sb
    .from('restaurant_michelin_history')
    .select('restaurant_id,year,designation')
    .gte('created_at', sevenDaysAgo)
    .lt('created_at', winEnd)
    .limit(1000)
  if (michelinErr) console.warn('[weeklyDigest] michelin history warn:', michelinErr.message)

  // Also fetch eater38 history if table exists
  const { data: eaterChanges, error: eaterErr } = await sb
    .from('restaurant_eater38_history')
    .select('restaurant_id,year')
    .gte('created_at', sevenDaysAgo)
    .lt('created_at', winEnd)
    .limit(1000)
  if (eaterErr && !eaterErr.message.includes('does not exist')) {
    console.warn('[weeklyDigest] eater38 history warn:', eaterErr.message)
  }

  // Collect restaurant IDs with accolade changes this cycle
  const accoladeRestaurantIds = new Set<string>()
  for (const row of michelinChanges ?? []) accoladeRestaurantIds.add(row.restaurant_id)
  for (const row of eaterChanges ?? []) accoladeRestaurantIds.add(row.restaurant_id)

  // Fetch those restaurants for display (if any)
  const accoladeRestaurants: RestRow[] = []
  if (accoladeRestaurantIds.size > 0) {
    const ids = Array.from(accoladeRestaurantIds)
    // Exclude any that are also "new" this week to avoid double-counting
    const newIds = new Set(newRestaurants.map((r) => r.id))
    const accoladeOnly = ids.filter((id) => !newIds.has(id))
    if (accoladeOnly.length > 0) {
      const { data, error } = await sb
        .from('restaurants')
        .select('id,name,city,neighborhood,michelin_stars,michelin_designation,eater_38,james_beard_winner,created_at')
        .in('id', accoladeOnly.slice(0, 100))
      if (error) console.warn('[weeklyDigest] accolade restaurants warn:', error.message)
      accoladeRestaurants.push(...(data ?? []))
    }
  }
  console.log(`[weeklyDigest] accolade changes (non-new restaurants): ${accoladeRestaurants.length}`)

  // ─── 3. Buzziest by video ingestion this week ─────────────────────────────
  type VideoRow = { restaurant_id: string }
  const newVideos = await fetchAll<VideoRow>((from, to) =>
    sb.from('restaurant_videos')
      .select('restaurant_id')
      .gte('created_at', sevenDaysAgo)
      .lt('created_at', winEnd)
      .order('restaurant_id', { ascending: true })
      .range(from, to),
    'restaurant_videos',
  )
  // Count by restaurant
  const videoCounts = new Map<string, number>()
  for (const v of newVideos) {
    videoCounts.set(v.restaurant_id, (videoCounts.get(v.restaurant_id) ?? 0) + 1)
  }
  // Top 10 buzziest
  const topBuzzIds = Array.from(videoCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id]) => id)

  const buzzRestaurants: (RestRow & { videoCount: number })[] = []
  if (topBuzzIds.length > 0) {
    const { data, error } = await sb
      .from('restaurants')
      .select('id,name,city,neighborhood,michelin_stars,michelin_designation,eater_38,james_beard_winner,created_at')
      .in('id', topBuzzIds)
    if (error) console.warn('[weeklyDigest] buzz restaurants warn:', error.message)
    for (const r of data ?? []) {
      buzzRestaurants.push({ ...r, videoCount: videoCounts.get(r.id) ?? 0 })
    }
    buzzRestaurants.sort((a, b) => b.videoCount - a.videoCount)
  }
  console.log(`[weeklyDigest] buzziest restaurants: ${buzzRestaurants.length}`)

  // ─── 4. Group metros (by city) ────────────────────────────────────────────
  const cities = new Set([
    ...newRestaurants.map((r) => r.city ?? 'Unknown'),
    ...accoladeRestaurants.map((r) => r.city ?? 'Unknown'),
    ...buzzRestaurants.map((r) => r.city ?? 'Unknown'),
  ])

  // ─── 5. Build digest data ─────────────────────────────────────────────────
  const digestData = {
    isoWeek,
    generatedAt: new Date().toISOString(),
    windowStart: winStart,
    windowEnd:   winEnd,
    metros: Array.from(cities).sort().map((city) => ({
      city,
      newRestaurants: newRestaurants
        .filter((r) => (r.city ?? 'Unknown') === city)
        .map((r) => ({
          id: r.id,
          name: r.name,
          neighborhood: r.neighborhood,
          accolades: formatAccolades(r),
          addedAt: r.created_at,
        })),
      accoladeChanges: accoladeRestaurants
        .filter((r) => (r.city ?? 'Unknown') === city)
        .map((r) => ({
          id: r.id,
          name: r.name,
          neighborhood: r.neighborhood,
          accolades: formatAccolades(r),
        })),
      buzziest: buzzRestaurants
        .filter((r) => (r.city ?? 'Unknown') === city)
        .map((r) => ({
          id: r.id,
          name: r.name,
          neighborhood: r.neighborhood,
          videoCount: r.videoCount,
        })),
    })),
  }

  // ─── 6. Render markdown ───────────────────────────────────────────────────
  const md = renderMarkdown(digestData)

  // ─── 7. Write files ───────────────────────────────────────────────────────
  const digestDir = path.join(ROOT, 'reports', 'digests')
  if (!fs.existsSync(digestDir)) fs.mkdirSync(digestDir, { recursive: true })

  const mdPath   = path.join(digestDir, `digest-${isoWeek}.md`)
  const jsonPath = path.join(digestDir, `digest-${isoWeek}.json`)
  fs.writeFileSync(mdPath,   md,                              'utf8')
  fs.writeFileSync(jsonPath, JSON.stringify(digestData, null, 2), 'utf8')
  console.log(`[weeklyDigest] wrote ${mdPath}`)
  console.log(`[weeklyDigest] wrote ${jsonPath}`)

  // ─── 8. Send email if --send + RESEND_API_KEY ─────────────────────────────
  if (!SEND) {
    console.log('[weeklyDigest] --send not set — skipping email send.')
    return
  }
  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY) {
    console.warn('[weeklyDigest] RESEND_API_KEY not set — skipping email.')
    return
  }

  // Fetch waitlist emails (deduped)
  const waitlist = await fetchAll<{ email: string }>((from, to) =>
    sb.from('waitlist_signups')
      .select('email')
      .order('created_at', { ascending: true })
      .range(from, to),
    'waitlist_signups',
  )
  const recipients = Array.from(new Set(waitlist.map((r) => r.email).filter(Boolean)))
  console.log(`[weeklyDigest] sending to ${recipients.length} waitlist addresses`)

  const htmlBody = markdownToSimpleHtml(md)

  // Resend batch endpoint: 50 email objects per request, ONE RECIPIENT PER
  // EMAIL OBJECT. Never put multiple subscribers in a single `to:` — that
  // exposes the entire mailing list to every recipient.
  const BATCH = 50
  let sent = 0
  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH)
    const payload = batch.map((email) => ({
      from: 'Gastronome <digest@mail.gastronome.app>',
      to:   [email],
      subject: `Gastronome — What's new this week (${isoWeek})`,
      html: htmlBody,
    }))
    const resp = await fetch('https://api.resend.com/emails/batch', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify(payload),
    })
    if (!resp.ok) {
      const err = await resp.text()
      console.error(`[weeklyDigest] Resend error batch ${i / BATCH}:`, err)
    } else {
      sent += batch.length
    }
  }
  console.log(`[weeklyDigest] sent to ${sent} addresses`)
}

// ─── Accolade formatter ───────────────────────────────────────────────────────
function formatAccolades(r: {
  michelin_stars: number | null
  michelin_designation: string | null
  eater_38: boolean | null
  james_beard_winner: boolean | null
}): string[] {
  const acc: string[] = []
  if (r.michelin_stars && r.michelin_stars > 0) {
    acc.push(`${r.michelin_stars}★ Michelin`)
  } else if (r.michelin_designation) {
    acc.push(`Michelin ${r.michelin_designation}`)
  }
  if (r.eater_38) acc.push('Eater 38')
  if (r.james_beard_winner) acc.push('James Beard Winner')
  return acc
}

// ─── Markdown renderer ────────────────────────────────────────────────────────
function renderMarkdown(data: ReturnType<typeof buildDigestShape>): string {
  const lines: string[] = []
  lines.push(`# Gastronome Weekly Digest — ${data.isoWeek}`)
  lines.push(``)
  lines.push(`_Generated ${new Date(data.generatedAt).toUTCString()}_`)
  lines.push(`_Window: ${data.windowStart.slice(0, 10)} → ${data.windowEnd.slice(0, 10)}_`)
  lines.push(``)
  lines.push(`---`)
  lines.push(``)

  for (const metro of data.metros) {
    const hasContent =
      metro.newRestaurants.length > 0 ||
      metro.accoladeChanges.length > 0 ||
      metro.buzziest.length > 0
    if (!hasContent) continue

    lines.push(`## ${metro.city}`)
    lines.push(``)

    if (metro.newRestaurants.length > 0) {
      lines.push(`### New this week`)
      for (const r of metro.newRestaurants) {
        const loc = r.neighborhood ? ` (${r.neighborhood})` : ''
        const acc = r.accolades.length > 0 ? ` — ${r.accolades.join(', ')}` : ''
        lines.push(`- **${r.name}**${loc}${acc}`)
      }
      lines.push(``)
    }

    if (metro.accoladeChanges.length > 0) {
      lines.push(`### Accolade changes`)
      for (const r of metro.accoladeChanges) {
        const loc = r.neighborhood ? ` (${r.neighborhood})` : ''
        const acc = r.accolades.length > 0 ? ` — ${r.accolades.join(', ')}` : ''
        lines.push(`- **${r.name}**${loc}${acc}`)
      }
      lines.push(``)
    }

    if (metro.buzziest.length > 0) {
      lines.push(`### Buzzing on video this week`)
      for (const r of metro.buzziest) {
        const loc = r.neighborhood ? ` (${r.neighborhood})` : ''
        lines.push(`- **${r.name}**${loc} — ${r.videoCount} new video${r.videoCount !== 1 ? 's' : ''}`)
      }
      lines.push(``)
    }
  }

  if (data.metros.every((m) => m.newRestaurants.length === 0 && m.accoladeChanges.length === 0 && m.buzziest.length === 0)) {
    lines.push(`_No ledger-new facts this week._`)
    lines.push(``)
  }

  lines.push(`---`)
  lines.push(`_This digest contains only objectively new facts (new listings, verified accolade changes, and video activity). Rank changes are never surfaced._`)
  return lines.join('\n')
}

// ─── Type helper for shape inference ─────────────────────────────────────────
function buildDigestShape(d: {
  isoWeek: string; generatedAt: string; windowStart: string; windowEnd: string
  metros: Array<{
    city: string
    newRestaurants: Array<{ id: string; name: string; neighborhood: string | null; accolades: string[]; addedAt: string | null }>
    accoladeChanges: Array<{ id: string; name: string; neighborhood: string | null; accolades: string[] }>
    buzziest: Array<{ id: string; name: string; neighborhood: string | null; videoCount: number }>
  }>
}) { return d }

// ─── Minimal HTML for email ───────────────────────────────────────────────────
function markdownToSimpleHtml(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const html = escaped
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^- \*\*(.+?)\*\*(.*)$/gm, '<li><strong>$1</strong>$2</li>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/\n\n/g, '<br><br>')
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:16px">${html}</body></html>`
}

main().catch((e) => {
  console.error('[weeklyDigest] crashed:', e)
  process.exit(1)
})
