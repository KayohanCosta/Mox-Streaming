import {afterEach, describe, expect, it, vi} from "vitest";
import {resolveMovieStream,resolveEpisodeStream} from "./redecanais";
afterEach(() => {vi.unstubAllGlobals();vi.useRealTimers();});
describe("RedeCanais integration", () => {
 it("waits for a temporary source renewal instead of immediately failing playback",async()=>{
  vi.useFakeTimers();
  const fetcher=vi.fn().mockResolvedValueOnce({ok:false,status:503,json:async()=>({error:{code:"stream_renewal_pending",retry_after:2}})})
   .mockResolvedValueOnce({ok:true,json:async()=>({status:"ready",delivery_mode:"session_relay",stream_preflight_validated:true,tmdb_id:969681,language:"en",media_url:"/v1/streams/"+"c".repeat(32)})});
  vi.stubGlobal("fetch",fetcher);const result=resolveMovieStream(969681,"en");
  await vi.advanceTimersByTimeAsync(2000);
  expect(await result).toBe("/redecanais/v1/streams/"+"c".repeat(32));expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it("preserves season, episode, language and absolute numbering",async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({status:"ready",delivery_mode:"session_relay",stream_preflight_validated:true,tmdb_id:37854,season:2,episode:1,language:"pt",media_url:"/v1/streams/"+"b".repeat(32)})});
  vi.stubGlobal("fetch",fetcher);
  expect(await resolveEpisodeStream(37854,2,1,"pt",{title:"One Piece",year:"1999"},62)).toBe("/redecanais/v1/streams/"+"b".repeat(32));
  const url=new URL(fetcher.mock.calls[0][0],"http://localhost");
  expect(url.pathname).toContain("/season/2/episode/1/stream");expect(url.searchParams.get("absolute_episode")).toBe("62");
 });
 it("rejects a response for a different episode",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({status:"ready",delivery_mode:"session_relay",stream_preflight_validated:true,tmdb_id:84958,season:1,episode:2,language:"pt",media_url:"/v1/streams/"+"b".repeat(32)})}));
  await expect(resolveEpisodeStream(84958,1,1,"pt",{title:"Loki"})).rejects.toThrow("episódio solicitado");
 });
 it("requests the selected TMDB variant and returns a same-origin video URL", async () => {
  const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({status:"ready",delivery_mode:"session_relay",stream_preflight_validated:true,tmdb_id:969681,language:"en",media_url:"http://127.0.0.1:8787/v1/streams/"+"a".repeat(32)})});
  vi.stubGlobal("fetch",fetcher);
  expect(await resolveMovieStream(969681,"en")).toBe("/redecanais/v1/streams/"+"a".repeat(32));
  expect(fetcher.mock.calls[0][0]).toBe("/redecanais/v1/tmdb/movie/969681/stream?language=en");
 });
 it("does not substitute a different movie, variant, or HTML page",async()=>{
  for(const fields of [{tmdb_id:1},{language:"pt"},{media_url:"https://google.com/search?q=x"}]){
   vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:true,json:async()=>({status:"ready",delivery_mode:"session_relay",stream_preflight_validated:true,tmdb_id:969681,language:"en",media_url:"http://127.0.0.1:8787/v1/streams/"+"a".repeat(32),...fields})}));
   await expect(resolveMovieStream(969681,"en")).rejects.toThrow();
  }
 });
 it("reports the origin's missing-language error",async()=>{
  vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({error:{message:"Versão indisponível"}})}));
  await expect(resolveMovieStream(969681,"en")).rejects.toThrow("Versão indisponível");
 });
});
it('coalesces preparation when catalogue intent and the details page request the same movie',async()=>{
 const {prepareMovieStream}=await import('./redecanais');
 const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({status:'ready',delivery_mode:'session_relay',stream_preflight_validated:true,startup_cache_ready:true,tmdb_id:777123,language:'pt',media_url:'/v1/streams/'+'d'.repeat(32)})});vi.stubGlobal('fetch',fetcher);
 const first=prepareMovieStream(777123,'pt');const second=prepareMovieStream(777123,'pt');expect(first).toBe(second);expect(await first).toBe('/redecanais/v1/streams/'+'d'.repeat(32));expect(fetcher).toHaveBeenCalledTimes(1);
});

 it("uses the catalog update message for absent movie, series, episode and language sources",async()=>{
  const {CONTENT_UNAVAILABLE_MESSAGE}=await import('./redecanais');
  for(const code of ['tmdb_not_mapped','series_not_found','episodes_not_found','episode_unavailable','language_unavailable','ambiguous_series']){
   vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:404,json:async()=>({error:{code,message:'Internal source detail'}})}));
   await expect(resolveMovieStream(764951,'pt')).rejects.toThrow(CONTENT_UNAVAILABLE_MESSAGE);
  }
 });
 it("keeps infrastructure failure distinct from missing catalog content",async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({error:{code:'playback_runtime_not_connected',message:'Serviço de reprodução não conectado.'}})}));
  await expect(resolveMovieStream(764952,'pt')).rejects.toThrow('Serviço de reprodução não conectado.');
 });
 it("shows a useful message when the origin catalog cannot be read",async()=>{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503,json:async()=>({error:{code:'catalog_unavailable',message:'A origem não liberou a leitura do catálogo. Tente novamente pelo fluxo normal.'}})}));
  await expect(resolveMovieStream(764953,'pt')).rejects.toThrow('O serviço de vídeos está temporariamente indisponível. Tente novamente mais tarde.');
 });
