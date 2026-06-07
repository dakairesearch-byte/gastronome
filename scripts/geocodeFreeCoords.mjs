// geocodeFreeCoords.mjs — fill latitude/longitude WITHOUT Google (server key/project is dead).
// Uses free OSM geocoders: Nominatim (address-first, accurate) then Photon (POI/name fallback).
// Strict sanity: result must land in US bbox AND (for name-based queries) the city must appear in
// the returned label, else we skip (leave NULL rather than write a wrong point). Writes guarded by
// latitude=is.null. Polite: 1.1s between Nominatim calls. No Apify.
import fs from 'node:fs'; import path from 'node:path';
const ROOT = decodeURIComponent(new URL('..', import.meta.url).pathname);
const env=Object.fromEntries(fs.readFileSync(path.join(ROOT,'.env.local'),'utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const SUPA=env.NEXT_PUBLIC_SUPABASE_URL, SKEY=env.SUPABASE_SERVICE_ROLE_KEY;
const H={headers:{apikey:SKEY,Authorization:`Bearer ${SKEY}`}};
const UA='Gastronome/1.0 (restaurant coordinate backfill; admin@gastronome.app)';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const log=(...a)=>console.log(new Date().toISOString().slice(11,19),...a);
const inUS=(la,lo)=>la>=17&&la<=72&&lo>=-180&&lo<=-64;
const norm=s=>(s||'').toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();

async function nominatim(q){
  const r=await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&countrycodes=us&q=${encodeURIComponent(q)}`,{headers:{'User-Agent':UA,'Accept-Language':'en'}});
  if(!r.ok) return null; const j=await r.json(); if(!Array.isArray(j)||!j.length) return null;
  const t=j[0]; return {lat:+t.lat, lng:+t.lon, label:t.display_name||'', addr:t.address||{}};
}
async function photon(q){
  const r=await fetch(`https://photon.komoot.io/api/?limit=1&q=${encodeURIComponent(q)}`,{headers:{'User-Agent':UA}});
  if(!r.ok) return null; const j=await r.json(); const f=j.features?.[0]; if(!f) return null;
  const [lo,la]=f.geometry.coordinates; const p=f.properties||{};
  return {lat:la, lng:lo, label:[p.name,p.city,p.state,p.country].filter(Boolean).join(', '), addr:p};
}

const rows=(await (await fetch(`${SUPA}/rest/v1/restaurants?select=id,name,address,neighborhood,city,state,latitude&latitude=is.null`,H)).json())
  .filter(r=>r.business_status!=='CLOSED_PERMANENTLY');
log(`coords targets (latitude null): ${rows.length}`);
let set=0,skip=0,err=0;
for(const r of rows){
  try{
    const cityTok=norm(r.city), stateTok=norm(r.state);
    let res=null, via='';
    // 1) address-based (trusted): full street address geocodes precisely
    if(r.address&&r.address.trim()){ res=await nominatim(r.address); via='nom/addr'; await sleep(1100); }
    // 2) name + neighborhood + city (POI search)
    if(!res){ const q=[r.name, r.neighborhood, r.city, r.state].filter(Boolean).join(', '); res=await nominatim(q); via='nom/name'; await sleep(1100); }
    if(!res){ const q=[r.name, r.city, r.state].filter(Boolean).join(', '); res=await photon(q); via='photon'; }
    if(!res||!inUS(res.lat,res.lng)){ skip++; log(`  SKIP ${r.name} (no usable hit)`); continue; }
    // sanity for non-address hits: city or state must appear in the returned label/components
    if(via!=='nom/addr'){
      const lbl=norm(res.label)+' '+norm(Object.values(res.addr||{}).join(' '));
      const ok=(cityTok&&lbl.includes(cityTok))||(stateTok&&lbl.includes(stateTok));
      if(!ok){ skip++; log(`  SKIP ${r.name} (${via} label off: "${res.label.slice(0,50)}")`); continue; }
    }
    const p=await fetch(`${SUPA}/rest/v1/restaurants?id=eq.${r.id}&latitude=is.null`,{method:'PATCH',headers:{...H.headers,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify({latitude:res.lat,longitude:res.lng})});
    if(p.ok){ set++; log(`  SET ${r.name} -> ${res.lat.toFixed(5)},${res.lng.toFixed(5)} (${via})`);} else err++;
  }catch(e){ err++; log(`  ERR ${r.name}`,String(e).slice(0,50)); }
}
log(`DONE coords_set=${set} skipped=${skip} errors=${err} total=${rows.length}`);
