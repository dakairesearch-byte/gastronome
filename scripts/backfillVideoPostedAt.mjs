// backfillVideoPostedAt.mjs — backfill restaurant_videos.posted_at, which is 91.8% NULL
// (10,241 of 11,154 rows as of 2026-06-07). posted_at drives the trending window
// (lib/ranking/trending.ts uses a 30-day recency window), so a null posted_at means a
// video contributes nothing to recency — under-counting fresh social signal.
//
// This mirrors the committed engagement scrapers scrapeTiktokEngagement.mjs and
// scrapeIgLikes.mjs (same UA tricks, same resume-safe + never-null-on-miss discipline)
// but reads the POST TIMESTAMP instead of like/view counts.
//
//   TikTok:    the public video page JSON carries "createTime":"<unix seconds>"
//              (also recoverable from the numeric video_id: bits >> 32 == unix seconds).
//   Instagram: the reel page exposes the timestamp via og/JSON; we read
//              "taken_at_timestamp": <unix seconds> from the embedded JSON, falling
//              back to the <meta property="article:published_time"> when present.
//
// SAFETY / why this is SCRIPTED, not an inline DB op:
//   * ~10k network round-trips at 500-700ms each = hours -> MUST run as a scheduled
//     background job (CLAUDE.md scrape-ceiling rule), never inline in remediation.
//   * NEVER writes a null and NEVER overwrites a non-null posted_at — it only fills
//     genuinely-missing timestamps, so it cannot regress good data.
//   * Sanity clamp: a parsed timestamp in the future or before 2010 is rejected
//     (defensive against the exact future-date corruption fixed in item 5a).
//   * Resume-safe via tmp/posted_at_done.json. --dry prints without writing.
//
// Usage: node scripts/backfillVideoPostedAt.mjs [--limit=N] [--platform=tiktok|instagram] [--dry]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SKEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !SKEY) { console.error('missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'); process.exit(1); }

const TT_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const TT_H = { 'User-Agent': TT_UA, 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html' };
const FB = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIM = (args.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const PLATFORM = (args.find(a => a.startsWith('--platform=')) || '').split('=')[1] || null;
const DONE = path.join(ROOT, 'tmp', 'posted_at_done.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
let done = new Set(); try { done = new Set(JSON.parse(fs.readFileSync(DONE, 'utf8'))); } catch { }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(ts(), ...a);

const MIN_EPOCH = Date.parse('2010-01-01T00:00:00Z') / 1000;
function epochToIso(sec) {
  if (!Number.isFinite(sec)) return null;
  const nowSec = Date.now() / 1000;
  if (sec < MIN_EPOCH || sec > nowSec + 86400) return null; // reject impossible/future
  return new Date(sec * 1000).toISOString();
}

// --- TikTok: createTime from page JSON, with video_id bit-trick fallback ---
function ttCreateTime(html, videoId) {
  let m = html.match(/"createTime":"?(\d{9,11})"?/);
  if (m) { const iso = epochToIso(+m[1]); if (iso) return iso; }
  // Fallback: high 32 bits of a TikTok numeric id encode the unix second.
  try {
    const id = BigInt(videoId);
    const sec = Number(id >> 32n);
    const iso = epochToIso(sec);
    if (iso) return iso;
  } catch { /* non-numeric id */ }
  return null;
}

// --- Instagram: taken_at_timestamp / article:published_time ---
function igTakenAt(html) {
  let m = html.match(/"taken_at_timestamp":(\d{9,11})/);
  if (m) { const iso = epochToIso(+m[1]); if (iso) return iso; }
  m = html.match(/<meta property="article:published_time" content="([^"]+)"/);
  if (m) { const t = Date.parse(m[1]); if (Number.isFinite(t)) return epochToIso(t / 1000); }
  return null;
}

async function loadAll() {
  const out = []; let off = 0;
  const platFilter = PLATFORM ? `&platform=eq.${PLATFORM}` : '';
  while (true) {
    // Only rows missing posted_at; require a usable url/id for the platform.
    const r = await fetch(
      `${SUPA}/rest/v1/restaurant_videos?select=id,platform,video_id,video_url&posted_at=is.null${platFilter}&order=id&limit=1000&offset=${off}`,
      { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } }
    );
    const b = await r.json();
    if (!Array.isArray(b)) { log('fetch err', JSON.stringify(b).slice(0, 200)); process.exit(1); }
    if (!b.length) break;
    out.push(...b); off += b.length; if (b.length < 1000) break;
  }
  return out;
}

async function patchPostedAt(id, iso) {
  // Guard the PATCH itself with posted_at=is.null so we never clobber a value that
  // appeared since load. Never sends null.
  const p = await fetch(`${SUPA}/rest/v1/restaurant_videos?id=eq.${id}&posted_at=is.null`, {
    method: 'PATCH',
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ posted_at: iso })
  });
  return p.ok;
}

async function main() {
  let rows = (await loadAll()).filter(r => !done.has(r.id));
  if (LIM) rows = rows.slice(0, +LIM);
  log(`videos missing posted_at to backfill: ${rows.length}${PLATFORM ? ` (${PLATFORM})` : ''}${DRY ? ' (DRY)' : ''}`);
  let upd = 0, miss = 0, err = 0, n = 0;
  for (const v of rows) {
    n++;
    try {
      let iso = null;
      if (v.platform === 'tiktok' && v.video_url) {
        const r = await fetch(v.video_url, { headers: TT_H, redirect: 'follow' });
        if (r.status === 404) { miss++; done.add(v.id); await sleep(700); continue; }
        if (r.ok) iso = ttCreateTime(await r.text(), v.video_id);
        else { err++; await sleep(700); continue; }
      } else if (v.platform === 'instagram' && v.video_id) {
        const r = await fetch(`https://www.instagram.com/reel/${v.video_id}/`, { headers: { 'User-Agent': FB, 'Accept-Language': 'en-US' }, redirect: 'follow' });
        if (r.status === 404) { miss++; done.add(v.id); await sleep(500); continue; }
        if (r.ok) iso = igTakenAt(await r.text());
        else { err++; await sleep(500); continue; }
      } else { miss++; done.add(v.id); continue; }

      if (!iso) { miss++; await sleep(400); continue; }
      if (DRY) { upd++; log(`  [dry] ${v.platform} ${v.video_id} -> ${iso}`); await sleep(400); continue; }
      if (await patchPostedAt(v.id, iso)) { upd++; done.add(v.id); if (upd % 50 === 0) log(`  ...${upd} filled (${n}/${rows.length})`); }
      else err++;
    } catch (e) { err++; }
    if (n % 40 === 0) fs.writeFileSync(DONE, JSON.stringify([...done]));
    await sleep(v.platform === 'instagram' ? 500 : 700);
  }
  fs.writeFileSync(DONE, JSON.stringify([...done]));
  log(`DONE filled=${upd} miss(no-ts/dead)=${miss} errors=${err} total=${rows.length}`);
}
main();
