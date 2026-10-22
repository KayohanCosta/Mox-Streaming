// MOX API: public catalog plus account-owned viewer data. No signed media tokens are persisted.
const REST = `${Deno.env.get('SUPABASE_URL')}/rest/v1`;
const KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS', 'X-Content-Type-Options': 'nosniff' };
const unavailableMessage = 'Indisponivel no momento Aguarde novas Atualizações de Catalogo';
const missingContentCodes = new Set(['tmdb_not_mapped','series_not_found','episodes_not_found','episode_unavailable','language_unavailable','item_not_found']);
class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(missingContentCodes.has(code) ? unavailableMessage : message); } }
function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { ...cors, 'Cache-Control': 'no-store' } }); }
async function rest(table: string, params: Record<string,string> = {}, init: RequestInit = {}, token = KEY) {
  const response = await fetch(`${REST}/${table}?${new URLSearchParams(params)}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation,count=exact', ...init.headers }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new ApiError(response.status === 401 || response.status === 403 ? response.status : 502, 'database_request_failed', 'Não foi possível concluir a consulta.');
  return { data: response.status === 204 ? [] : await response.json(), total: Number(response.headers.get('Content-Range')?.split('/')[1]) || 0 };
}
function positive(value: string | null, fallback: number, max: number) { const n = value === null ? fallback : Number(value); if (!Number.isSafeInteger(n) || n < 1 || n > max) throw new ApiError(400, 'invalid_parameter', 'Parâmetro numérico inválido.'); return n; }
function publicItem(row: Record<string,unknown>) { return { ...row.metadata as object, id: row.id, title: row.title, kind: row.kind, site: row.site, url: row.page_url, playback_validated: false }; }
async function identity(req: Request) {
 const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
 if (!token) throw new ApiError(401,'authentication_required','Entre na sua conta para acessar dados sincronizados.');
 const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, { headers: { apikey: KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
 if (!response.ok) throw new ApiError(401,'invalid_session','A sessão da conta expirou.');
 return { token, user: await response.json() };
}
async function body(req: Request) {
 if (Number(req.headers.get('content-length') || 0) > 16384) throw new ApiError(413,'body_too_large','Requisição excede o limite.');
 const reader=req.body?.getReader(); const chunks:Uint8Array[]=[];let size=0;
 if(!reader) throw new ApiError(400,'invalid_json','Envie um objeto JSON.');
 for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>16384){await reader.cancel();throw new ApiError(413,'body_too_large','Requisição excede o limite.');}chunks.push(part.value);}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 try{const value=JSON.parse(new TextDecoder().decode(bytes));if(!value||Array.isArray(value)||typeof value!=='object')throw Error();return value;}catch{throw new ApiError(400,'invalid_json','Envie um objeto JSON.');}
}
export async function handler(req: Request): Promise<Response> {
 if (req.method === 'OPTIONS') return new Response(null,{status:204,headers:cors});
 try {
  const url=new URL(req.url);const path=url.pathname.replace(/^\/mox-api(?=\/|$)/,'') || '/';
  if([...url.searchParams.keys()].some(key=>url.searchParams.getAll(key).length>1))throw new ApiError(400,'duplicate_parameter','Não repita parâmetros.');
  if(req.method==='GET' && path==='/health') {const count=await rest('mox_catalog',{select:'id',limit:'1'});return json({status:'ok',version:'3.0.0',hosting:'supabase_edge',catalog_items:count.total,capabilities:{catalog:true,movie_mappings:true,account_profiles:true,playback:false},playback_mode:'external_runtime_not_connected'});}
  if(req.method==='GET' && (path==='/'||path==='/docs'))return json({name:'MOX API',routes:['GET /health','GET /v1/catalog?site=vod&page=1&per_page=40','GET /v1/search?q=nome','GET /v1/categories','GET /v1/domains','GET /v1/items/:id','GET /v1/tmdb/movie/:id','GET|POST /v1/profiles','PATCH|DELETE /v1/profiles/:id','GET|POST|DELETE /v1/profiles/:id/progress','GET|POST|DELETE /v1/profiles/:id/favorites'],catalog_scope:'Imported observed catalog; not the entire upstream collection.',playback_status:'Browser-dependent playback remains in the existing runtime; this deployment does not issue validated media links.'});
  if(req.method==='GET' && path==='/v1/domains'){const {data}=await rest('mox_origins',{select:'site,metadata'});return json({sites:Object.fromEntries(data.map((r:Record<string,unknown>)=>[r.site,r.metadata])),source:'imported_registry'});}
  if(req.method==='GET' && ['/v1/catalog','/v1/search','/v1/categories'].includes(path)){
   const params:Record<string,string>={select:'*',order:'title.asc,id.asc'};
   const site=url.searchParams.get('site') || (path==='/v1/catalog'?'vod':'all');
   if(!['all','vod','tv'].includes(site))throw new ApiError(400,'invalid_site','Use vod, tv ou all.');if(site!=='all')params.site=`eq.${site}`;
   const kind=url.searchParams.get('kind')||'all';if(!['all','title','series','episode','channel','catalog'].includes(kind))throw new ApiError(400,'invalid_kind','Tipo inválido.');if(kind!=='all')params.kind=`eq.${kind}`;
   if(path==='/v1/categories')params.page_url='like.*browse-*-videos-1-date.html';
   const q=(url.searchParams.get('q')||'').trim();if(q.length>120)throw new ApiError(400,'invalid_search','Busca muito longa.');if(q)params.title=`ilike.*${q.replace(/[\\%_*]/g,'\\$&')}*`;
   const page=positive(url.searchParams.get('page'),1,100000);const limit=positive(url.searchParams.get('per_page'),40,120);params.offset=String((page-1)*limit);params.limit=String(limit);
   const {data,total}=await rest('mox_catalog',params);return json({items:data.map(publicItem),page,per_page:limit,total,total_pages:Math.ceil(total/limit),complete_catalog:false,scope:'imported_observed_catalog',playback_validated:false});
  }
  const item=path.match(/^\/v1\/items\/([a-f0-9]{24})$/);
  if(req.method==='GET'&&item){const {data}=await rest('mox_catalog',{id:`eq.${item[1]}`,limit:'1'});if(!data.length)throw new ApiError(404,'item_not_found','Título não encontrado.');return json({item:publicItem(data[0])});}
  const movie=path.match(/^\/v1\/tmdb\/movie\/(\d+)$/);
  if(req.method==='GET'&&movie){positive(movie[1],1,2147483647);const {data}=await rest('mox_movie_mappings',{tmdb_id:`eq.${movie[1]}`,limit:'1'});if(!data.length)throw new ApiError(404,'tmdb_not_mapped','Filme ainda sem correspondência confirmada.');const m=data[0].metadata;return json({tmdb_id:Number(movie[1]),title:m.title,year:m.year,original_language:m.original_language,languages:['pt','en'].map(id=>({id,available:!!m.variants?.[id],version:id==='pt'?'dublado':'legendado',audio_language:id==='pt'?'pt':m.original_language,label:id==='pt'?'Português (Dublado)':'Original (Legendado)'}))});}
  if(req.method==='GET'&&(/\/stream$/.test(path)||path.startsWith('/v1/playback')||path.startsWith('/v1/streams/')))throw new ApiError(503,'playback_runtime_not_connected','O catálogo está disponível no Supabase; o serviço de reprodução ainda não foi conectado a esta implantação.');
  const profile=path.match(/^\/v1\/profiles(?:\/([0-9a-f-]{36})(?:\/(progress|favorites))?)?$/);
  if(profile){
   const {token,user}=await identity(req);const id=profile[1];const collection=profile[2];
   if(collection){
    const params:Record<string,string>={profile_id:`eq.${id}`,owner_id:`eq.${user.id}`,limit:'300',order:collection==='progress'?'updated_at.desc':'created_at.desc'};
    const table=collection==='progress'?'mox_profile_progress':'mox_profile_favorites';
    if(req.method==='GET')return json({items:(await rest(table,params,{},token)).data});
    if(req.method==='POST'){const input=await body(req);if(typeof input.media_key!=='string'||input.media_key.length>100||!input.media_key.length||!input.metadata||typeof input.metadata!=='object'||Array.isArray(input.metadata))throw new ApiError(400,'invalid_progress','Dados inválidos.');const record={profile_id:id,owner_id:user.id,media_key:input.media_key,metadata:input.metadata,...(collection==='progress'?{updated_at:new Date().toISOString()}:{})};return json({items:(await rest(table,{on_conflict:'profile_id,media_key'},{method:'POST',body:JSON.stringify(record),headers:{Prefer:'resolution=merge-duplicates,return=representation'}},token)).data});}
    if(req.method==='DELETE'){const key=url.searchParams.get('media_key');if(!key)throw new ApiError(400,'media_key_required','Informe media_key.');params.media_key=`eq.${key}`;delete params.order;delete params.limit;await rest(table,params,{method:'DELETE'},token);return json({deleted:true});}
   }else{
    const params:Record<string,string>={owner_id:`eq.${user.id}`,order:'created_at.asc'};if(id)params.id=`eq.${id}`;
    if(req.method==='GET')return json({items:(await rest('mox_profiles',params,{},token)).data});
    if(req.method==='POST'||req.method==='PATCH'){
     if(req.method==='PATCH'&&!id)throw new ApiError(400,'profile_required','Informe o perfil.');if(req.method==='POST'&&id)throw new ApiError(405,'method_not_allowed','Use a coleção para criar um perfil.');
     const input=await body(req);const name=typeof input.name==='string'?input.name.trim():'';const color=input.color??0;if(!name||name.length>24||!Number.isInteger(color)||color<0||color>4)throw new ApiError(400,'invalid_profile','Nome ou cor inválidos.');
     const record={name,color,...(req.method==='POST'?{owner_id:user.id}:{})};delete params.order;
     return json({items:(await rest('mox_profiles',req.method==='POST'?{}:params,{method:req.method,body:JSON.stringify(record)},token)).data},req.method==='POST'?201:200);
    }
    if(req.method==='DELETE'&&id){delete params.order;await rest('mox_profiles',params,{method:'DELETE'},token);return json({deleted:true});}
   }
   throw new ApiError(405,'method_not_allowed','Método não permitido.');
  }
  throw new ApiError(404,'not_found','Endpoint inexistente. Consulte /docs.');
 }catch(error){if(error instanceof ApiError)return json({error:{code:error.code,message:error.message}},error.status);return json({error:{code:'service_unavailable',message:'Serviço temporariamente indisponível.'}},503);}
}
Deno.serve(handler);
