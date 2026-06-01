// recacheTiktokThumbs.mjs
// For every tiktok video whose thumbnail_url is an expired tiktokcdn URL:
//   oEmbed -> fresh thumb URL -> download bytes -> upload to Supabase Storage
//   (video-thumbnails/tiktok/<video_id>.jpg, upsert) -> PATCH rows to the permanent storage URL.
// oEmbed 400 => video deleted/private => set thumbnail_url NULL (frontend renders gradient).
// Dependency-free (Node 20). Resume-safe via tmp/tiktok_recache_done.json. Idempotent.
//
// Usage:
//   node scripts/recacheTiktokThumbs.mjs --limit=3     # small live test
//   node scripts/recacheTiktokThumbs.mjs               # full run

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
const DONE_FILE = path.join(ROOT, 'tmp', 'tiktok_recache_done.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
let done = new Set();
try { done = new Set(JSON.parse(fs.readFileSync(DONE_FILE, 'utf8'))); } catch { }
const saveDone = () => fs.writeFileSync(DONE_FILE, JSON.stringify([...done]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(ts(), ...a);

async function main() {
  const url = `${SUPA}/rest/v1/restaurant_videos?select=video_id,video_url`
    + `&platform=eq.tiktok&thumbnail_url=like.*tiktokcdn*&video_url=not.is.null`
    + (LIM ? `&limit=${LIM}` : '');
  const res = await fetch(url, { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
  if (!res.ok) { log('FATAL target fetch', res.status, await res.text()); process.exit(1); }
  const rows = await res.json();
  // dedupe by video_id (multiple rows can share a video)
  const byVid = new Map();
  for (const r of rows) if (r.video_id && !byVid.has(r.video_id)) byVid.set(r.video_id, r.video_url);
  const vids = [...byVid.entries()].filter(([v]) => !done.has(v));
  log(`broken rows=${rows.length} distinct video_ids=${byVid.size} remaining=${vids.length}`);

  let recovered = 0, deleted = 0, failed = 0, n = 0;
  for (const [vid, vurl] of vids) {
    n++;
    try {
      const oe = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(vurl)}`, { headers: { 'User-Agent': UA } });
      if (oe.status === 400 || oe.status === 404) {
        // deleted/private -> null the thumb so gallery falls back to gradient
        await patchVid(vid, { thumbnail_url: null, thumbnail_storage_path: null });
        deleted++; done.add(vid); log(`  [del] ${vid} (oembed ${oe.status})`);
      } else if (!oe.ok) {
        failed++; log(`  [fail] ${vid} oembed ${oe.status}`);
      } else {
        const j = await oe.json();
        const thumb = j.thumbnail_url;
        if (!thumb) { failed++; log(`  [fail] ${vid} no thumbnail in oembed`); }
        else {
          const img = await fetch(thumb, { headers: { 'User-Agent': UA } });
          if (!img.ok) { failed++; log(`  [fail] ${vid} thumb download ${img.status}`); }
          else {
            const ct = img.headers.get('content-type') || 'image/jpeg';
            const buf = Buffer.from(await img.arrayBuffer());
            const key = `tiktok/${vid}.jpg`;
            const up = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${key}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${SKEY}`, 'Content-Type': ct, 'x-upsert': 'true' },
              body: buf
            });
            if (!up.ok) { failed++; log(`  [fail] ${vid} storage upload ${up.status}`, (await up.text()).slice(0, 100)); }
            else {
              const publicUrl = `${SUPA}/storage/v1/object/public/${BUCKET}/${key}`;
              await patchVid(vid, { thumbnail_url: publicUrl, thumbnail_storage_path: key });
              recovered++; done.add(vid);
              if (recovered % 25 === 0) log(`  ...${recovered} recovered (${n}/${vids.length})`);
            }
          }
        }
      }
    } catch (e) { failed++; log('  EXC', vid, String(e).slice(0, 120)); }
    if (n % 20 === 0) saveDone();
    await sleep(400);
  }
  saveDone();
  log(`DONE recovered=${recovered} deleted/null=${deleted} failed=${failed} processed=${vids.length}`);
}

async function patchVid(vid, body) {
  const r = await fetch(`${SUPA}/rest/v1/restaurant_videos?video_id=eq.${encodeURIComponent(vid)}&platform=eq.tiktok`, {
    method: 'PATCH',
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(`patch ${r.status} ${(await r.text()).slice(0, 80)}`);
}
main();
