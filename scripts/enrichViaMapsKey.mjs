// enrichViaMapsKey.mjs — enrich no-place_id rows via Places API (New) using the referer-restricted
// MAPS key + an allowed Referer header (user-authorized, own key/own data). Fills place_id, rating,
// review_count, coords, website, phone, hours, price, business_status, and a real photo (downloaded
// to Storage so it renders without the dead server-side proxy). Match-validated (name/proximity) to
// avoid wrong matches. Resume-safe (tmp/enrich_done.json). PILOT mode with --limit=N. No Apify.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env=Object.fromEntries(fs.readFileSync(path.join(ROOT,'.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const SUPA=env.NEXT_PUBLIC_SUPABASE_URL, SKEY=env.SUPABASE_SERVICE_ROLE_KEY, GKEY=env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const REFERER='http://localhost:3000/';
const BUCKET='video-thumbnails'; // reuse existing public bucket, places/ prefix
const H={apikey:SKEY,Authorization:`Bearer ${SKEY}`}; const JH={...H,'Content-Type':'application/json'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
const norm=s=>(s||'').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const tokens=s=>new Set(norm(s).split(' ').filter(w=>w.length>2));
const overlap=(a,b)=>{const A=tokens(a),B=tokens(b);if(!A.size)return 0;let n=0;for(const t of A)if(B.has(t))n++;return n/A.size;};
const haversine=(la1,lo1,la2,lo2)=>{const R=6371,d=x=>x*Math.PI/180;const dLa=d(la2-la1),dLo=d(lo2-lo1);const a=Math.sin(dLa/2)**2+Math.cos(d(la1))*Math.cos(d(la2))*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(a));};
const PRICE={PRICE_LEVEL_INEXPENSIVE:1,PRICE_LEVEL_MODERATE:2,PRICE_LEVEL_EXPENSIVE:3,PRICE_LEVEL_VERY_EXPENSIVE:4};
const FM='places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.priceLevel,places.photos,places.websiteUri,places.nationalPhoneNumber,places.regularOpeningHours,places.businessStatus';

async function textSearch(q){
  const r=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':GKEY,'X-Goog-FieldMask':FM,'Referer':REFERER},body:JSON.stringify({textQuery:q,maxResultCount:3})});
  if(!r.ok) return {err:`${r.status} ${(await r.text()).slice(0,80)}`};
  return await r.json();
}
async function savePhoto(photoName, rid){
  try{ const u=`https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=1200&key=${GKEY}`;
    const r=await fetch(u,{headers:{'Referer':REFERER},redirect:'follow'}); if(!r.ok) return null;
    const buf=Buffer.from(await r.arrayBuffer()); const key=`places/${rid}.jpg`;
    const up=await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${key}`,{method:'POST',headers:{Authorization:`Bearer ${SKEY}`,'Content-Type':r.headers.get('content-type')||'image/jpeg','x-upsert':'true'},body:buf});
    if(!up.ok) return null; return `${SUPA}/storage/v1/object/public/${BUCKET}/${key}`;
  }catch{return null;}
}

const LIM=(process.argv.find(a=>a.startsWith('--limit='))||'').split('=')[1];
const DONE=path.join(ROOT,'tmp','enrich_done.json'); let done=new Set(); try{done=new Set(JSON.parse(fs.readFileSync(DONE,'utf8')));}catch{}
let rows=[],off=0;
while(true){ const r=await fetch(`${SUPA}/rest/v1/restaurants?select=id,name,address,neighborhood,city,latitude,longitude,website,phone&google_place_id=is.null&order=created_at.desc&limit=1000&offset=${off}`,{headers:H}); const b=await r.json(); if(!Array.isArray(b)||!b.length)break; rows.push(...b); off+=b.length; if(b.length<1000)break; }
rows=rows.filter(r=>!done.has(r.id)); if(LIM) rows=rows.slice(0,+LIM);
log(`enrich targets: ${rows.length}${LIM?' (PILOT)':''}`);
let ok=0,nomatch=0,err=0;
for(const r of rows){
  try{
    const q=`${r.name}, ${r.address||[r.neighborhood,r.city].filter(Boolean).join(', ')}`;
    const j=await textSearch(q); await sleep(250);
    if(j.err){ err++; log(`  ERR ${r.name}: ${j.err}`); continue; }
    const cands=j.places||[];
    // pick best: name overlap >=0.5 OR within 1.5km of our coords
    let best=null,bestScore=-1;
    for(const p of cands){ const ov=overlap(r.name,p.displayName?.text||''); let prox=1; if(r.latitude&&p.location){const km=haversine(r.latitude,r.longitude,p.location.latitude,p.location.longitude); prox=km<=1.5?1:(km<=5?0.4:0);} const score=ov*0.7+prox*0.3; if(score>bestScore){bestScore=score;best=p;} }
    const ov=best?overlap(r.name,best.displayName?.text||''):0; const km=(best&&r.latitude&&best.location)?haversine(r.latitude,r.longitude,best.location.latitude,best.location.longitude):null;
    const accept = best && ( ov>=0.5 || (ov>=0.34 && km!=null && km<=1.0) || (km!=null && km<=0.15) );
    if(!accept){ nomatch++; done.add(r.id); log(`  no-match ${r.name} (top: ${cands[0]?.displayName?.text||'—'} ov=${ov.toFixed(2)} km=${km==null?'?':km.toFixed(2)})`); continue; }
    const photo = best.photos?.[0]?.name ? await savePhoto(best.photos[0].name, r.id) : null;
    const patch={ google_place_id:best.id, google_rating:best.rating??null, google_review_count:best.userRatingCount??null,
      business_status:best.businessStatus||'OPERATIONAL', last_fetched_at:new Date().toISOString() };
    if(best.location){ patch.latitude=best.location.latitude; patch.longitude=best.location.longitude; }
    if(best.priceLevel&&PRICE[best.priceLevel]) patch.price_range=PRICE[best.priceLevel];
    if(!r.website && best.websiteUri) patch.website=best.websiteUri;
    if(!r.phone && best.nationalPhoneNumber) patch.phone=best.nationalPhoneNumber;
    if(best.regularOpeningHours?.weekdayDescriptions) patch.hours=Object.fromEntries(best.regularOpeningHours.weekdayDescriptions.map(d=>{const i=d.indexOf(':');return [d.slice(0,i),d.slice(i+1).trim()];}));
    if(photo) patch.photo_url=photo;
    const p=await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}`,{method:'PATCH',headers:{...JH,Prefer:'return=minimal'},body:JSON.stringify(patch)});
    if(p.ok){ ok++; done.add(r.id); log(`  ✓ ${r.name} -> rating=${best.rating}/${best.userRatingCount} pid=${best.id.slice(0,16)}… photo=${photo?'Y':'n'} web=${patch.website?'Y':'-'}`); } else { err++; log(`  patch-err ${r.name} ${p.status}`); }
  }catch(e){ err++; log(`  EXC ${r.name}`,String(e).slice(0,60)); }
  if(ok%20===0&&ok) fs.writeFileSync(DONE,JSON.stringify([...done]));
}
fs.writeFileSync(DONE,JSON.stringify([...done]));
log(`DONE enriched=${ok} no-match=${nomatch} errors=${err} of ${rows.length}`);
