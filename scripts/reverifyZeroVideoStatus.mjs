// reverifyZeroVideoStatus.mjs — re-check business_status (via Google Places) for OPERATIONAL
// restaurants that have ZERO videos (the set where stale closures concentrate). Updates status to
// the live value. Does NOT delete. Dependency-free (Node 20).
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
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const VALID = new Set(['OPERATIONAL', 'CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY']);

// operational + zero videos + has place_id
const q = `${SUPA}/rest/v1/restaurants?select=id,name,city,google_place_id&business_status=eq.OPERATIONAL&google_place_id=not.is.null`
  + `&id=not.in.(select restaurant_id from restaurant_videos)`; // not supported by PostgREST; fallback below
let rows;
{
  // PostgREST can't do NOT IN subquery; fetch operational+placeid, then filter by a videos lookup.
  // Paginate: Supabase caps responses at 1000 rows regardless of a larger `limit=` value.
  const all = []; let aOff = 0;
  while (true) {
    const r = await fetch(`${SUPA}/rest/v1/restaurants?select=id,name,city,google_place_id&business_status=eq.OPERATIONAL&google_place_id=not.is.null&order=id&limit=1000&offset=${aOff}`,
      { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
    const b = await r.json();
    if (!Array.isArray(b)) throw new Error(`restaurants page fetch failed (${r.status}): ${JSON.stringify(b)}`);
    if (!b.length) break;
    all.push(...b); aOff += b.length; if (b.length < 1000) break;
  }
  // fetch distinct restaurant_ids that have videos (paginate)
  const haveVid = new Set(); let off = 0;
  while (true) {
    const vr = await fetch(`${SUPA}/rest/v1/restaurant_videos?select=restaurant_id&limit=1000&offset=${off}`, { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
    const b = await vr.json(); b.forEach(x => haveVid.add(x.restaurant_id));
    if (b.length < 1000) break; off += 1000;
  }
  rows = all.filter(x => !haveVid.has(x.id));
}
log(`zero-video operational w/ place_id: ${rows.length}${DRY ? ' (DRY)' : ''}`);
let op = 0, temp = 0, perm = 0, err = 0; const flips = [];
for (const r of rows) {
  try {
    const pr = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(r.google_place_id)}?fields=businessStatus`, { headers: { 'X-Goog-Api-Key': GKEY } });
    if (!pr.ok) { err++; await sleep(110); continue; }
    const bs = (await pr.json()).businessStatus;
    if (!VALID.has(bs)) { err++; await sleep(110); continue; }
    if (bs === 'OPERATIONAL') op++; else { (bs === 'CLOSED_PERMANENTLY' ? perm++ : temp++); flips.push(`${r.name} (${r.city}) -> ${bs}`); }
    if (bs !== 'OPERATIONAL' && !DRY) {
      await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}`, {
        method: 'PATCH', headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ business_status: bs })
      });
    }
  } catch (e) { err++; }
  await sleep(110);
}
log(`DONE still_operational=${op} now_temp=${temp} now_permanent=${perm} errors=${err}`);
flips.forEach(f => log('  ' + f));
