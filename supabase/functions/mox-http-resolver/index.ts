import {obtainMedia,reacquireMedia,ResolutionError} from './resolver.mjs';
const BASE=Deno.env.get('SUPABASE_URL')!;
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const headers={apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'};
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,GET,OPTIONS','Access-Control-Allow-Headers':'authorization,apikey,content-type'};
async function db(table:string,params:Record<string,string>={},options:RequestInit={}){const response=await fetch(`${BASE}/rest/v1/${table}?${new URLSearchParams(params)}`,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('database_unavailable');return response.status===204?null:response.json();}
function json(data:unknown,status=200){return Response.json(data,{status,headers:{...cors,'Cache-Control':'no-store'}});}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
 if(request.method==='GET')return json({mode:'http_only_experimental',browser_required_by_implementation:false,browser_sessions_used:false,production_player_connected:false,operations:['resolve','renewal_probe'],renewal_probe_scope:'immediate_reacquisition_not_expiration'});
 if(request.method!=='POST')return json({error:{code:'method_not_allowed'}},405);
 let claimed=false;let sourceId='';let operation='resolve';
 try{
  if(Number(request.headers.get('content-length')||0)>2048)return json({error:{code:'body_too_large'}},413);
  const reader=request.body?.getReader();let raw='';if(reader){const decoder=new TextDecoder();for(;;){const part=await reader.read();if(part.done)break;raw+=decoder.decode(part.value,{stream:true});if(raw.length>2048){await reader.cancel();return json({error:{code:'body_too_large'}},413);}}}
  let input;try{input=JSON.parse(raw);}catch{return json({error:{code:'invalid_json'}},400);}
  if(!input||typeof input!=='object'||Array.isArray(input))return json({error:{code:'invalid_json'}},400);
  operation=input.operation||'resolve';if(!['resolve','renewal_probe'].includes(operation))return json({error:{code:'invalid_operation'}},400);
  let page='';const language=input.language||'pt';if(!['pt','en'].includes(language))return json({error:{code:'invalid_language'}},400);
  if(input.tmdb_id!==undefined){if(!Number.isSafeInteger(input.tmdb_id)||input.tmdb_id<=0)return json({error:{code:'invalid_tmdb_id'}},400);const rows=await db('mox_movie_mappings',{tmdb_id:`eq.${input.tmdb_id}`,limit:'1'});page=rows[0]?.metadata?.variants?.[language]?.page_url||'';sourceId=`movie:${input.tmdb_id}:${language}`;}
  else if(typeof input.item_id==='string'&&/^[a-f0-9]{24}$/.test(input.item_id)){const rows=await db('mox_catalog',{id:`eq.${input.item_id}`,limit:'1'});if(rows[0]&&['title','episode'].includes(rows[0].kind))page=rows[0].page_url;sourceId=input.item_id;}
  else return json({error:{code:'invalid_source',message:'Informe um filme ou episódio já indexado.'}},400);
  if(!page)return json({error:{code:'source_not_mapped',message:'Indisponivel no momento Aguarde novas Atualizações de Catalogo'}},404);
  const parsed=new URL(page);if(parsed.protocol!=='https:'||parsed.origin!=='https://redecanais.by'||parsed.username||parsed.password||parsed.port)throw Error('invalid_registered_source');
  claimed=await db('rpc/mox_claim_http_resolution',{}, {method:'POST',body:'{}'});if(!claimed)return json({error:{code:'resolution_backoff',message:'Aguarde dois minutos antes de executar outro teste.'}},429);
  const result=await (operation==='resolve'?obtainMedia(page):reacquireMedia(page));
  const {media_url:_,...evidence}=result;
  await db('mox_http_resolver_runs',{}, {method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({source_id:sourceId,operation,result:result.status,evidence})});
  return json({...result,mode:'http_only_experimental',source_id:sourceId,browser_sessions_used:false,automatic_renewal:false});
 }catch(error){const code=error instanceof ResolutionError?error.code:'resolver_unavailable';const evidence=error instanceof ResolutionError?error.details:{};
  if(claimed)await db('mox_http_resolver_runs',{}, {method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({source_id:sourceId,operation,result:code,evidence})}).catch(()=>{});
  return json({error:{code,message:error instanceof ResolutionError?error.message:'Não foi possível concluir o teste HTTP.',...evidence},media_url:null,browser_sessions_used:false,obtainment_validated:false,renewal_validated:false,client_playback_validated:false},code==='source_access_refused'||code==='source_access_required'?424:code==='runtime_required'||code==='content_unconfirmed'?409:503);
 }finally{if(claimed)await db('mox_http_resolver_control',{id:'eq.true'},{method:'PATCH',body:JSON.stringify({lease_until:null})}).catch(()=>{});}
});
