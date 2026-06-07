// scrapeTiktokEngagement.mjs — refresh TikTok like_count + view_count by parsing the public video
// page JSON (stats.diggCount / playCount). No Apify. Resume-safe. Only writes when stats are found
// (never nulls on a miss, so transient blocks don't destroy data).
//
// Usage: node scripts/scrapeTiktokEngagement.mjs [--limit=N] [--only-zero]
import fs from 'node:fs'; import path from 'node:path';
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SKEY = env.SUPABASE_SERVICE_ROLE_KEY;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const H = { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', 'Accept': 'text/html' };
const args = process.argv.slice(2);
const LIM = (args.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const ONLY_ZERO = args.includes('--only-zero');
const DONE = path.join(ROOT, 'tmp', 'tt_engagement_done.json');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
let done = new Set(); try { done = new Set(JSON.parse(fs.readFileSync(DONE, 'utf8'))); } catch {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ts = () => new Date().toISOString().slice(11, 19);
const log = (...a) => console.log(ts(), ...a);

function extract(html) {
  let m = html.match(/"stats":\{"diggCount":(\d+),"shareCount":(\d+),"commentCount":(\d+),"playCount":(\d+)/);
  if (m) return { like: +m[1], view: +m[4] };
  m = html.match(/"statsV2":\{"diggCount":"(\d+)","shareCount":"(\d+)","commentCount":"(\d+)","playCount":"(\d+)"/);
  if (m) return { like: +m[1], view: +m[4] };
  const d = html.match(/"diggCount":(\d+)/), p = html.match(/"playCount":(\d+)/);
  if (d && p) return { like: +d[1], view: +p[1] };
  return null;
}

async function loadAll() {
  const out = []; let off = 0;
  const zero = ONLY_ZERO ? '&like_count=eq.0' : '';
  while (true) {
    const r = await fetch(`${SUPA}/rest/v1/restaurant_videos?select=id,video_url&platform=eq.tiktok&video_url=not.is.null${zero}&order=id&limit=1000&offset=${off}`,
      { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
    const b = await r.json(); if (!Array.isArray(b) || !b.length) break;
    out.push(...b); off += b.length; if (b.length < 1000) break;
  }
  return out;
}

async function main() {
  let rows = await loadAll();
  rows = rows.filter(r => !done.has(r.id));
  if (LIM) rows = rows.slice(0, +LIM);
  log(`tiktok videos to refresh: ${rows.length}${ONLY_ZERO ? ' (only zero-like)' : ''}`);
  let upd = 0, miss = 0, err = 0, n = 0;
  for (const v of rows) {
    n++;
    try {
      const r = await fetch(v.video_url, { headers: H, redirect: 'follow' });
      if (r.status === 404) { miss++; done.add(v.id); }
      else if (!r.ok) { err++; }
      else {
        const html = await r.text();
        const s = extract(html);
        if (!s) { miss++; }
        else {
          const p = await fetch(`${SUPA}/rest/v1/restaurant_videos?id=eq.${v.id}`, {
            method: 'PATCH', headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify({ like_count: s.like, view_count: s.view, fetched_at: new Date().toISOString() }) });
          if (p.ok) { upd++; done.add(v.id); if (upd % 50 === 0) log(`  ...${upd} updated (${n}/${rows.length})`); }
          else err++;
        }
      }
    } catch (e) { err++; }
    if (n % 40 === 0) fs.writeFileSync(DONE, JSON.stringify([...done]));
    await sleep(700);
  }
  fs.writeFileSync(DONE, JSON.stringify([...done]));
  log(`DONE updated=${upd} miss(no-stats/dead)=${miss} errors=${err} total=${rows.length}`);
}
main();
