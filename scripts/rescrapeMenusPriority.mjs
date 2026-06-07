// rescrapeMenusPriority.mjs — build a PRIORITIZED restaurant-id worklist for a menu
// re-scrape, then (optionally) hand it to the existing menu scraper v101.
//
// CONTEXT (verified 2026-06-07): 58% of operational restaurants (1,909 / 3,278) have
// no menu items. The restaurant_menu_fetches audit log shows the dominant failures are
// 'no_content' (49.2%) and 'rejected' (13.7%); only ~17% of fetches end 'ok'. Two
// findings reshape the re-scrape plan (see reports/remediation-2026-06-07/
// item7-menu-scrape-analysis.md):
//   1. EVERY menu fetch ever attempted was on a restaurant that HAS a website
//      (no_website = 0 across all status buckets). The scraper is website-gated.
//   2. 440 operational restaurants that HAVE a website were NEVER attempted, and
//      895 operational no-menu restaurants have NO website at all (out of scope here).
//
// This script does NOT itself scrape (that is a long job -> CLAUDE.md scrape-ceiling
// rule: run via runMenusV101Sharded.sh as a scheduled background job). It:
//   * pulls operational, website-having restaurants with no menu items,
//   * scores them by re-scrape value × tractability,
//   * writes tmp/menu-rescrape-priority-ids.txt (one id per line, scraper-ready), and
//   * with --run, shells out to scrapeMenusV101.ts with that idsFile.
//
// PRIORITY MODEL (higher = scrape first):
//   tier 1  never-attempted + has website .......... brand-new coverage, cheapest win
//   tier 2  latest='rejected'/'rejected_unclear' ... menu WAS found but quality-gate
//                                                     killed it; a v101 re-pass with the
//                                                     newer quality verdict often clears
//   tier 3  latest='no_items'/'no_content' ......... needs a deeper fetch (browser/OCR);
//                                                     lowest yield, do last
//   within a tier, rank by signal that a real menu exists & by audience:
//     + has menu_url on a prior fetch row (a menu page was located before)
//     + review_count / google_review_count (popular places first)
//     + is_featured
//
// Usage:
//   node scripts/rescrapeMenusPriority.mjs            # writes the priority id file (dry)
//   node scripts/rescrapeMenusPriority.mjs --limit=400
//   node scripts/rescrapeMenusPriority.mjs --tier=1   # only never-attempted-with-website
//   node scripts/rescrapeMenusPriority.mjs --run --shardCount=5   # build list AND scrape

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, SKEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !SKEY) { console.error('missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)'); process.exit(1); }

const args = process.argv.slice(2);
const RUN = args.includes('--run');
const LIM = (args.find(a => a.startsWith('--limit=')) || '').split('=')[1];
const ONLY_TIER = (args.find(a => a.startsWith('--tier=')) || '').split('=')[1];
const SHARD_COUNT = (args.find(a => a.startsWith('--shardCount=')) || '').split('=')[1] || '5';
const OUT = path.join(ROOT, 'tmp', 'menu-rescrape-priority-ids.txt');
fs.mkdirSync(path.join(ROOT, 'tmp'), { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// One round-trip: pull the candidate set + the columns the priority model needs via an
// RPC-free SELECT. We compute "no menu items" / "latest fetch status" with a SQL view
// expressed through PostgREST embedded resources is awkward, so we fetch the building
// blocks and join in JS (the candidate set is only a few thousand rows).
async function pageAll(url) {
  const out = []; let off = 0;
  while (true) {
    const r = await fetch(`${url}&order=id&limit=1000&offset=${off}`, { headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` } });
    const b = await r.json();
    if (!Array.isArray(b)) { log('fetch err', JSON.stringify(b).slice(0, 200)); process.exit(1); }
    if (!b.length) break;
    out.push(...b); off += b.length; if (b.length < 1000) break;
  }
  return out;
}

async function main() {
  // 1. operational restaurants WITH a website (the only ones the scraper can act on).
  const rests = await pageAll(
    `${SUPA}/rest/v1/restaurants?select=id,name,is_featured,review_count,google_review_count` +
    `&business_status=eq.OPERATIONAL&website=not.is.null&website=neq.`
  );
  // 2. restaurants that already have >=1 menu item (exclude them).
  const items = await pageAll(`${SUPA}/rest/v1/restaurant_menu_items?select=restaurant_id`);
  const hasItems = new Set(items.map(r => r.restaurant_id));
  // 3. all fetch rows -> latest status + whether a menu_url was ever located.
  const fetches = await pageAll(`${SUPA}/rest/v1/restaurant_menu_fetches?select=restaurant_id,status,menu_url,fetched_at`);
  const latest = new Map(); const everHadMenuUrl = new Set();
  for (const f of fetches) {
    if (f.menu_url) everHadMenuUrl.add(f.restaurant_id);
    const cur = latest.get(f.restaurant_id);
    if (!cur || (f.fetched_at && f.fetched_at > cur.fetched_at)) latest.set(f.restaurant_id, f);
  }

  const REJECTED = new Set(['rejected', 'rejected_unclear']);
  const NEEDS_DEEP = new Set(['no_items', 'no_content']);
  const scored = [];
  for (const r of rests) {
    if (hasItems.has(r.id)) continue;          // already has a menu
    const lf = latest.get(r.id);
    let tier;
    if (!lf) tier = 1;                          // never attempted (has website)
    else if (REJECTED.has(lf.status)) tier = 2; // quality-gate killed a found menu
    else if (NEEDS_DEEP.has(lf.status)) tier = 3;
    else continue;                              // latest='ok' but no items (rare) -> skip
    if (ONLY_TIER && String(tier) !== ONLY_TIER) continue;
    const pop = (r.review_count || 0) + (r.google_review_count || 0);
    const score =
      (4 - tier) * 1_000_000 +                  // tier dominates
      (everHadMenuUrl.has(r.id) ? 200_000 : 0) +
      (r.is_featured ? 100_000 : 0) +
      Math.min(pop, 99_999);                    // popularity tiebreak
    scored.push({ id: r.id, name: r.name, tier, score });
  }
  scored.sort((a, b) => b.score - a.score);
  let list = scored;
  if (LIM) list = list.slice(0, +LIM);

  const byTier = list.reduce((m, x) => (m[x.tier] = (m[x.tier] || 0) + 1, m), {});
  fs.writeFileSync(OUT, list.map(x => x.id).join('\n') + (list.length ? '\n' : ''));
  log(`priority worklist: ${list.length} restaurants`);
  log(`  tier1 never-attempted=${byTier[1] || 0}  tier2 rejected=${byTier[2] || 0}  tier3 deep-fetch=${byTier[3] || 0}`);
  log(`  wrote ${OUT}`);

  if (!RUN) {
    log('dry: not scraping. Re-run with --run, or hand the file to the v101 scraper:');
    log(`  bash scripts/runMenusV101Sharded.sh --shardCount=${SHARD_COUNT} --idsFile=${path.relative(ROOT, OUT)}`);
    return;
  }
  // --run: shell out to the sharded v101 runner (the canonical, watchdog-wrapped path).
  // NOTE: this is a long job; in production launch it as a scheduled background task.
  log(`launching runMenusV101Sharded.sh --shardCount=${SHARD_COUNT} ...`);
  const child = spawn('bash', ['scripts/runMenusV101Sharded.sh', `--shardCount=${SHARD_COUNT}`, `--idsFile=${path.relative(ROOT, OUT)}`],
    { cwd: ROOT, stdio: 'inherit' });
  child.on('exit', code => { log(`v101 runner exited code=${code}`); process.exit(code || 0); });
}
main();
