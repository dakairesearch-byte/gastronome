// deproxyGooglePhotos.mjs — replace relative /api/photos/... proxy paths stored in
// restaurants.google_photo_url with durable absolute URLs.
//
// PROBLEM (verified 2026-06-07): 1,997 restaurants store google_photo_url like
//   "/api/photos/<google_photo_name>?maxwidth=1200"
// instead of an absolute URL. A relative path only resolves when rendered same-origin
// inside the Next app; it breaks in <Image> with a remote loader, in emails, in
// share cards, and anywhere the value is treated as a standalone URL. Only 126 rows
// currently hold an absolute http(s) google_photo_url.
//
// FIX STRATEGY (re-fetch/migrate — that is why this is a script, not a SQL UPDATE):
// the relative path embeds the Google Places photo resource name. We re-resolve each
// to a fresh durable media URL via the Google Places (New) media endpoint
// (skipHttpRedirect=true -> returns { photoUri }), the SAME approach used by
// backfillGooglePhotos.mjs. We do NOT simply prepend the site origin, because the
// /api/photos proxy itself round-trips to Google with a short-lived key; persisting an
// absolute Google media URL removes the proxy hop and is stable.
//
// Guarded + reversible:
//   * Only touches rows WHERE google_photo_url LIKE '/api/photos/%'.
//   * Writes a per-row backup (id, old google_photo_url) to
//     reports/remediation-2026-06-07/item3b-deproxy-backup.jsonl BEFORE patching.
//   * Never nulls on a miss (transient Google error leaves the existing value).
//   * Resume-safe via tmp/deproxy_done.json.
//   * --dry prints intended changes without writing.
//
// Usage: node scripts/deproxyGooglePhotos.mjs [--limit=N] [--dry]
//
// NOTE: This re-fetch job (≈1,997 rows × ~150ms) is a migrate job — run it as a
// scheduled/background task per CLAUDE.md scrape-ceiling rules, not inline here.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SKEY = env.SUPABASE_SERVICE_ROLE_KEY, GKEY = env.GOOGLE_PLACES_API_KEY;
if (!SUPA || !SKEY || !GKEY) { console.error('missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GOOGLE_PLACES_API_KEY)'); process.exit(1); }

const DRY = process.argv.includes('--dry');
const LIM = (process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const DONE = path.join(ROOT, 'tmp', 'deproxy_done.json');
const BACKUP_DIR = path.join(ROOT, 'reports', 'remediation-2026-06-07');
const BACKUP = path.join(BACKUP_DIR, 'item3b-deproxy-backup.jsonl');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });
let done = new Set(); try { done = new Set(JSON.parse(fs.readFileSync(DONE, 'utf8'))); } catch { }

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Extract the Google Places photo resource name from a stored proxy path.
// Stored form (observed): "/api/photos/<encoded resource name>?maxwidth=1200".
// The resource name is usually "places/<placeId>/photos/<photoRef>"; the proxy
// stores it url-encoded (or as the bare photoRef for legacy rows). We return
// whatever sits between "/api/photos/" and the query string, decoded once.
function resourceFromProxy(url) {
  const m = url.match(/^\/api\/photos\/([^?]+)/);
  if (!m) return null;
  let raw = m[1];
  try { raw = decodeURIComponent(raw); } catch { /* keep raw */ }
  return raw; // "places/.../photos/..." OR a bare photo reference
}

// Resolve a durable absolute media URL. If we have a full "places/.../photos/..."
// resource name we can hit the media endpoint directly. If we only have a bare
// photoRef and a place id is available, reconstruct the resource name.
async function resolveMediaUrl(resource, googlePlaceId) {
  let name = resource;
  if (!name.startsWith('places/')) {
    if (!googlePlaceId) return null;
    name = `places/${googlePlaceId}/photos/${resource}`;
  }
  const mr = await fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=1200&skipHttpRedirect=true`,
    { headers: { 'X-Goog-Api-Key': GKEY } }
  );
  if (!mr.ok) return null;
  const u = (await mr.json()).photoUri;
  return u || null;
}

async function loadAll() {
  const out = []; let off = 0;
  while (true) {
    const r = await fetch(
      `${SUPA}/rest/v1/restaurants?select=id,name,google_place_id,google_photo_url&google_photo_url=like./api/photos/*&order=id&limit=1000&offset=${off}`
      + (LIM ? `&limit=${Math.min(1000, +LIM)}` : ''),
      { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } }
    );
    const b = await r.json();
    if (!Array.isArray(b)) { log('fetch err', JSON.stringify(b).slice(0, 200)); process.exit(1); }
    if (!b.length) break;
    out.push(...b); off += b.length;
    if (b.length < 1000 || LIM) break;
  }
  return out;
}

async function main() {
  let rows = (await loadAll()).filter(r => !done.has(r.id));
  if (LIM) rows = rows.slice(0, +LIM);
  log(`relative-proxy google_photo_url rows to de-proxy: ${rows.length}${DRY ? ' (DRY)' : ''}`);
  let upd = 0, miss = 0, err = 0, n = 0;
  for (const r of rows) {
    n++;
    try {
      const resource = resourceFromProxy(r.google_photo_url);
      if (!resource) { miss++; continue; }
      const abs = await resolveMediaUrl(resource, r.google_place_id);
      if (!abs) { miss++; await sleep(120); continue; }
      if (DRY) { upd++; log(`  [dry] ${r.name}: ${r.google_photo_url} -> ${abs.slice(0, 70)}...`); await sleep(80); continue; }
      // Backup the old value BEFORE patching (append-only, reversible).
      fs.appendFileSync(BACKUP, JSON.stringify({ id: r.id, old_google_photo_url: r.google_photo_url }) + '\n');
      const up = await fetch(
        `${SUPA}/rest/v1/restaurants?id=eq.${r.id}&google_photo_url=like./api/photos/*`,
        {
          method: 'PATCH',
          headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ google_photo_url: abs })
        }
      );
      if (!up.ok) { err++; log(`  PATCH ${up.status} ${r.name}`, (await up.text()).slice(0, 80)); }
      else { upd++; done.add(r.id); if (upd % 25 === 0) log(`  ...${upd} de-proxied`); }
    } catch (e) { err++; }
    if (n % 25 === 0) fs.writeFileSync(DONE, JSON.stringify([...done]));
    await sleep(120);
  }
  fs.writeFileSync(DONE, JSON.stringify([...done]));
  log(`DONE deproxied=${upd} miss(unresolvable)=${miss} errors=${err} total=${rows.length}`);
  log(`backup: ${BACKUP}`);
}
main();
