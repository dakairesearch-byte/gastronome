// scrapeChipsApify.mjs
// Scrape Google "people often mention" dish chips for ALL operational restaurants via the
// Apify Google Maps actor (compass/crawler-google-places), which returns reviewsTags=[{title,count}].
// Writes fresh rows to restaurant_google_chips (delete-then-insert per restaurant), filtering
// out obvious non-dish/service tags. Dependency-free Node 20.
//
// Usage:
//   node scripts/scrapeChipsApify.mjs --limit=8     # small test
//   node scripts/scrapeChipsApify.mjs               # full run (all operational w/ ChIJ place_id)

import fs from 'node:fs'; import path from 'node:path';
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SKEY = env.SUPABASE_SERVICE_ROLE_KEY, TOKEN = env.APIFY_API_TOKEN;
if (!SUPA || !SKEY || !TOKEN) { console.error('missing env'); process.exit(1); }
const ACTOR = 'compass~crawler-google-places';
const LIM = (process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(ts(), ...a);

// non-dish / service-and-ambiance tags to drop
const STOP = new Set(['wait time','long lines','line','lines','prices','price','service','staff','atmosphere',
  'ambiance','ambience','reservation','reservations','portion','portions','portion size','vibe','vibes','music',
  'decor','parking','bathroom','restroom','customer service','experience','quality','value','location','view',
  'patio','brunch','lunch','dinner','breakfast','happy hour','menu','food','meal','wine list','drinks','cocktails',
  'bar','crowd','date night','birthday','tourists','cash only','take out','takeout','delivery','seating','tables',
  'waiter','waitress','server','hostess','manager','owner','chef','kitchen','prices are reasonable']);
const isDishLike = (t) => { const k = t.toLowerCase().trim(); return k.length >= 2 && k.length <= 40 && !STOP.has(k) && !/^\d+$/.test(k); };

async function supa(method, pathq, body) {
  const r = await fetch(`${SUPA}/rest/v1/${pathq}`, {
    method, headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok && method !== 'GET') throw new Error(`${method} ${pathq} -> ${r.status} ${(await r.text()).slice(0, 120)}`);
  return r;
}

async function loadTargets() {
  const out = []; let off = 0;
  while (true) {
    const r = await fetch(`${SUPA}/rest/v1/restaurants?select=id,google_place_id&business_status=eq.OPERATIONAL&google_place_id=like.ChIJ*&limit=1000&offset=${off}`,
      { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
    const b = await r.json(); out.push(...b);
    if (b.length < 1000) break; off += 1000;
  }
  return out;
}

async function main() {
  let targets = await loadTargets();
  if (LIM) targets = targets.slice(0, +LIM);
  const byPlace = new Map(targets.map(t => [t.google_place_id, t.id]));
  const placeIds = [...byPlace.keys()];
  log(`targets: ${placeIds.length} restaurants (ChIJ place_ids)`);

  // 1) start actor run
  const input = { placeIds, maxReviews: 5, reviewsSort: 'newest', language: 'en', maxImages: 0, maxQuestions: 0, scrapeReviewsPersonalData: false };
  const runRes = await fetch(`https://api.apify.com/v2/acts/${ACTOR}/runs?token=${TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  const run = (await runRes.json()).data;
  log(`started run ${run.id} (status ${run.status})`);

  // 2) poll
  let status = run.status, datasetId = run.defaultDatasetId;
  for (let i = 0; i < 600; i++) { // up to ~100 min
    await sleep(10000);
    const s = await (await fetch(`https://api.apify.com/v2/actor-runs/${run.id}?token=${TOKEN}`)).json();
    status = s.data.status; datasetId = s.data.defaultDatasetId;
    if (i % 6 === 0) log(`  run ${status} ... (${s.data.stats?.itemCount ?? '?'} items)`);
    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) break;
  }
  log(`run finished: ${status}`);
  if (status !== 'SUCCEEDED') log(`WARN non-success; processing whatever landed in dataset`);

  // 3) fetch dataset items (paginate)
  const items = []; let off = 0;
  while (true) {
    const b = await (await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?clean=true&limit=1000&offset=${off}&token=${TOKEN}`)).json();
    if (!Array.isArray(b) || !b.length) break;
    items.push(...b); off += b.length; if (b.length < 1000) break;
  }
  log(`fetched ${items.length} place results`);

  // 4) per restaurant: delete old chips, insert fresh dish chips
  let updated = 0, totalChips = 0, noTags = 0;
  for (const it of items) {
    const pid = it.placeId || it.inputPlaceId;
    const rid = byPlace.get(pid);
    if (!rid) continue;
    const tags = (it.reviewsTags || []).filter(t => t && t.title && isDishLike(t.title));
    if (!tags.length) { noTags++; continue; }
    await supa('DELETE', `restaurant_google_chips?restaurant_id=eq.${rid}`);
    const rows = tags.slice(0, 25).map(t => ({
      restaurant_id: rid, keyword: t.title.toLowerCase().trim(), raw_keyword: t.title,
      google_count: t.count || 0, scraped_at: new Date().toISOString(),
    }));
    await supa('POST', 'restaurant_google_chips', rows);
    updated++; totalChips += rows.length;
    if (updated % 50 === 0) log(`  ...${updated} restaurants, ${totalChips} chips`);
  }
  log(`DONE restaurants_updated=${updated} chips_written=${totalChips} no_dish_tags=${noTags} place_results=${items.length}`);
}
main().catch(e => { console.error('FATAL', e?.message || e); process.exit(1); });
