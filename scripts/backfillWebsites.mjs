// backfillWebsites.mjs — fill restaurants.website from Google Places websiteUri for OPERATIONAL
// restaurants missing a website (so the menu scraper can reach them). Guarded; resume-safe.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SKEY = env.SUPABASE_SERVICE_ROLE_KEY, GKEY = env.GOOGLE_PLACES_API_KEY;
const DRY = process.argv.includes('--dry');
const LIM = (process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const DONE = path.join(ROOT, 'tmp', 'website_done.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
let done = new Set(); try { done = new Set(JSON.parse(fs.readFileSync(DONE, 'utf8'))); } catch {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const r0 = await fetch(`${SUPA}/rest/v1/restaurants?select=id,name,google_place_id&business_status=eq.OPERATIONAL&google_place_id=like.ChIJ*&or=(website.is.null,website.eq.)`
  + (LIM ? `&limit=${LIM}` : ''), { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
let rows = (await r0.json()).filter(r => !done.has(r.id));
log(`targets: ${rows.length}${DRY ? ' (DRY)' : ''}`);
let set = 0, none = 0, err = 0, n = 0;
for (const r of rows) {
  n++;
  try {
    const pr = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(r.google_place_id)}?fields=websiteUri`, { headers: { 'X-Goog-Api-Key': GKEY } });
    if (!pr.ok) { err++; await sleep(120); continue; }
    const uri = (await pr.json()).websiteUri;
    if (!uri) { none++; done.add(r.id); await sleep(110); continue; }
    if (DRY) { set++; log(`  [dry] ${r.name} -> ${uri}`); }
    else {
      const p = await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}&or=(website.is.null,website.eq.)`, {
        method: 'PATCH', headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ website: uri }) });
      if (!p.ok) { err++; } else { set++; done.add(r.id); if (set % 25 === 0) log(`  ...${set} set`); }
    }
  } catch (e) { err++; }
  if (n % 25 === 0) fs.writeFileSync(DONE, JSON.stringify([...done]));
  await sleep(110);
}
fs.writeFileSync(DONE, JSON.stringify([...done]));
log(`DONE websites_set=${set} no_website_on_google=${none} errors=${err} total=${rows.length}`);
