import {useEffect,useRef} from "react";
import {Play,X,Volume2} from "lucide-react";
import {posterUrl,type Episode,type Season} from "@/lib/tmdb";
interface Props {
 episodes:Episode[];seasons:Season[];selectedSeason:number;activeSeason?:number;activeEpisode?:number;loading?:boolean;
 onClose:()=>void;onSeasonChange?:(season:number)=>void;onSelect?:(season:number,episode:number)=>void;onPrepare?:(season:number,episode:number)=>void;
}
export default function EpisodeDrawer({episodes,seasons,selectedSeason,activeSeason,activeEpisode,loading,onClose,onSeasonChange,onSelect,onPrepare}:Props){
 const closeRef=useRef<HTMLButtonElement>(null),rowRef=useRef<HTMLDivElement>(null);
 const intentTimer=useRef<ReturnType<typeof setTimeout>>();
 const prepare=(episode:number)=>{clearTimeout(intentTimer.current);intentTimer.current=setTimeout(()=>onPrepare?.(selectedSeason,episode),450);};
 const cancelPrepare=()=>clearTimeout(intentTimer.current);
 useEffect(()=>()=>clearTimeout(intentTimer.current),[]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;closeRef.current?.focus();return()=>previous?.focus();},[]);
 useEffect(()=>{rowRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView?.({block:"nearest",inline:"center"});},[selectedSeason,activeSeason,activeEpisode,episodes]);
 return <section role="dialog" aria-modal="true" aria-label="Lista de episódios" className="premium-episode-panel absolute inset-0 z-50 text-white flex flex-col" onClick={event=>event.stopPropagation()} onKeyDown={event=>{
  if(event.key==="Escape"){event.stopPropagation();onClose();}
  if(event.key==="Tab"){
   const items=event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),select');const first=items[0],last=items[items.length-1];
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
 }}>
  <button ref={closeRef} type="button" onClick={onClose} aria-label="Fechar episódios" className="absolute right-5 top-5 rounded-full p-2 text-white/70 hover:bg-purple-500/20 hover:text-white"><X/></button>
  <div className="flex items-center gap-5 px-5 md:px-12 pt-16 pb-5">
   <h2 className="rounded-full border border-purple-500/60 bg-purple-500/15 px-5 py-2 text-sm font-semibold">Episódios</h2>
   <label className="flex items-center gap-2 text-sm"><span className="sr-only">Temporada da lista</span><select aria-label="Temporada da lista" value={selectedSeason} onChange={event=>onSeasonChange?.(Number(event.target.value))} className="rounded bg-black border border-purple-500/30 px-3 py-2">
    {seasons.filter(s=>s.season_number>0).map(s=><option key={s.season_number} value={s.season_number}>Temporada {s.season_number}</option>)}
   </select></label>
  </div>
  {loading?<p role="status" className="px-12 py-16 text-white/60">Carregando episódios…</p>:<div ref={rowRef} className="premium-episode-list scrollbar-hide">
   {episodes.map(episode=>{const active=activeSeason===selectedSeason&&activeEpisode===episode.episode_number;return <button key={episode.id} type="button" aria-current={active?"true":undefined} aria-label={`Episódio ${episode.episode_number}: ${episode.name}${active?", reproduzindo":""}`} onClick={()=>onSelect?.(selectedSeason,episode.episode_number)} onMouseEnter={()=>prepare(episode.episode_number)} onMouseLeave={cancelPrepare} onFocus={()=>prepare(episode.episode_number)} onBlur={cancelPrepare} className="premium-episode-item group text-left outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-500">
    <div className={`aspect-video relative overflow-hidden rounded bg-zinc-900 ${active?"ring-2 ring-purple-500":""}`}>
     {episode.still_path&&<img src={posterUrl(episode.still_path,"w500")} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105"/>}
     <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent"/>
     {active?<Volume2 className="absolute left-3 bottom-3 h-5 w-5"/>:<Play className="absolute left-3 bottom-3 h-5 w-5 fill-white"/>}
     {active&&<span className="absolute right-3 bottom-3 text-xs font-semibold">Reproduzindo</span>}
    </div>
    <h3 className="mt-3 text-sm font-bold truncate">{episode.episode_number}. {episode.name}</h3>
    <p className="mt-1 text-xs text-white/65">{episode.runtime?`${episode.runtime} min · `:""}{episode.air_date?.slice(0,4)}</p>
    <p className="mt-1 text-sm leading-5 text-white/65 h-[60px] overflow-hidden">{episode.overview||"Descrição indisponível."}</p>
   </button>})}
   {!episodes.length&&<p className="py-10 text-white/60">Nenhum episódio nesta temporada.</p>}
  </div>}
 </section>;
}
