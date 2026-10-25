export const CONTENT_UNAVAILABLE_MESSAGE = "Indisponivel no momento Aguarde novas Atualizações de Catalogo";
const unavailableCodes = new Set(["tmdb_not_mapped", "series_not_found", "episodes_not_found", "episode_unavailable", "language_unavailable", "item_not_found", "ambiguous_episode", "ambiguous_series", "series_list_required"]);
const temporaryOriginMessage = "O serviço de vídeos está temporariamente indisponível. Tente novamente mais tarde.";
export class PlaybackAPIError extends Error {
  constructor(public code: string, public status: number, message: string) {
    super(code === "catalog_unavailable" ? temporaryOriginMessage : unavailableCodes.has(code) ? CONTENT_UNAVAILABLE_MESSAGE : message);
    this.name = "PlaybackAPIError";
  }
}
export type MovieLanguage = "pt" | "en";
export interface MovieLanguageOption {
  id: MovieLanguage;
  available: boolean;
  label: string;
  version: "dublado" | "legendado";
  audio_language: string;
}
export interface MovieSources {
  tmdb_id: number;
  title: string;
  year: number;
  original_language: string;
  languages: MovieLanguageOption[];
}
const API = import.meta.env.VITE_PLAYBACK_API_URL || (import.meta.env.PROD ? "https://bqkthfboqvlboglodiyz.supabase.co/functions/v1/mox-api" : "/redecanais");
const CATALOG_API = (import.meta.env.VITE_CATALOG_API_URL || API).replace(/\/$/, "");
const prepared = new Map<string,{url:string;expires:number}>();
function preparedURL(key:string) { const item=prepared.get(key);return item&&item.expires>Date.now()?item.url:undefined; }
function remember(key:string,url:string) { if(prepared.size>64)prepared.delete(prepared.keys().next().value!);prepared.set(key,{url,expires:Date.now()+300_000});return url; }
async function request(path: string, signal?: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, {once:true});
  const deadline=setTimeout(abort,150_000);
  const wait=(milliseconds:number)=>new Promise<void>((resolve,reject)=>{
    if(controller.signal.aborted){reject(new DOMException("Aborted","AbortError"));return;}
    const finish=()=>{controller.signal.removeEventListener("abort",cancel);resolve();};
    const timer=setTimeout(finish,milliseconds);
    const cancel=()=>{clearTimeout(timer);reject(new DOMException("Aborted","AbortError"));};
    controller.signal.addEventListener("abort",cancel,{once:true});
  });
  try {
    for(let attempt=0;attempt<3;attempt++){
      let response:Response;
      try {response=await fetch(`${/^\/v1\/tmdb\/movie\/\d+$/.test(path) ? CATALOG_API : API}${path}`,{signal:controller.signal});}
      catch(error){if(signal?.aborted)throw error;throw new Error("Não foi possível conectar ao serviço de vídeos. Verifique sua conexão e tente novamente.");}
      let data;
      try{data=await response.json();}
      catch{throw new Error("O serviço de vídeos está temporariamente indisponível. Tente novamente.");}
      if(response.ok)return data;
      const pending=response.status===503&&data.error?.code==="stream_renewal_pending"&&data.error?.resolution_status!=="session_required";
      if(pending&&attempt<2){
        const seconds=Number(response.headers?.get("Retry-After")||data.error?.retry_after||30);
        await wait(Math.max(2,Math.min(30,Number.isFinite(seconds)?seconds:30))*1000);
        continue;
      }
      throw new PlaybackAPIError(data.error?.code || "unknown_error", response.status, data.error?.message || `Vídeo indisponível (HTTP ${response.status}).`);
    }
  } catch(error) {
    if(controller.signal.aborted&&!signal?.aborted)throw new Error("A origem demorou para liberar o vídeo. Tente novamente.");
    throw error;
  } finally {clearTimeout(deadline);signal?.removeEventListener("abort",abort);}
}

function movieId(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("ID TMDB inválido.");
  return id;
}
export async function fetchMovieSources(id: number, signal?: AbortSignal): Promise<MovieSources> {
  return request(`/v1/tmdb/movie/${movieId(id)}`, signal);
}
export async function resolveMovieStream(id: number, language: MovieLanguage = "pt", signal?: AbortSignal, prepare = false): Promise<string> {
  if (language !== "pt" && language !== "en") throw new Error("Idioma inválido.");
  const key=`movie:${movieId(id)}:${language}`;
  const cached=!prepare&&preparedURL(key);if(cached)return cached;
  const data = await request(`/v1/tmdb/movie/${movieId(id)}/stream?language=${language}${prepare?"&prepare=1":""}`, signal);
  if (data.status !== "ready" || data.delivery_mode !== "session_relay" || !data.stream_preflight_validated || data.tmdb_id !== id || data.language !== language) {
    throw new Error("A API não confirmou a versão solicitada do filme.");
  }
  const url = new URL(data.media_url, window.location.origin);
  if (!/^\/v1\/streams\/[a-f0-9]{32}$/.test(url.pathname) || url.search || url.hash) throw new Error("A API não retornou um endereço de vídeo válido.");
  if(prepare&&!data.startup_cache_ready)throw new Error("A preparação do vídeo ainda não terminou.");
  return prepare?remember(key,`${API}${url.pathname}`):`${API}${url.pathname}`;
}

