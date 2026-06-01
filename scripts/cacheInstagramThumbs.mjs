// cacheInstagramThumbs.mjs
// Durability cache for Instagram thumbnails that depend on the live /media/?size=l redirect.
// One GET sweep per video: 200+image -> upload to Supabase Storage (instagram/<id>.jpg) -> point
// thumbnail_url at the permanent storage URL. 404 / text-html (deleted/private) -> null the thumb
// so the gallery renders its gradient deterministically.
// Dependency-free (Node 20). Resume-safe via tmp/ig_cache_done.json. Idempotent.
//
// Usage:
//   node scripts/cacheInstagramThumbs.mjs --limit=5    # small live test
//   node scripts/cacheInstagramThumbs.mjs              # full run

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
if (!SUPA || !SKEY) { console.error('Missing env'); process.exit(1); }

const BUCKET = 'video-thumbnails';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const args = process.argv.slice(2);
const LIM = (args.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const DONE_FILE = path.join(ROOT, 'tmp', 'ig_cache_done.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
let done = new Set();
try { done = new Set(JSON.parse(fs.readFileSync(DONE_FILE, 'utf8'))); } catch { }
const saveDone = () => fs.writeFileSync(DONE_FILE, JSON.stringify([...done]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(ts(), ...a);

async function main() {
  const url = `${SUPA}/rest/v1/restaurant_videos?select=video_id`
    + `&platform=eq.instagram&thumbnail_url=like.*instagram.com/p/*media*&video_id=not.is.null`
    + (LIM ? `&limit=${LIM}` : '');
  const res = await fetch(url, { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
  if (!res.ok) { log('FATAL target fetch', res.status, await res.text()); process.exit(1); }
  const rows = await res.json();
  const vids = [...new Set(rows.map(r => r.video_id))].filter(v => v && !done.has(v));
  log(`fragile IG rows=${rows.length} distinct=${new Set(rows.map(r => r.video_id)).size} remaining=${vids.length}`);

  let cached = 0, dead = 0, failed = 0, n = 0;
  for (const vid of vids) {
    n++;
    try {
      const r = await fetch(`https://www.instagram.com/p/${vid}/media/?size=l`, { headers: { 'User-Agent': UA }, redirect: 'follow' });
      const ct = r.headers.get('content-type') || '';
      if (r.status === 404) {
        // ONLY a hard 404 means the post is gone. text/html (login wall / rate-limit) is AMBIGUOUS —
        // never null on it, or a throttled batch would destroy thousands of working thumbnails.
        await patchVid(vid, { thumbnail_url: null, thumbnail_storage_path: null });
        dead++; done.add(vid); log(`  [dead-404] ${vid}`);
      } else if (r.ok && ct.startsWith('image/')) {
        const buf = Buffer.from(await r.arrayBuffer());
        const key = `instagram/${vid}.jpg`;
        const up = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${key}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${SKEY}`, 'Content-Type': ct, 'x-upsert': 'true' },
          body: buf
        });
        if (!up.ok) { failed++; log(`  [fail] ${vid} upload ${up.status}`, (await up.text()).slice(0, 100)); }
        else {
          await patchVid(vid, { thumbnail_url: `${SUPA}/storage/v1/object/public/${BUCKET}/${key}`, thumbnail_storage_path: key });
          cached++; done.add(vid);
          if (cached % 50 === 0) log(`  ...${cached} cached (${n}/${vids.length})`);
        }
      } else { failed++; log(`  [skip] ${vid} status=${r.status} ct=${ct.split(';')[0]} (left as-is, not nulled)`); }
    } catch (e) { failed++; log('  EXC', vid, String(e).slice(0, 120)); }
    if (n % 25 === 0) saveDone();
    await sleep(200);
  }
  saveDone();
  log(`DONE cached=${cached} dead/null=${dead} failed=${failed} processed=${vids.length}`);
}

async function patchVid(vid, body) {
  const r = await fetch(`${SUPA}/rest/v1/restaurant_videos?video_id=eq.${encodeURIComponent(vid)}&platform=eq.instagram`, {
    method: 'PATCH',
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`patch ${r.status} ${(await r.text()).slice(0, 80)}`);
}
main();
