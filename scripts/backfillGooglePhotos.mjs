// backfillGooglePhotos.mjs — fill photo_urls[] (and image_url/google_photo_url if null) for OPERATIONAL
// restaurants with an empty gallery, via Google Places (New) photos + media endpoint.
// Guarded: only writes WHERE photo_urls is null/empty. Dependency-free (Node 20). Resume-safe.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SKEY = env.SUPABASE_SERVICE_ROLE_KEY, GKEY = env.GOOGLE_PLACES_API_KEY;
const DRY = process.argv.includes('--dry');
const LIM = (process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const DONE = path.join(ROOT, 'tmp', 'photos_done.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
let done = new Set(); try { done = new Set(JSON.parse(fs.readFileSync(DONE, 'utf8'))); } catch { }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const r0 = await fetch(`${SUPA}/rest/v1/restaurants?select=id,name,image_url,google_place_id&business_status=eq.OPERATIONAL&google_place_id=not.is.null&or=(photo_urls.is.null,photo_urls.eq.{})`
  + (LIM ? `&limit=${LIM}` : ''), { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
let rows = await r0.json();
if (!Array.isArray(rows)) { log('fetch err', JSON.stringify(rows).slice(0, 200)); process.exit(1); }
rows = rows.filter(r => !done.has(r.id));
log(`targets: ${rows.length}${DRY ? ' (DRY)' : ''}`);
let set = 0, none = 0, err = 0, n = 0;
for (const r of rows) {
  n++;
  try {
    const pr = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(r.google_place_id)}?fields=photos`, { headers: { 'X-Goog-Api-Key': GKEY } });
    if (!pr.ok) { err++; await sleep(120); continue; }
    const photos = ((await pr.json()).photos || []).slice(0, 6);
    if (!photos.length) { none++; done.add(r.id); await sleep(120); continue; }
    const uris = [];
    for (const p of photos) {
      const mr = await fetch(`https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1200&skipHttpRedirect=true`, { headers: { 'X-Goog-Api-Key': GKEY } });
      if (mr.ok) { const u = (await mr.json()).photoUri; if (u) uris.push(u); }
      await sleep(80);
    }
    if (!uris.length) { none++; done.add(r.id); await sleep(60); continue; }
    if (DRY) { set++; log(`  [dry] ${r.name} -> ${uris.length} photos`); }
    else {
      const body = { photo_urls: uris, google_photo_url: uris[0] };
      if (!r.image_url) body.image_url = uris[0];
      const up = await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}&or=(photo_urls.is.null,photo_urls.eq.{})`, {
        method: 'PATCH', headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify(body)
      });
      if (!up.ok) { err++; log(`  PATCH ${up.status} ${r.name}`, (await up.text()).slice(0, 80)); } else { set++; done.add(r.id); if (set % 25 === 0) log(`  ...${set} set`); }
    }
  } catch (e) { err++; }
  if (n % 25 === 0) fs.writeFileSync(DONE, JSON.stringify([...done]));
  await sleep(60);
}
fs.writeFileSync(DONE, JSON.stringify([...done]));
log(`DONE galleries_set=${set} no_photos=${none} errors=${err} total=${rows.length}`);