export interface SeriesMetadata { title: string; original_title?: string; year?: string }
export interface EpisodeSource { season: number | null; episode: number; language: MovieLanguage; page_url: string }
export interface SeriesSources { tmdb_id: number; title: string; episodes: EpisodeSource[]; numbering: string }
function seriesQuery(metadata: SeriesMetadata) {
  return new URLSearchParams({title:metadata.title,original_title:metadata.original_title || "",year:metadata.year || ""});
}
export function fetchSeriesSources(id: number, metadata: SeriesMetadata, signal?: AbortSignal): Promise<SeriesSources> {
  return request(`/v1/tmdb/tv/${movieId(id)}/episodes?${seriesQuery(metadata)}`, signal);
}
export async function resolveEpisodeStream(id: number, season: number, episode: number, language: MovieLanguage,
  metadata: SeriesMetadata, absoluteEpisode?: number, signal?: AbortSignal, prepare = false): Promise<string> {
  if (language !== "pt" && language !== "en") throw new Error("Idioma inválido.");
  if (![season,episode].every(n=>Number.isSafeInteger(n)&&n>0)) throw new Error("Temporada ou episódio inválido.");
  const key=`tv:${movieId(id)}:${season}:${episode}:${language}`;
  const cached=!prepare&&preparedURL(key);if(cached)return cached;
  const query=seriesQuery(metadata);query.set("language",language);
  if(prepare)query.set("prepare","1");
  if (absoluteEpisode !== undefined) query.set("absolute_episode",String(absoluteEpisode));
  const data=await request(`/v1/tmdb/tv/${movieId(id)}/season/${season}/episode/${episode}/stream?${query}`,signal);
  if (data.status!=="ready"||data.delivery_mode!=="session_relay"||!data.stream_preflight_validated||data.tmdb_id!==id||data.season!==season||data.episode!==episode||data.language!==language)
    throw new Error("A API não confirmou o episódio solicitado.");
  const url=new URL(data.media_url,window.location.origin);
  if (!/^\/v1\/streams\/[a-f0-9]{32}$/.test(url.pathname)||url.search||url.hash) throw new Error("A API não retornou um vídeo válido.");
  if(prepare&&!data.startup_cache_ready)throw new Error("A preparação do vídeo ainda não terminou.");
  return prepare?remember(key,`${API}${url.pathname}`):`${API}${url.pathname}`;
}

const preparationRequests=new Map<string,Promise<string>>();
function prepareOnce(key:string,run:()=>Promise<string>,signal?:AbortSignal) {
  if(signal?.aborted)return Promise.reject(new DOMException("Aborted","AbortError"));
  const pending=preparationRequests.get(key);if(pending)return pending;
  if(signal)return run();
  const promise=run().finally(()=>preparationRequests.delete(key));preparationRequests.set(key,promise);return promise;
}
export const prepareMovieStream = (id:number,language:MovieLanguage="pt",signal?:AbortSignal)=>prepareOnce(`movie:${id}:${language}`,()=>resolveMovieStream(id,language,signal,true),signal);
export const prepareEpisodeStream = (id:number,season:number,episode:number,language:MovieLanguage,metadata:SeriesMetadata,absoluteEpisode?:number,signal?:AbortSignal)=>prepareOnce(`tv:${id}:${season}:${episode}:${language}:${absoluteEpisode||0}`,()=>resolveEpisodeStream(id,season,episode,language,metadata,absoluteEpisode,signal,true),signal);

export async function resolveCatalogStream(id: string, signal?: AbortSignal): Promise<string> {
 if(!/^[a-f0-9]{24}$/.test(id))throw new Error(CONTENT_UNAVAILABLE_MESSAGE);
 const data=await request(`/v1/items/${id}/stream`,signal);
 if(data.status!=="ready"||data.delivery_mode!=="session_relay"||!data.stream_preflight_validated)throw new Error(CONTENT_UNAVAILABLE_MESSAGE);
 const url=new URL(data.media_url,window.location.origin);
 if(!/^\/v1\/streams\/[a-f0-9]{32}$/.test(url.pathname)||url.search||url.hash)throw new Error("A API não retornou um vídeo válido.");
 return API+url.pathname;
}
