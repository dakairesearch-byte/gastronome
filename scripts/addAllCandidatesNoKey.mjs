// addAllCandidatesNoKey.mjs — bulk-add the deduped net-new candidates WITHOUT any Google key.
// Per row: skip-if-exists -> geocode (addr=Nominatim else name+nbhd=Photon, METRO-BBOX validated;
// wrong/uncertain => coords NULL, never a bad pin) -> insert (cuisine from candidate) ->
// if creator tiktok: attach video w/ real engagement + cached thumb + cover photo.
// google_place_id stays NULL = "needs Google enrichment". Resume-safe (tmp/bulk_add_done.json).
// Every inserted id appended to tmp/bulk_added.json (rollback list). No Apify, no Google.
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env=Object.fromEntries(fs.readFileSync(path.join(ROOT,'.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const SUPA=env.NEXT_PUBLIC_SUPABASE_URL, SKEY=env.SUPABASE_SERVICE_ROLE_KEY;
const H={apikey:SKEY,Authorization:`Bearer ${SKEY}`}; const JH={...H,'Content-Type':'application/json'};
const BUCKET='video-thumbnails';
const UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const GEO_UA='Gastronome/1.0 (restaurant add; admin@gastronome.app)';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
const norm=s=>(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const NYC=new Set(['new york','brooklyn','queens','bronx','staten island','manhattan']);
const LA=new Set(['los angeles','west hollywood','beverly hills','santa monica','culver city','pasadena','glendale','burbank','hermosa beach','long beach','arcadia','marina del rey','venice','studio city']);
const metroOf=c=>{c=(c||'').toLowerCase().trim(); if(NYC.has(c))return'nyc'; if(LA.has(c))return'la'; return c;};
const BBOX={nyc:[40.45,40.95,-74.30,-73.65], la:[33.6,34.35,-118.75,-117.80], chicago:[41.55,42.10,-88.05,-87.45],
  austin:[30.05,30.60,-98.05,-97.45], miami:[25.55,26.05,-80.50,-80.05], 'miami beach':[25.70,25.95,-80.20,-80.08],
  'san francisco':[37.69,37.84,-122.56,-122.34], oakland:[37.70,37.88,-122.36,-122.10]};
const stateFor=c=>{c=(c||'').toLowerCase(); if(NYC.has(c))return'NY'; if(LA.has(c)||['san francisco','oakland','berkeley','sonoma','healdsburg'].includes(c))return'CA'; if(c==='chicago')return'IL'; if(c==='austin')return'TX'; if(c.startsWith('miami')||['coconut grove','hialeah'].includes(c))return'FL'; return null;};
const extract=html=>{let m=html.match(/"stats":\{"diggCount":(\d+),"shareCount":(\d+),"commentCount":(\d+),"playCount":(\d+)/);if(m)return{like:+m[1],comment:+m[3],view:+m[4]};m=html.match(/"statsV2":\{"diggCount":"(\d+)","shareCount":"(\d+)","commentCount":"(\d+)","playCount":"(\d+)"/);if(m)return{like:+m[1],comment:+m[3],view:+m[4]};return null;};

async function nominatim(q){try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`,{headers:{'User-Agent':GEO_UA}});if(!r.ok)return null;const j=await r.json();return j?.[0]?{lat:+j[0].lat,lng:+j[0].lon}:null;}catch{return null;}}
async function photon(q){try{const r=await fetch(`https://photon.komoot.io/api/?limit=3&q=${encodeURIComponent(q)}`,{headers:{'User-Agent':GEO_UA}});if(!r.ok)return null;const j=await r.json();return (j.features||[]).map(f=>({lat:f.geometry.coordinates[1],lng:f.geometry.coordinates[0]}));}catch{return null;}}
function inBox(loc,metro){const bb=BBOX[metro]; if(!loc)return false; if(!bb)return loc.lat>=17&&loc.lat<=72&&loc.lng>=-180&&loc.lng<=-64; return loc.lat>=bb[0]&&loc.lat<=bb[1]&&loc.lng>=bb[2]&&loc.lng<=bb[3];}
async function geocode(c){const metro=metroOf(c.city);
  if(c.address){ const loc=await nominatim(c.address.includes(',')?c.address:`${c.address}, ${c.city}`); await sleep(1100); if(inBox(loc,metro))return loc; }
  const cands=await photon([c.name,c.neighborhood,c.city,stateFor(c.city)].filter(Boolean).join(', ')); await sleep(400);
  let hit=(cands||[]).find(l=>inBox(l,metro)); if(hit)return hit;
  const nm=await nominatim([c.name,c.city,stateFor(c.city)].filter(Boolean).join(', ')); await sleep(1100);
  if(inBox(nm,metro))return nm; return null;
}
async function cacheThumb(vurl,vid){try{const oe=await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(vurl)}`,{headers:{'User-Agent':UA}});if(!oe.ok)return null;const j=await oe.json();if(!j.thumbnail_url)return null;const img=await fetch(j.thumbnail_url,{headers:{'User-Agent':UA}});if(!img.ok)return null;const buf=Buffer.from(await img.arrayBuffer());const key=`tiktok/${vid}.jpg`;const up=await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${key}`,{method:'POST',headers:{Authorization:`Bearer ${SKEY}`,'Content-Type':img.headers.get('content-type')||'image/jpeg','x-upsert':'true'},body:buf});if(!up.ok)return null;return{url:`${SUPA}/storage/v1/object/public/${BUCKET}/${key}`,key};}catch{return null;}}
async function exists(n,city){const r=await fetch(`${SUPA}/rest/v1/restaurants?select=id&_norm_name=eq.${encodeURIComponent(norm(n))}&city=ilike.${encodeURIComponent(city)}`,{headers:H});const j=await r.json();return Array.isArray(j)&&j.length?j[0].id:null;}

const cands=JSON.parse(fs.readFileSync(path.join(ROOT,'tmp','candidates_netnew.json'),'utf8'));
const DONE=path.join(ROOT,'tmp','bulk_add_done.json'); let done=new Set(); try{done=new Set(JSON.parse(fs.readFileSync(DONE,'utf8')));}catch{}
const ADDED=path.join(ROOT,'tmp','bulk_added.json'); let added=[]; try{added=JSON.parse(fs.readFileSync(ADDED,'utf8'));}catch{}
log(`candidates=${cands.length} already-done=${done.size}`);
let ins=0, dup=0, geo=0, vid=0, err=0, n=0;
for(const c of cands){
  const key=`${norm(c.name)}|${metroOf(c.city)}`; if(done.has(key)){continue;} n++;
  try{
    const dupId=await exists(c.name,c.city); if(dupId){ dup++; done.add(key); continue; }
    const loc=await geocode(c); if(loc) geo++;
    const rid=crypto.randomUUID();
    const row={id:rid,name:c.name,_norm_name:norm(c.name),city:c.city,state:stateFor(c.city),neighborhood:c.neighborhood||null,
      cuisine:c.cuisine||null,address:c.address||null,business_status:'OPERATIONAL',latitude:loc?.lat??null,longitude:loc?.lng??null};
    const r=await fetch(`${SUPA}/rest/v1/restaurants`,{method:'POST',headers:{...JH,Prefer:'return=minimal'},body:JSON.stringify(row)});
    if(!r.ok){ err++; log(`ERR ${c.name}: ${r.status} ${(await r.text()).slice(0,90)}`); continue; }
    ins++; const rec={rid,name:c.name,city:c.city,coords:!!loc,video:false};
    if(c.tiktok){ const vurl=`https://www.tiktok.com/@${c.tiktok.author}/video/${c.tiktok.vid}`;
      let st=null; try{const pg=await fetch(vurl,{headers:{'User-Agent':UA}});if(pg.ok)st=extract(await pg.text());}catch{} await sleep(700);
      const th=await cacheThumb(vurl,c.tiktok.vid);
      await fetch(`${SUPA}/rest/v1/restaurant_videos`,{method:'POST',headers:{...JH,Prefer:'return=minimal'},body:JSON.stringify({restaurant_id:rid,platform:'tiktok',video_id:c.tiktok.vid,video_url:vurl,embed_url:`https://www.tiktok.com/embed/v2/${c.tiktok.vid}`,thumbnail_url:th?.url||null,thumbnail_storage_path:th?.key||null,author_username:c.tiktok.author,like_count:st?.like??null,view_count:st?.view??null,comment_count:st?.comment??null,fetched_at:new Date().toISOString()})});
      if(th?.url){ await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${rid}`,{method:'PATCH',headers:{...JH,Prefer:'return=minimal'},body:JSON.stringify({photo_url:th.url})}); rec.video=true; vid++; }
    }
    added.push(rec); done.add(key);
    if(ins%20===0){ fs.writeFileSync(DONE,JSON.stringify([...done])); fs.writeFileSync(ADDED,JSON.stringify(added,null,1)); log(`  ...${ins} inserted (${n}/${cands.length}) geo=${geo} vid=${vid} dup=${dup}`); }
  }catch(e){ err++; log(`EXC ${c.name}`,String(e).slice(0,80)); }
}
fs.writeFileSync(DONE,JSON.stringify([...done])); fs.writeFileSync(ADDED,JSON.stringify(added,null,1));
log(`DONE inserted=${ins} dup-skipped=${dup} with-coords=${geo} with-video=${vid} errors=${err} | total rollback list=${added.length}`);
