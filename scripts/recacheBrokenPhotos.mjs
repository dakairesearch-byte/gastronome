// recacheBrokenPhotos.mjs — fix the 1998 rows whose photo_url=/api/photos/... (dead proxy) by
// downloading the Google photo via the Maps key + Referer and caching to Supabase Storage, then
// pointing photo_url at the permanent Storage URL. Takes effect immediately (no deploy). Resume-safe.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env=Object.fromEntries(fs.readFileSync(path.join(ROOT,'.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const SUPA=env.NEXT_PUBLIC_SUPABASE_URL, SKEY=env.SUPABASE_SERVICE_ROLE_KEY, GKEY=env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const REFERER='http://localhost:3000/', BUCKET='video-thumbnails';
const H={apikey:SKEY,Authorization:`Bearer ${SKEY}`};
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
const DONE=path.join(ROOT,'tmp','recache_done.json'); let done=new Set(); try{done=new Set(JSON.parse(fs.readFileSync(DONE,'utf8')));}catch{}
let rows=[],off=0;
while(true){ const r=await fetch(`${SUPA}/rest/v1/restaurants?select=id,photo_url&photo_url=like.*/api/photos*&order=id&limit=1000&offset=${off}`,{headers:H}); const b=await r.json(); if(!Array.isArray(b)||!b.length)break; rows.push(...b); off+=b.length; if(b.length<1000)break; }
rows=rows.filter(r=>!done.has(r.id));
log(`broken-photo rows to recache: ${rows.length}`);
let ok=0,miss=0,err=0,n=0;
for(const r of rows){ n++;
  try{
    const m=r.photo_url.match(/\/api\/photos\/(places\/[^/?]+\/photos\/[^?]+)/); if(!m){ miss++; done.add(r.id); continue; }
    const photoName=m[1].split('/').map(encodeURIComponent).join('/');
    const img=await fetch(`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${GKEY}`,{headers:{Referer:REFERER},redirect:'follow'});
    if(!img.ok){ miss++; done.add(r.id); await sleep(120); continue; }
    const buf=Buffer.from(await img.arrayBuffer()); const key=`places/${r.id}.jpg`;
    const up=await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${key}`,{method:'POST',headers:{Authorization:`Bearer ${SKEY}`,'Content-Type':img.headers.get('content-type')||'image/jpeg','x-upsert':'true'},body:buf});
    if(!up.ok){ err++; await sleep(120); continue; }
    const pub=`${SUPA}/storage/v1/object/public/${BUCKET}/${key}`;
    const p=await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}`,{method:'PATCH',headers:{...H,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({photo_url:pub})});
    if(p.ok){ ok++; done.add(r.id); if(ok%100===0){fs.writeFileSync(DONE,JSON.stringify([...done])); log(`  ...${ok} recached (${n}/${rows.length})`);} } else err++;
  }catch(e){ err++; }
  await sleep(80);
}
fs.writeFileSync(DONE,JSON.stringify([...done]));
log(`DONE recached=${ok} miss=${miss} err=${err} of ${rows.length}`);
