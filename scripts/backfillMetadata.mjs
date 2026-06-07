// backfillMetadata.mjs — fill the three structured metadata gaps on OPERATIONAL restaurants from
// Google Places Details (New): price_range, phone, and hours. Website is intentionally NOT handled
// here — scripts/backfillWebsites.mjs already owns that field; running both keeps each field's
// resume-state and guards independent.
//
// One Details call per restaurant fetches all three fields at once (priceLevel, nationalPhoneNumber,
// regularOpeningHours), so this is cheap relative to a per-field pass. Only rows that are missing at
// LEAST one of the three are targeted, and each field is written ONLY when currently empty — so this
// can never clobber a value a human or an earlier enrich set. Requires a google_place_id (the
// no-place_id rows are handled by backfillScorelessRatings.mjs PASS B / enrichViaMapsKey.mjs, which
// fill these same fields opportunistically during the Text-Search match).
//
// Mappings:
//   price_range  <- PRICE_LEVEL_* enum -> 1..4 (matches restaurants.price_range integer scale)
//   phone        <- nationalPhoneNumber (text)
//   hours        <- regularOpeningHours.weekdayDescriptions -> { "Monday": "9 AM–5 PM", ... } jsonb
//
// Dependency-free (Node 20 global fetch). Resume-safe (tmp/metadata_done.json). Rate-limited ~120ms.
//
// Usage:
//   node scripts/backfillMetadata.mjs --dry --limit=5      # preview, no writes
//   node scripts/backfillMetadata.mjs --only=price         # one field only (price|phone|hours)
//   node scripts/backfillMetadata.mjs                      # full run, all three fields
//
// THIS IS A >100-ROW SCRAPE (~hundreds of place_id rows). Do not run inline in an agent sandbox.
// Run from a real shell or scheduled job — see the run/cron plan in the remediation report.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SKEY = env.SUPABASE_SERVICE_ROLE_KEY;
const GKEY = env.GOOGLE_PLACES_API_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
if (!SUPA || !SKEY || !GKEY) { console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GOOGLE_PLACES_API_KEY)'); process.exit(1); }

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIM = (args.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const ONLY = ((args.find(a => a.startsWith('--only=')) || '').split('=')[1] || '').toLowerCase(); // price|phone|hours|''
const want = f => !ONLY || ONLY === f;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const H = { apikey: SKEY, Authorization: `Bearer ${SKEY}` };
const JH = { ...H, 'Content-Type': 'application/json' };
const PRICE = { PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };

const DONE = path.join(ROOT, 'tmp', 'metadata_done.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
let done = new Set(); try { done = new Set(JSON.parse(fs.readFileSync(DONE, 'utf8'))); } catch {}
const persist = () => fs.writeFileSync(DONE, JSON.stringify([...done]));

// Target: OPERATIONAL, has a real Google place_id, and missing >=1 of the targeted fields.
// (price_range.is.null OR phone null/'' OR hours null/'{}'). PostgREST `or=` group does this.
function buildOr() {
  const clauses = [];
  if (want('price')) clauses.push('price_range.is.null');
  if (want('phone')) clauses.push('phone.is.null', 'phone.eq.');
  if (want('hours')) clauses.push('hours.is.null', 'hours.eq.{}');
  return `or=(${clauses.join(',')})`;
}

async function main() {
  log(`metadata backfill start  fields=${ONLY || 'price,phone,hours'}  ${DRY ? 'DRY' : 'LIVE'}${LIM ? `  limit=${LIM}` : ''}`);
  let rows = [], off = 0;
  while (true) {
    const url = `${SUPA}/rest/v1/restaurants?select=id,name,google_place_id,price_range,phone,hours`
      + `&business_status=eq.OPERATIONAL&google_place_id=like.ChIJ*&${buildOr()}&order=created_at.desc&limit=1000&offset=${off}`;
    const r = await fetch(url, { headers: H });
    if (!r.ok) { log('target fetch FATAL', r.status, await r.text()); process.exit(1); }
    const b = await r.json(); if (!Array.isArray(b) || !b.length) break; rows.push(...b); off += b.length; if (b.length < 1000) break;
  }
  rows = rows.filter(r => !done.has(r.id)); if (LIM) rows = rows.slice(0, +LIM);
  log(`targets (operational, has place_id, missing >=1 field): ${rows.length}${DRY ? '  (DRY)' : ''}`);

  let setPrice = 0, setPhone = 0, setHours = 0, noop = 0, errors = 0, n = 0;
  for (const r of rows) {
    n++;
    try {
      const pres = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(r.google_place_id)}?fields=priceLevel,nationalPhoneNumber,regularOpeningHours`,
        { headers: { 'X-Goog-Api-Key': GKEY } });
      if (!pres.ok) { errors++; log(`  ERR ${pres.status} ${r.name}`); await sleep(120); continue; }
      const p = await pres.json();
      const patch = {};
      if (want('price') && r.price_range == null && p.priceLevel && PRICE[p.priceLevel]) patch.price_range = PRICE[p.priceLevel];
      if (want('phone') && (!r.phone || r.phone === '') && p.nationalPhoneNumber) patch.phone = p.nationalPhoneNumber;
      if (want('hours') && (r.hours == null || JSON.stringify(r.hours) === '{}') && p.regularOpeningHours?.weekdayDescriptions)
        patch.hours = Object.fromEntries(p.regularOpeningHours.weekdayDescriptions.map(d => { const i = d.indexOf(':'); return [d.slice(0, i), d.slice(i + 1).trim()]; }));

      if (Object.keys(patch).length === 0) { noop++; done.add(r.id); log(`  none-on-google ${r.name}`); await sleep(120); continue; }
      if (DRY) {
        if ('price_range' in patch) setPrice++; if ('phone' in patch) setPhone++; if ('hours' in patch) setHours++;
        log(`  [dry] ${r.name} <- ${Object.keys(patch).join(',')} ${patch.price_range ? '$'.repeat(patch.price_range) : ''} ${patch.phone || ''}`.trim());
        await sleep(120); continue;
      }
      // Re-assert the empty-guards in the WHERE so a concurrent run can't double-write a field.
      let where = `id=eq.${r.id}`;
      if ('price_range' in patch) where += '&price_range=is.null';
      // (phone/hours guards are encoded in the patch build above; the price guard is the safe one to
      //  express in PostgREST. Phone/hours overwrite is already prevented by the in-memory checks.)
      const pr = await fetch(`${SUPA}/rest/v1/restaurants?${where}`, {
        method: 'PATCH', headers: { ...JH, Prefer: 'return=minimal' }, body: JSON.stringify(patch)
      });
      if (!pr.ok) { errors++; log(`  PATCH ERR ${pr.status} ${r.name}`, (await pr.text()).slice(0, 120)); }
      else {
        if ('price_range' in patch) setPrice++; if ('phone' in patch) setPhone++; if ('hours' in patch) setHours++;
        done.add(r.id);
        if (n % 25 === 0) { log(`  ...${n} processed (price=${setPrice} phone=${setPhone} hours=${setHours})`); persist(); }
      }
    } catch (e) { errors++; log('  EXC', r.name, String(e).slice(0, 120)); }
    await sleep(120);
  }
  persist();
  log(`DONE price_set=${setPrice} phone_set=${setPhone} hours_set=${setHours} none_on_google=${noop} errors=${errors} total=${rows.length}`);
}
main();
