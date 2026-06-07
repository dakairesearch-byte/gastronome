// backfillScorelessRatings.mjs — give a real rating to the ~809 OPERATIONAL restaurants that
// currently have NO rating from ANY source (google_rating, yelp_rating, infatuation_rating,
// beli_score all NULL). These rows can't produce a Gastronome Score at all (score.ts returns
// null when zero sources are present), so they're effectively invisible to the product.
//
// Strategy (two passes, both Google Places API New, own key / own data):
//   PASS A — rows WITH a google_place_id (~14): cheap Places Details lookup by id.
//   PASS B — rows WITHOUT a google_place_id (~795): Places Text Search by "name, locality",
//            then match-validate the top candidate by name-token overlap and (when we have
//            coords) proximity, exactly like enrichViaMapsKey.mjs — so we never attach a
//            wrong place. On accept we backfill place_id + rating + review_count (+ coords,
//            price, phone, website, hours when missing) so the row stops being a ghost.
//
// GUARDED: PATCH is conditioned on google_rating still being NULL, so this can never overwrite
// an existing rating. Resume-safe via tmp/scoreless_done.json. Rate-limited ~120ms (Details) /
// ~250ms (Text Search). Dependency-free (Node 20 global fetch).
//
// Usage:
//   node scripts/backfillScorelessRatings.mjs --dry --limit=5     # preview, no writes
//   node scripts/backfillScorelessRatings.mjs --pass=A            # only place_id rows
//   node scripts/backfillScorelessRatings.mjs --pass=B --limit=50 # only no-place_id rows, capped
//   node scripts/backfillScorelessRatings.mjs                     # full run, both passes
//
// THIS IS A >100-ROW SCRAPE. Do not run inline in an agent sandbox (it will exceed the 30-min
// idle ceiling). Run from a real shell or a scheduled job — see the run/cron plan in the
// remediation report.

import fs from 'node:fs';
import path from 'node:path';

