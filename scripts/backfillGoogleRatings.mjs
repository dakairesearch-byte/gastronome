// backfillGoogleRatings.mjs
// Fill google_rating + google_review_count for OPERATIONAL restaurants that are
// missing a rating but have a google_place_id, via Google Places Details (New).
// Dependency-free (Node 20 global fetch). Guarded so it can NEVER overwrite an existing rating.
//
// Usage:
//   node scripts/backfillGoogleRatings.mjs --dry --limit=5   # preview, no writes
//   node scripts/backfillGoogleRatings.mjs                   # full run

import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/dn/Documents/Claude/Projects/Food Review App/epicurious';
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SKEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GKEY = env.GOOGLE_PLACES_API_KEY;
if (!SUPA || !SKEY || !GKEY) { console.error('Missing env (SUPA/SKEY/GKEY)'); process.exit(1); }

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIM = (args.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(ts(), ...a);

async function main() {
  const url = `${SUPA}/rest/v1/restaurants?select=id,name,google_place_id`
    + `&business_status=eq.OPERATIONAL&google_rating=is.null&google_place_id=not.is.null`
    + `&order=michelin_stars.desc.nullslast` + (LIM ? `&limit=${LIM}` : '');
  const res = await fetch(url, { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
  if (!res.ok) { log('FATAL target fetch', res.status, await res.text()); process.exit(1); }
  const rows = await res.json();
  log(`targets: ${rows.length}${DRY ? '  (DRY RUN — no writes)' : ''}`);

  let updated = 0, norating = 0, errors = 0;
  for (const r of rows) {
    try {
      const pres = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(r.google_place_id)}?fields=rating,userRatingCount,businessStatus`,
        { headers: { 'X-Goog-Api-Key': GKEY } });
      if (!pres.ok) { errors++; log(`  ERR ${pres.status} ${r.name} pid=${String(r.google_place_id).slice(0, 20)}`); await sleep(120); continue; }
      const p = await pres.json();
      if (p.rating == null) { norating++; log(`  no-rating ${r.name} (status=${p.businessStatus || '?'})`); await sleep(120); continue; }
      if (DRY) { updated++; log(`  [dry] ${r.name} -> ${p.rating} (${p.userRatingCount} reviews) status=${p.businessStatus}`); await sleep(120); continue; }
      const patch = await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}&google_rating=is.null`, {
        method: 'PATCH',
        headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ google_rating: p.rating, google_review_count: p.userRatingCount ?? null, last_fetched_at: new Date().toISOString() })
      });
      if (!patch.ok) { errors++; log(`  PATCH ERR ${patch.status} ${r.name}`, (await patch.text()).slice(0, 120)); }
      else { updated++; if (updated % 25 === 0) log(`  ...${updated} updated`); }
    } catch (e) { errors++; log('  EXC', r.name, String(e).slice(0, 120)); }
    await sleep(120);
  }
  log(`DONE updated=${updated} no_rating=${norating} errors=${errors} total=${rows.length}`);
}
main();
