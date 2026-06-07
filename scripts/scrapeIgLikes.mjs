// scrapeIgLikes.mjs — refresh REAL Instagram like_count by reading og:description via the
// facebookexternalhit crawler UA (browser UA returns an empty JS shell). No Apify. Resume-safe.
// Only writes when a real count is parsed (never nulls on a miss).
//
// Usage: node scripts/scrapeIgLikes.mjs [--limit=N]
import fs from 'node:fs'; import path from 'node:path';
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SKEY = env.SUPABASE_SERVICE_ROLE_KEY;
const FB = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const args = process.argv.slice(2);
const LIM = (args.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const DONE = path.join(ROOT, 'tmp', 'ig_likes_done.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
let done = new Set(); try { done = new Set(JSON.parse(fs.readFileSync(DONE, 'utf8'))); } catch {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(ts(), ...a);

const ogOf = h => (h.match(/<meta property="og:description" content="([^"]*)"/) || h.match(/property="og:description"\s+content="([^"]*)"/) || [])[1] || '';
const parse = og => {
  const likes = (og.match(/([\d,]+)\s+likes/i) || [])[1];
  const author = (og.match(/-\s+([A-Za-z0-9_.]+)\s+on\s/) || [])[1] || null;
  return { likes: likes != null ? +likes.replace(/,/g, '') : null, author };
};

async function loadAll() {
  const out = []; let off = 0;
  while (true) {
    const r = await fetch(`${SUPA}/rest/v1/restaurant_videos?select=id,video_id&platform=eq.instagram&video_id=not.is.null&order=id&limit=1000&offset=${off}`,
      { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
    const b = await r.json(); if (!Array.isArray(b) || !b.length) break;
    out.push(...b); off += b.length; if (b.length < 1000) break;
  }
  return out;
}

async function main() {
  let rows = (await loadAll()).filter(r => !done.has(r.id));
  if (LIM) rows = rows.slice(0, +LIM);
  log(`IG videos to refresh: ${rows.length}`);
  let upd = 0, miss = 0, err = 0, n = 0;
  for (const v of rows) {
    n++;
    try {
      const r = await fetch(`https://www.instagram.com/reel/${v.video_id}/`, { headers: { 'User-Agent': FB, 'Accept-Language': 'en-US' }, redirect: 'follow' });
      if (r.status === 404) { miss++; done.add(v.id); }
      else if (!r.ok) { err++; }
      else {
        const { likes } = parse(ogOf(await r.text()));
        if (likes == null) { miss++; }
        else {
          const p = await fetch(`${SUPA}/rest/v1/restaurant_videos?id=eq.${v.id}`, {
            method: 'PATCH', headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ like_count: likes, fetched_at: new Date().toISOString() }) });
          if (p.ok) { upd++; done.add(v.id); if (upd % 50 === 0) log(`  ...${upd} updated (${n}/${rows.length})`); }
          else err++;
        }
      }
    } catch (e) { err++; }
    if (n % 40 === 0) fs.writeFileSync(DONE, JSON.stringify([...done]));
    await sleep(500);
  }
  fs.writeFileSync(DONE, JSON.stringify([...done]));
  log(`DONE updated=${upd} miss=${miss} errors=${err} total=${rows.length}`);
}
main();