// Self-locating ROOT (works regardless of who checked out the repo) — same pattern as
// enrichViaMapsKey.mjs / backfillWebsites.mjs. Reads keys from .env.local.
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const SKEY = env.SUPABASE_SERVICE_ROLE_KEY;
// Server Places key for Details-by-id; MAPS key (+ Referer) for Text Search, mirroring the
// committed scripts. Fall back to whichever is present.
const GKEY = env.GOOGLE_PLACES_API_KEY || env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const MKEY = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || env.GOOGLE_PLACES_API_KEY;
const REFERER = 'http://localhost:3000/';
if (!SUPA || !SKEY || !GKEY) { console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GOOGLE_PLACES_API_KEY)'); process.exit(1); }

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIM = (args.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const PASS = ((args.find(a => a.startsWith('--pass=')) || '').split('=')[1] || 'AB').toUpperCase();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const H = { apikey: SKEY, Authorization: `Bearer ${SKEY}` };
const JH = { ...H, 'Content-Type': 'application/json' };

const DONE = path.join(ROOT, 'tmp', 'scoreless_done.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
let done = new Set(); try { done = new Set(JSON.parse(fs.readFileSync(DONE, 'utf8'))); } catch {}
const persist = () => fs.writeFileSync(DONE, JSON.stringify([...done]));

// ---- match helpers (lifted from enrichViaMapsKey.mjs) ----
const norm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = s => new Set(norm(s).split(' ').filter(w => w.length > 2));
const overlap = (a, b) => { const A = tokens(a), B = tokens(b); if (!A.size) return 0; let n = 0; for (const t of A) if (B.has(t)) n++; return n / A.size; };
const haversine = (la1, lo1, la2, lo2) => { const R = 6371, d = x => x * Math.PI / 180; const dLa = d(la2 - la1), dLo = d(lo2 - lo1); const a = Math.sin(dLa / 2) ** 2 + Math.cos(d(la1)) * Math.cos(d(la2)) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); };
const PRICE = { PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 };

// The "all four sources null" predicate, replicated in PostgREST query syntax.
// google_rating=is.null & yelp_rating=is.null & infatuation_rating=is.null & beli_score=is.null
const SCORELESS = 'google_rating=is.null&yelp_rating=is.null&infatuation_rating=is.null&beli_score=is.null';

// ---- PASS A: rows that DO have a place_id — Details by id ----
async function passA() {
  const url = `${SUPA}/rest/v1/restaurants?select=id,name,google_place_id`
    + `&business_status=eq.OPERATIONAL&${SCORELESS}&google_place_id=not.is.null`
    + (LIM ? `&limit=${LIM}` : '');
  const res = await fetch(url, { headers: H });
  if (!res.ok) { log('PASS A fetch FATAL', res.status, await res.text()); return; }
  let rows = (await res.json()).filter(r => !done.has(r.id));
  log(`PASS A targets (place_id present): ${rows.length}${DRY ? '  (DRY)' : ''}`);
  let updated = 0, norating = 0, errors = 0;
  for (const r of rows) {
    try {
      const pres = await fetch(
        `https://places.googleapis.com/v1/places/${encodeURIComponent(r.google_place_id)}?fields=rating,userRatingCount,businessStatus`,
        { headers: { 'X-Goog-Api-Key': GKEY } });
      if (!pres.ok) { errors++; log(`  ERR ${pres.status} ${r.name}`); await sleep(120); continue; }
      const p = await pres.json();
      if (p.rating == null) { norating++; done.add(r.id); log(`  no-rating ${r.name} (status=${p.businessStatus || '?'})`); await sleep(120); continue; }
      if (DRY) { updated++; log(`  [dry] ${r.name} -> ${p.rating} (${p.userRatingCount} reviews)`); await sleep(120); continue; }
      const patch = await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}&google_rating=is.null`, {
        method: 'PATCH', headers: { ...JH, Prefer: 'return=minimal' },
        body: JSON.stringify({ google_rating: p.rating, google_review_count: p.userRatingCount ?? null, last_fetched_at: new Date().toISOString() })
      });
      if (!patch.ok) { errors++; log(`  PATCH ERR ${patch.status} ${r.name}`, (await patch.text()).slice(0, 120)); }
      else { updated++; done.add(r.id); }
    } catch (e) { errors++; log('  EXC', r.name, String(e).slice(0, 120)); }
    await sleep(120);
  }
  persist();
  log(`PASS A DONE updated=${updated} no_rating=${norating} errors=${errors} total=${rows.length}`);
}

// ---- PASS B: rows with NO place_id — Text Search + match-validate ----
const FM = 'places.id,places.displayName,places.location,places.rating,places.userRatingCount,places.priceLevel,places.websiteUri,places.nationalPhoneNumber,places.regularOpeningHours,places.businessStatus';
async function textSearch(q) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': MKEY, 'X-Goog-FieldMask': FM, 'Referer': REFERER },
    body: JSON.stringify({ textQuery: q, maxResultCount: 3 })
  });
  if (!r.ok) return { err: `${r.status} ${(await r.text()).slice(0, 80)}` };
  return await r.json();
}
async function passB() {
  // page through all no-place_id scoreless operational rows (could be ~800)
  let rows = [], off = 0;
  while (true) {
    const r = await fetch(`${SUPA}/rest/v1/restaurants?select=id,name,address,neighborhood,city,latitude,longitude,website,phone,price_range,hours`
      + `&business_status=eq.OPERATIONAL&${SCORELESS}&google_place_id=is.null&order=created_at.desc&limit=1000&offset=${off}`, { headers: H });
    const b = await r.json(); if (!Array.isArray(b) || !b.length) break; rows.push(...b); off += b.length; if (b.length < 1000) break;
  }
  rows = rows.filter(r => !done.has(r.id)); if (LIM) rows = rows.slice(0, +LIM);
  log(`PASS B targets (no place_id): ${rows.length}${DRY ? '  (DRY)' : ''}`);
  let ok = 0, nomatch = 0, norating = 0, err = 0;
  for (const r of rows) {
    try {
      const q = `${r.name}, ${r.address || [r.neighborhood, r.city].filter(Boolean).join(', ')}`;
      const j = await textSearch(q); await sleep(250);
      if (j.err) { err++; log(`  ERR ${r.name}: ${j.err}`); continue; }
      const cands = j.places || [];
      let best = null, bestScore = -1;
      for (const p of cands) {
        const ov = overlap(r.name, p.displayName?.text || '');
        let prox = 1;
        if (r.latitude && p.location) { const km = haversine(r.latitude, r.longitude, p.location.latitude, p.location.longitude); prox = km <= 1.5 ? 1 : (km <= 5 ? 0.4 : 0); }
        const score = ov * 0.7 + prox * 0.3; if (score > bestScore) { bestScore = score; best = p; }
      }
      const ov = best ? overlap(r.name, best.displayName?.text || '') : 0;
      const km = (best && r.latitude && best.location) ? haversine(r.latitude, r.longitude, best.location.latitude, best.location.longitude) : null;
      // Same acceptance rule as enrichViaMapsKey.mjs — conservative, avoids wrong attaches.
      const accept = best && (ov >= 0.5 || (ov >= 0.34 && km != null && km <= 1.0) || (km != null && km <= 0.15));
      if (!accept) { nomatch++; done.add(r.id); log(`  no-match ${r.name} (top: ${cands[0]?.displayName?.text || '—'} ov=${ov.toFixed(2)} km=${km == null ? '?' : km.toFixed(2)})`); continue; }
      if (best.rating == null) { norating++; done.add(r.id); log(`  matched-but-no-rating ${r.name} -> ${best.displayName?.text}`); continue; }
      // Build patch: always set place_id + rating (+ review_count); fill the rest only when missing.
      const patch = {
        google_place_id: best.id,
        google_rating: best.rating,
        google_review_count: best.userRatingCount ?? null,
        business_status: best.businessStatus || 'OPERATIONAL',
        last_fetched_at: new Date().toISOString(),
      };
      if (best.location && (r.latitude == null || r.longitude == null)) { patch.latitude = best.location.latitude; patch.longitude = best.location.longitude; }
      if (r.price_range == null && best.priceLevel && PRICE[best.priceLevel]) patch.price_range = PRICE[best.priceLevel];
      if ((!r.website || r.website === '') && best.websiteUri) patch.website = best.websiteUri;
      if ((!r.phone || r.phone === '') && best.nationalPhoneNumber) patch.phone = best.nationalPhoneNumber;
      if ((r.hours == null || JSON.stringify(r.hours) === '{}') && best.regularOpeningHours?.weekdayDescriptions)
        patch.hours = Object.fromEntries(best.regularOpeningHours.weekdayDescriptions.map(d => { const i = d.indexOf(':'); return [d.slice(0, i), d.slice(i + 1).trim()]; }));
      if (DRY) { ok++; log(`  [dry] ${r.name} -> ${best.rating}/${best.userRatingCount} pid=${best.id.slice(0, 16)}… ov=${ov.toFixed(2)} km=${km == null ? '?' : km.toFixed(2)}`); continue; }
      // Guard: only write if STILL scoreless on google_rating (idempotent / no overwrite).
      const p = await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}&google_rating=is.null`, {
        method: 'PATCH', headers: { ...JH, Prefer: 'return=minimal' }, body: JSON.stringify(patch)
      });
      if (p.ok) { ok++; done.add(r.id); if (ok % 25 === 0) { log(`  ...${ok} backfilled`); persist(); } }
      else { err++; log(`  patch-err ${r.name} ${p.status}`, (await p.text()).slice(0, 120)); }
    } catch (e) { err++; log(`  EXC ${r.name}`, String(e).slice(0, 80)); }
  }
  persist();
  log(`PASS B DONE backfilled=${ok} no-match=${nomatch} matched_no_rating=${norating} errors=${err} of ${rows.length}`);
}

async function main() {
  log(`scoreless backfill start  pass=${PASS}  ${DRY ? 'DRY' : 'LIVE'}${LIM ? `  limit=${LIM}` : ''}`);
  if (PASS.includes('A')) await passA();
  if (PASS.includes('B')) await passB();
  log('ALL DONE');
}
main();
