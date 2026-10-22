import { approvedURL, follows, parseCatalog } from './parser.mjs';
const BASE=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type,apikey,authorization'};
async function db(table:string,query:Record<string,string>={},options:RequestInit={}){const r=await fetch(`${BASE}/rest/v1/${table}?${new URLSearchParams(query)}`,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('database_unavailable');return r.status===204?null:await r.json();}
function json(data:unknown,status=200){return Response.json(data,{status,headers:{...cors,'Cache-Control':'no-store'}});}
async function status(){return db('rpc/mox_catalog_sync_status',{}, {method:'POST',body:'{}'});}
async function html(url:string){let current=url;for(let hop=0;hop<4;hop++){const r=await fetch(current,{headers:{'User-Agent':'MOXCatalogSync/1.0','Accept':'text/html'},redirect:'manual',signal:AbortSignal.timeout(18000)});if(r.status>=300&&r.status<400){const next=approvedURL(r.headers.get('location')||'',current);await r.body?.cancel();if(!next)throw Error('redirect_outside_scope');current=next;continue;}if(!r.ok){await r.body?.cancel();throw Error('origin_http_'+r.status);}if(!r.headers.get('content-type')?.includes('text/html')){await r.body?.cancel();throw Error('unexpected_content_type');}const reader=r.body!.getReader();const chunks=[];let size=0;for(;;){const p=await reader.read();if(p.done)break;size+=p.value.length;if(size>2*1024*1024){await reader.cancel();throw Error('page_too_large');}chunks.push(p.value);}const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length;}const text=new TextDecoder().decode(all);if(/<title>\s*(Just a moment|Attention Required)/i.test(text))throw Error('access_verification_required');return {text,url:current};}throw Error('redirect_limit');}
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(req.method==='GET'){try{return json(await status());}catch{return json({error:'status_unavailable'},503);}}
 if(req.method!=='POST')return json({error:'method_not_allowed'},405);
 let lease:string|null=null;let processed=0;
 try{
  lease=await db('rpc/mox_claim_catalog_sync',{}, {method:'POST',body:'{}'});
  if(!lease)return json({state:'idle_or_rate_limited',...(await status())});
  const tasks=await db('mox_catalog_sync_queue',{state:'eq.pending',select:'url,attempts',order:'discovered_at.asc,url.asc',limit:'3'});
  for(const task of tasks){
   try{
    const approved=approvedURL(task.url,'https://redecanais.by/');if(!approved||!follows(approved))throw Error('invalid_scope');
    const page=await html(approved);const parsed=parseCatalog(page.text,page.url);
    if(!parsed.items.length||!/redecanais/i.test(parsed.title))throw Error('catalog_fingerprint_missing');
    const rows=[];const queued=[];
    for(const item of parsed.items){
     if(follows(item.url))queued.push({url:item.url});
     if(!['catalog','series','episode','title'].includes(item.kind))continue;
     if(item.kind!=='catalog'&&!/_[a-f0-9]{8,}\.html$/i.test(new URL(item.url).pathname)&&new URL(item.url).pathname!=='/musicvideo.php')continue;
     const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(item.url));const id=[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,24);
     rows.push({id,title:item.title,kind:item.kind,site:'vod',page_url:item.url,metadata:{image_url:item.image_url,source_page:page.url,is_catalog_card:item.is_catalog_card,provenance:'supabase_http_catalog_sync',observed_at:new Date().toISOString(),playback_validated:false}});
    }
    if(rows.length)await db('mox_catalog',{on_conflict:'id'},{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(rows)});
    if(queued.length)await db('mox_catalog_sync_queue',{on_conflict:'url'},{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify(queued)});
    await db('mox_catalog_sync_queue',{url:`eq.${task.url}`},{method:'PATCH',body:JSON.stringify({state:'done',attempts:task.attempts+1,processed_at:new Date().toISOString(),last_error:null})});processed++;
   }catch(error){const reason=error instanceof Error?error.message:'source_unavailable';await db('mox_catalog_sync_queue',{url:`eq.${task.url}`},{method:'PATCH',body:JSON.stringify({state:'blocked',attempts:task.attempts+1,last_error:reason})});if(/origin_http_(401|403|429)|access_verification|fingerprint/.test(reason)){await db('mox_catalog_sync_state',{id:'eq.true',lease_id:`eq.${lease}`},{method:'PATCH',body:JSON.stringify({active:false,last_error:reason,updated_at:new Date().toISOString()})});break;}}
   await new Promise(r=>setTimeout(r,1100));
  }
  return json({processed,...(await status())});
 }catch{return json({error:'sync_unavailable',processed},503);}
 finally{if(lease)await db('mox_catalog_sync_state',{id:'eq.true',lease_id:`eq.${lease}`},{method:'PATCH',body:JSON.stringify({lease_until:null,updated_at:new Date().toISOString()})}).catch(()=>{});}
});
