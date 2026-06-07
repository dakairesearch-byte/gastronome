// backfillCoords.mjs — fill latitude/longitude from Google Places (New) location for OPERATIONAL
// restaurants missing coords but holding a place_id. Guarded; only fills NULLs. No Apify.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SKEY = env.SUPABASE_SERVICE_ROLE_KEY, GKEY = env.GOOGLE_PLACES_API_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const rows = await (await fetch(`${SUPA}/rest/v1/restaurants?select=id,name,google_place_id&business_status=eq.OPERATIONAL&latitude=is.null&google_place_id=not.is.null`,
  { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } })).json();
log(`coords targets: ${rows.length}`);
let set = 0, err = 0;
for (const r of rows) {
  try {
    const pr = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(r.google_place_id)}?fields=location`, { headers: { 'X-Goog-Api-Key': GKEY } });
    if (!pr.ok) { err++; await sleep(120); continue; }
    const loc = (await pr.json()).location;
    if (!loc || loc.latitude == null) { err++; await sleep(110); continue; }
    const p = await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}&latitude=is.null`, {
      method: 'PATCH', headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ latitude: loc.latitude, longitude: loc.longitude }) });
    if (p.ok) { set++; } else err++;
  } catch (e) { err++; }
  await sleep(110);
}
log(`DONE coords_set=${set} errors=${err} total=${rows.length}`);
