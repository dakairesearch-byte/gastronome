// backfillNeighborhoods.mjs
// Fill neighborhood for OPERATIONAL restaurants missing it, via Google Places (New) addressComponents.
// Guarded: only writes WHERE neighborhood IS NULL. Leaves NULL where Places has no neighborhood component.
// Dependency-free (Node 20). Resume-safe via tmp/nbhd_done.json.
//
// Usage: node scripts/backfillNeighborhoods.mjs [--dry] [--limit=N]

import fs from 'node:fs';
import path from 'node:path';

const ROOT = '/Users/dn/Documents/Claude/Projects/Food Review App/epicurious';
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SKEY = env.SUPABASE_SERVICE_ROLE_KEY, GKEY = env.GOOGLE_PLACES_API_KEY;
if (!SUPA || !SKEY || !GKEY) { console.error('Missing env'); process.exit(1); }

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const LIM = (args.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const DONE_FILE = path.join(ROOT, 'tmp', 'nbhd_done.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
let done = new Set(); try { done = new Set(JSON.parse(fs.readFileSync(DONE_FILE, 'utf8'))); } catch { }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(ts(), ...a);

const pickNbhd = (comps = []) => {
  const find = t => comps.find(c => (c.types || []).includes(t));
  return (find('neighborhood') || find('sublocality_level_1') || find('sublocality'))?.longText || null;
};

async function main() {
  const url = `${SUPA}/rest/v1/restaurants?select=id,name,google_place_id`
    + `&business_status=eq.OPERATIONAL&neighborhood=is.null&google_place_id=not.is.null` + (LIM ? `&limit=${LIM}` : '');
  const res = await fetch(url, { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
  if (!res.ok) { log('FATAL', res.status, await res.text()); process.exit(1); }
  const rows = (await res.json()).filter(r => !done.has(r.id));
  log(`targets: ${rows.length}${DRY ? ' (DRY)' : ''}`);
  let set = 0, none = 0, err = 0, n = 0;
  for (const r of rows) {
    n++;
    try {
      const pr = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(r.google_place_id)}?fields=addressComponents`, { headers: { 'X-Goog-Api-Key': GKEY } });
      if (!pr.ok) { err++; log(`  ERR ${pr.status} ${r.name}`); await sleep(120); continue; }
      const nb = pickNbhd((await pr.json()).addressComponents);
      if (!nb) { none++; done.add(r.id); }
      else if (DRY) { set++; log(`  [dry] ${r.name} -> ${nb}`); }
      else {
        const p = await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}&neighborhood=is.null`, {
          method: 'PATCH', headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ neighborhood: nb })
        });
        if (!p.ok) { err++; log(`  PATCH ERR ${p.status} ${r.name}`); } else { set++; done.add(r.id); if (set % 25 === 0) log(`  ...${set} set`); }
      }
    } catch (e) { err++; log('  EXC', r.name, String(e).slice(0, 100)); }
    if (n % 25 === 0) fs.writeFileSync(DONE_FILE, JSON.stringify([...done]));
    await sleep(120);
  }
  fs.writeFileSync(DONE_FILE, JSON.stringify([...done]));
  log(`DONE set=${set} no_neighborhood=${none} errors=${err} total=${rows.length}`);
}
main();
