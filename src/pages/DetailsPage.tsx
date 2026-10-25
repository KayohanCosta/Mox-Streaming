import { useState, useEffect, useCallback, useRef } from "react";
import { Link,useParams,useSearchParams } from "react-router-dom";
import { fetchDetails, fetchSeasonEpisodes, fetchVideos, fetchSimilar, fetchCertification, MediaDetails, MediaItem, Episode, VideoResult, getTitle, getYear, getRating, backdropUrl, posterUrl } from "@/lib/tmdb";
import { completeEpisodeList } from "@/lib/episode-list";
import TrailerDialog from "@/components/TrailerDialog";
import PageSkeleton from "@/components/PageSkeleton";
import SaveTitleButton from "@/components/SaveTitleButton";
import ContentRow from "@/components/ContentRow";
import SiteFooter from "@/components/SiteFooter";
import Navbar from "@/components/Navbar";
import { Star, Clock, Calendar, Play, X, Youtube, ChevronDown, Loader2 } from "lucide-react";
import IPTVPlayer from "@/components/IPTVPlayer";
import { saveWatchProgress, getWatchProgress, removeWatchProgress, useWatchProgress } from "@/hooks/useWatchProgress";
import { CONTENT_UNAVAILABLE_MESSAGE, fetchMovieSources, resolveMovieStream, fetchSeriesSources, resolveEpisodeStream, prepareEpisodeStream, prepareMovieStream, type SeriesSources, type MovieLanguage, type MovieLanguageOption } from "@/lib/redecanais";
import { refreshTitleAvailability, useTitleAvailability } from "@/lib/titleAvailability";

type PlayerSource = "iptv-1" | "iptv-2" | "iptv-3";
type PlayerTab = "iptv-1" | "iptv-2" | "iptv-3";

interface PlayerState {
  open: boolean;
  tab: PlayerTab;
  source: PlayerSource;
  seasonNum?: number;
  episodeNum?: number;
  initialTime?: number;
  language?: MovieLanguage;
}

const localAddonTest = import.meta.env.DEV && import.meta.env.VITE_ADDON_LOCAL_TEST === "1";

export default function DetailsPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const availability=useTitleAvailability(type,Number(id),Boolean(type&&id));
  const [localAddonMovie,setLocalAddonMovie] = useState(false);
  const [localAddonTV,setLocalAddonTV] = useState(false);
  const [localProbeResolvedKey,setLocalProbeResolvedKey] = useState<string|null>(null);
  const [seriesLookupResolvedKey,setSeriesLookupResolvedKey] = useState<string|null>(null);
  const [searchParams]=useSearchParams();
  const resumeRequest=useRef("");
  const [detailTab,setDetailTab]=useState<"episodes"|"about"|"similar">("episodes");
  const [details, setDetails] = useState<MediaDetails | null>(null);
  useEffect(()=>{if(details?.id===Number(id))document.title=`${getTitle(details)} | MOX`;},[details,id]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailsError,setDetailsError]=useState(false);
  const [detailsAttempt,setDetailsAttempt]=useState(0);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const closeTrailer=useCallback(()=>setShowTrailer(false),[]);
  const [similar, setSimilar] = useState<MediaItem[]>([]);
  const [certification, setCertification] = useState("L");
  const [player, setPlayer] = useState<PlayerState>({ open: false, tab: "iptv-1", source: "iptv-1" });
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);
  const { items: progressItems } = useWatchProgress();
  const [seriesSources, setSeriesSources] = useState<SeriesSources | null>(null);
  const [seriesLookupError,setSeriesLookupError] = useState<string|null>(null);
  const [sourceRetry,setSourceRetry] = useState(0);
  const [episodeListLoading,setEpisodeListLoading]=useState(false);
  const seasonRequests=useRef(new Map<string,Promise<Episode[]>>());
  const seasonListRequest=useRef(0);
  const warmRequests=useRef(new Map<string,{promise:Promise<boolean>;expires:number}>());
  const [nextState,setNextState]=useState<{from:string;season:number;episode:number;name:string;list:Episode[]}|null>(null);
  const [nextPreparing,setNextPreparing]=useState(false);
  const [startedKey,setStartedKey]=useState("");
  const playerKey=`${type}-${id}-${player.seasonNum||0}-${player.episodeNum||0}`;
  const nextEpisode=nextState?.from===playerKey?nextState:undefined;
  const seasonMetadataRef=useRef({sources:seriesSources?.episodes,seasonCount:0});
  seasonMetadataRef.current={sources:seriesSources?.episodes,seasonCount:(details?.seasons||[]).filter(s=>s.season_number>0).length};
  const loadSeason=useCallback((season:number)=>{
    const supplement=(list:Episode[])=>completeEpisodeList(list,seasonMetadataRef.current.sources,season,seasonMetadataRef.current.seasonCount);
    const key=`${id}:${season}`;const old=seasonRequests.current.get(key);if(old)return old.then(supplement);
    const promise=fetchSeasonEpisodes(Number(id),season).catch(error=>{seasonRequests.current.delete(key);throw error;});
    if(seasonRequests.current.size>=64)seasonRequests.current.delete(seasonRequests.current.keys().next().value!);
    seasonRequests.current.set(key,promise);return promise.then(supplement);
  },[id]);
  const loadSeasonIntoList=useCallback(async(season:number)=>{
    const request=++seasonListRequest.current;setEpisodeListLoading(true);
    try{const list=await loadSeason(season);if(request===seasonListRequest.current)setEpisodes(list);}
    catch{if(request===seasonListRequest.current)setEpisodes([]);}
    finally{if(request===seasonListRequest.current)setEpisodeListLoading(false);}
  },[loadSeason]);
  useEffect(()=>{if(seriesSources&&type==="tv")void loadSeasonIntoList(selectedSeason);},[seriesSources,type,selectedSeason,loadSeasonIntoList]);
  const transitionRef = useRef(0);
  const playbackLanguageRef = useRef<MovieLanguage>("pt");
  const savedProgress = progressItems.find(x => x.id === Number(id) && x.type === type);
  const [audioOptions, setAudioOptions] = useState<MovieLanguageOption[] | undefined>();

  useEffect(() => {
    setLocalAddonMovie(false);
    if (!localAddonTest || type !== "movie" || !id) return;
    const controller = new AbortController();
    void fetch(`/addon-local/catalog/movie/${id}`, {signal:controller.signal})
      .then(response=>response.ok?response.json():null)
      .then(data=>{
        if(controller.signal.aborted||!data?.available)return;
        setLocalAddonMovie(true);
        void fetch(`/addon-local/resolve/movie/${id}`, {signal:controller.signal}).catch(()=>{});
      }).catch(()=>{}).finally(()=>{if(!controller.signal.aborted)setLocalProbeResolvedKey(`${type}:${id}`);});
    return () => controller.abort();
  }, [id,type]);

  useEffect(() => {
    setLocalAddonTV(false);
    if (!localAddonTest || type !== "tv" || !id || !details || details.id !== Number(id)) return;
    const controller = new AbortController();
    const params=new URLSearchParams({title:getTitle(details),original_title:details.original_name||"",year:getYear(details)});
    void fetch(`/addon-local/catalog/tv/${id}?${params}`, {signal:controller.signal})
      .then(response=>response.ok?response.json():null)
      .then(data=>{if(!controller.signal.aborted&&data?.available)setLocalAddonTV(true);})
      .catch(()=>{})
      .finally(()=>{if(!controller.signal.aborted)setLocalProbeResolvedKey(`${type}:${id}`);});
    return () => controller.abort();
  }, [id,type,details,sourceRetry]);

  useEffect(() => {
    setAudioOptions(undefined);
    if (type !== "movie" || !id) return;
    if (localAddonMovie) {
      setAudioOptions([{id:"pt",available:true,label:"Português (Dublado)",version:"dublado",audio_language:"pt"}]);
      return;
    }
    const controller = new AbortController();
    fetchMovieSources(Number(id), controller.signal)
      .then((data) => { if (!controller.signal.aborted) setAudioOptions(data.languages); })
      .catch(() => { /* Playback reports the precise source error on demand. */ });
    return () => controller.abort();
  }, [id, type, localAddonMovie]);

  useEffect(() => {
    if (!id || !type) return;
    let active=true;setLoading(true);setDetailsError(false);
    setPlayer({ open: false, tab: "iptv-1", source: "iptv-1" });
    fetchDetails(Number(id), type as "movie" | "tv")
      .then((data) => {
        if(!active)return;setDetails(data);
        if (type === "tv" && data.seasons?.length) {
          const firstReal = data.seasons.find((s) => s.season_number > 0);
          if (firstReal) {
            setSelectedSeason(firstReal.season_number);
            void loadSeasonIntoList(firstReal.season_number);
          }
        }
      })
      .catch(()=>{if(active){setDetails(null);setDetailsError(true);}})
      .finally(() => {if(active)setLoading(false);});

    fetchVideos(Number(id), type as "movie" | "tv").then((videos) => {
      if(!active)return;const trailer = videos.find((v) => v.site === "YouTube" && v.type === "Trailer")
        || videos.find((v) => v.site === "YouTube");
      if (trailer) setTrailerKey(trailer.key);
    }).catch(console.error);

    fetchSimilar(Number(id), type as "movie" | "tv")
      .then(data=>{if(active)setSimilar(data);})
      .catch(console.error);

    fetchCertification(Number(id), type as "movie" | "tv")
      .then((c) => {if(active)setCertification(c || "L");})
      .catch(() => {if(active)setCertification("L");});
    return()=>{active=false;};
  }, [id, type,loadSeasonIntoList,detailsAttempt]);

  useEffect(() => {
    setSeriesSources(null);
    setSeriesLookupError(null);
    if (type !== "tv" || !details || details.id !== Number(id)) return;
    if (localAddonTest && localProbeResolvedKey !== `${type}:${id}`) return;
    if (localAddonTest && !localAddonTV) return;
    const controller = new AbortController();
    const lookupKey=`${id}:${localAddonTV ? "addon" : "legacy"}`;
    if (localAddonTV) {
      void fetch(`/addon-local/episodes/tv/${id}`, {signal:controller.signal})
        .then(response=>{if(!response.ok)throw new Error("Episódios indisponíveis.");return response.json();})
        .then(data=>{if(!controller.signal.aborted)setSeriesSources(data as SeriesSources);})
        .catch(()=>{if(!controller.signal.aborted)setSeriesLookupError(CONTENT_UNAVAILABLE_MESSAGE);})
        .finally(()=>{if(!controller.signal.aborted)setSeriesLookupResolvedKey(lookupKey);});
      return ()=>controller.abort();
    }
    fetchSeriesSources(Number(id), {title:getTitle(details),original_title:details.original_name,year:getYear(details)}, controller.signal)
      .then(data=>{if (!controller.signal.aborted) setSeriesSources(data);})
      .catch(()=>{ /* A lista pode falhar enquanto a resolução direta ainda funciona. */ })
      .finally(()=>{if(!controller.signal.aborted)setSeriesLookupResolvedKey(lookupKey);});
    return ()=>controller.abort();
  }, [id,type,details,localAddonTV,localProbeResolvedKey,sourceRetry]);
  useEffect(() => {
    if (localAddonTest && type === "tv" && localProbeResolvedKey === `${type}:${id}` && !localAddonTV) {
      setPlayer(current => current.open ? {...current, open:false} : current);
    }
  }, [id,type,localProbeResolvedKey,localAddonTV]);
  useEffect(()=>()=>{transitionRef.current+=1;},[id,type]);

  useEffect(() => {
    if (player.open) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [player.open]);

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    if (!showSeasonDropdown) return;
    const handleClick = () => setShowSeasonDropdown(false);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [showSeasonDropdown]);

  const handleSeasonChange = (seasonNum: number) => {
    setSelectedSeason(seasonNum);
    setShowSeasonDropdown(false);
    if (id) {
      void loadSeasonIntoList(seasonNum);
    }
  };

  const absoluteEpisode = useCallback((seasonNum: number, episodeNum: number) => {
    const seasons=(details?.seasons || []).filter(s=>s.season_number>0&&s.season_number<seasonNum);
    // Refuse an offset if TMDB omitted a preceding season.
    if (seasons.length !== seasonNum-1) return undefined;
    const current=details?.seasons?.find(s=>s.season_number===seasonNum);
    // Some TMDB series number episodes continuously across seasons.
    if (seasonNum>1 && current && episodeNum>current.episode_count) return episodeNum;
    return seasons.reduce((total,s)=>total+s.episode_count,0)+episodeNum;
  },[details]);
  const openPlayer = useCallback((seasonNum?: number, episodeNum?: number, resume = true) => {
    if (!details || availability!=="available") return;
    transitionRef.current+=1;
    setStartedKey("");
    const mediaType=type === "movie" ? "movie" : "tv";
    const previous=resume ? getWatchProgress(Number(id),mediaType,seasonNum,episodeNum) : undefined;
    const index=absoluteEpisode(seasonNum || 1,episodeNum || 1);
    const available=seriesSources?.episodes.filter(e=>(e.season===seasonNum&&e.episode===episodeNum)||(e.season===null&&e.episode===index));
    const defaultLanguage=available?.length&&!available.some(e=>e.language==="pt") ? "en" : "pt";
    const requestedLanguage=previous?.language || (resume ? defaultLanguage : playbackLanguageRef.current);
    const language=available?.length && !available.some(e=>e.language===requestedLanguage) ? defaultLanguage : requestedLanguage;
    playbackLanguageRef.current=language;
    setPlayer({open:true,tab:"iptv-1",source:"iptv-1",seasonNum,episodeNum,initialTime:previous?.completed?0:previous?.currentTime || 0,language});
  },[details,id,type,seriesSources,absoluteEpisode,availability]);
  useEffect(()=>{
    if(!searchParams.has("resume")||!details||details.id!==Number(id))return;
    const key=`${type}:${id}`;if(resumeRequest.current===key)return;
    const previous=getWatchProgress(Number(id),type==="movie"?"movie":"tv");
    if(previous&&!previous.completed){resumeRequest.current=key;openPlayer(previous.season,previous.episode);}
  },[searchParams,details,id,type,openPlayer]);
  const closePlayer = useCallback(() => {
    transitionRef.current+=1;
    setPlayer(p=>({...p,open:false}));
  },[]);
  const getPlayerUrl = useCallback(
    async (_source: string, seasonNum?: number, episodeNum?: number, language: MovieLanguage = "pt", signal?: AbortSignal): Promise<string> => {
      if (localAddonMovie) {
        if (language !== "pt") throw new Error("Esta versão de teste está disponível apenas em português.");
        return `/addon-local/stream/movie/${id}`;
      }
      if (localAddonTV) {
        if(seasonNum===undefined||episodeNum===undefined)throw new Error("Selecione um episódio.");
        if(!seriesSources?.episodes.some(item=>item.season===seasonNum&&item.episode===episodeNum&&item.language===language))throw new Error(CONTENT_UNAVAILABLE_MESSAGE);
        return `/addon-local/stream/tv/${id}/${seasonNum}/${episodeNum}`;
      }
      if (localAddonTest && type === "tv") throw new Error(CONTENT_UNAVAILABLE_MESSAGE);
      if (type === "movie") return resolveMovieStream(Number(id),language,signal);
      if (!details || seasonNum === undefined || episodeNum === undefined) throw new Error("Selecione uma temporada e um episódio.");
      return resolveEpisodeStream(Number(id),seasonNum,episodeNum,language,
        {title:getTitle(details),original_title:details.original_name,year:getYear(details)},absoluteEpisode(seasonNum,episodeNum),signal);
    },[id,type,details,absoluteEpisode,localAddonMovie,localAddonTV,seriesSources]
  );
  const prepareLanguage=useCallback((language:MovieLanguage,signal?:AbortSignal)=>{
    if(localAddonMovie)return language==="pt"?Promise.resolve(`/addon-local/stream/movie/${id}`):Promise.reject(new Error("Idioma indisponível."));
    if(localAddonTV)return player.seasonNum&&player.episodeNum&&seriesSources?.episodes.some(item=>item.season===player.seasonNum&&item.episode===player.episodeNum&&item.language===language)?Promise.resolve(`/addon-local/stream/tv/${id}/${player.seasonNum}/${player.episodeNum}`):Promise.reject(new Error("Idioma indisponível."));
    if(localAddonTest&&type==="tv")return Promise.reject(new Error(CONTENT_UNAVAILABLE_MESSAGE));
    if(type==="movie")return prepareMovieStream(Number(id),language,signal);
    if(!details||player.seasonNum===undefined||player.episodeNum===undefined)return Promise.reject(new Error("Selecione um episódio."));
    return prepareEpisodeStream(Number(id),player.seasonNum,player.episodeNum,language,{title:getTitle(details),original_title:details.original_name,year:getYear(details)},absoluteEpisode(player.seasonNum,player.episodeNum),signal);
  },[id,type,details,player.seasonNum,player.episodeNum,absoluteEpisode,localAddonMovie,localAddonTV,seriesSources]);
  const recordProgress = useCallback((position: {currentTime:number;duration:number;language:MovieLanguage;completed:boolean}) => {
    if (!details) return;
    playbackLanguageRef.current=position.language;
    saveWatchProgress({id:Number(id),type:type==="movie"?"movie":"tv",title:getTitle(details),poster_path:details.poster_path,backdrop_path:details.backdrop_path,
      season:player.seasonNum,episode:player.episodeNum,episode_title:player.seasonNum===selectedSeason?episodes.find(e=>e.episode_number===player.episodeNum)?.name:undefined,
      progress:0,...position});
  },[details,id,type,player.seasonNum,player.episodeNum,selectedSeason,episodes]);
  const findNextEpisode=useCallback(async()=>{
    if(type!=="tv"||player.seasonNum===undefined||player.episodeNum===undefined||!details)return undefined;
    const current=await loadSeason(player.seasonNum);
    let season=player.seasonNum,list=current;
    let next=current.filter(e=>e.episode_number>player.episodeNum!).sort((a,b)=>a.episode_number-b.episode_number)[0];
    if(!next){
      const following=details.seasons?.filter(s=>s.season_number>player.seasonNum!&&s.episode_count>0).sort((a,b)=>a.season_number-b.season_number)[0];
      if(!following)return undefined;
      season=following.season_number;list=await loadSeason(season);next=list.slice().sort((a,b)=>a.episode_number-b.episode_number)[0];
    }
    if(!next||(next.air_date&&next.air_date>new Date().toISOString().slice(0,10)))return undefined;
    return {from:playerKey,season,episode:next.episode_number,name:next.name,list};
  },[details,loadSeason,player.seasonNum,player.episodeNum,playerKey,type,seriesSources]);
  useEffect(()=>{
    let active=true;setNextState(null);
    if(player.open&&type==="tv")void findNextEpisode().then(target=>{if(active)setNextState(target||null);}).catch(()=>{});
    return()=>{active=false;};
  },[findNextEpisode,player.open,type]);
  const prepareEpisode=useCallback((season:number,episode:number,language:MovieLanguage=playbackLanguageRef.current,force=false)=>{
    if(!details)return Promise.resolve(false);
    if(localAddonTV){
      if(!seriesSources?.episodes.some(item=>item.season===season&&item.episode===episode&&item.language===language))return Promise.resolve(false);
      return fetch(`/addon-local/resolve/tv/${id}/${season}/${episode}`).then(response=>response.ok).catch(()=>false);
    }
    if(localAddonTest&&type==="tv")return Promise.resolve(false);
    const key=`${id}:${season}:${episode}:${language}`,existing=warmRequests.current.get(key);
    if(!force&&existing&&existing.expires>Date.now())return existing.promise;
    const entry={promise:Promise.resolve(false) as Promise<boolean>,expires:Date.now()+300_000};
    entry.promise=prepareEpisodeStream(Number(id),season,episode,language,{title:getTitle(details),original_title:details.original_name,year:getYear(details)},absoluteEpisode(season,episode))
      .then(()=>true).catch(()=>{entry.expires=Date.now()+30_000;return false;});
    if(warmRequests.current.size>=24)warmRequests.current.delete(warmRequests.current.keys().next().value!);
    warmRequests.current.set(key,entry);return entry.promise;
  },[details,id,absoluteEpisode,localAddonTV,seriesSources]);
  useEffect(()=>{
    if(player.open||!details||details.id!==Number(id))return;
    if(type==="movie"){
      if(localAddonMovie)return;
      if(!audioOptions?.some(option=>option.id==="pt"&&option.available))return;
      let active=true;
      void prepareMovieStream(Number(id),"pt").then(()=>{if(active&&audioOptions.some(option=>option.id==="en"&&option.available))return prepareMovieStream(Number(id),"en");}).catch(()=>{});
      return()=>{active=false;};
    }
    if(!seriesSources)return;
    const previous=getWatchProgress(Number(id),"tv");
    const season=previous?.season||selectedSeason,episode=previous?.episode||1;
    const absolute=absoluteEpisode(season,episode);
    const available=seriesSources.episodes.filter(e=>(e.season===season&&e.episode===episode)||(e.season===null&&e.episode===absolute));
    const language=previous?.language||(available.some(e=>e.language==="pt")?"pt":"en");
    void prepareEpisode(season,episode,language);
  },[player.open,details,id,type,audioOptions,seriesSources,selectedSeason,absoluteEpisode,prepareEpisode,localAddonMovie]);
  const activeLanguage=savedProgress?.season===player.seasonNum&&savedProgress?.episode===player.episodeNum?savedProgress?.language||player.language||"pt":player.language||"pt";
  const nextNearEnd=!!savedProgress?.duration&&savedProgress.duration-(savedProgress.currentTime||0)<=120;
  useEffect(()=>{
    let active=true;let timer:ReturnType<typeof setTimeout>;
    if(!player.open||!nextEpisode||startedKey!==playerKey){setNextPreparing(false);return;}
    const run=(force=false)=>{
      setNextPreparing(true);
      void prepareEpisode(nextEpisode.season,nextEpisode.episode,activeLanguage,force).then(ready=>{
        if(!active)return;setNextPreparing(false);
        timer=setTimeout(()=>run(),ready?180_000:30_000);
      });
    };
    run(nextNearEnd);
    return()=>{active=false;clearTimeout(timer);};
  },[player.open,nextEpisode,prepareEpisode,activeLanguage,nextNearEnd,startedKey,playerKey]);
  const advanceEpisode=useCallback(async()=>{
    const request=transitionRef.current;
    const target=nextEpisode||await findNextEpisode();
    if(!target||request!==transitionRef.current)return;
    setSelectedSeason(target.season);setEpisodes(target.list);
    openPlayer(target.season,target.episode,false);
  },[nextEpisode,findNextEpisode,openPlayer]);
  const selectEpisode=useCallback((season:number,episode:number)=>{
    setSelectedSeason(season);void loadSeasonIntoList(season);openPlayer(season,episode);
  },[loadSeasonIntoList,openPlayer]);
  const episodeAudioOptions: MovieLanguageOption[] | undefined = type==="tv"&&seriesSources ? (["pt","en"] as const).map(language=>({
    id:language,label:language==="pt"?"Português (Dublado)":"Original (Legendado)",version:language==="pt"?"dublado":"legendado",audio_language:language==="pt"?"pt":details?.original_language || "original",
    available:seriesSources.episodes.some(e=>e.language===language&&((e.season===player.seasonNum&&e.episode===player.episodeNum)||(e.season===null&&e.episode===absoluteEpisode(player.seasonNum||1,player.episodeNum||1))))
  })) : undefined;

  if (loading) return <PageSkeleton/>;
  if (!details) return <div className="min-h-screen bg-background"><Navbar/><main className="browse-page"><div className="library-empty"><X size={35}/><h1>{detailsError?"Não conseguimos abrir este título agora.":"Esta história não foi encontrada."}</h1><p>{detailsError?"Confira sua conexão e tente novamente. Seu progresso continua salvo.":"Explore o catálogo para encontrar sua próxima história."}</p>{detailsError&&<button className="action-primary" onClick={()=>setDetailsAttempt(n=>n+1)}>Tentar novamente</button>}<Link to="/" className="action-secondary">Voltar ao início</Link></div></main></div>;

  const title = getTitle(details);
  const originalTitle = details.original_title || details.original_name || title;
  const year = getYear(details);
  const rating = getRating(details);
  const runtime = details.runtime || (details.episode_run_time?.[0] ?? 0);
  const directors = details.credits.crew.filter((p) => p.job === "Director");
  const cast = details.credits.cast.slice(0, 12);

  const providers = details["watch/providers"]?.results?.BR;
  const allProviders = [
    ...(providers?.flatrate || []),
    ...(providers?.rent || []),
    ...(providers?.buy || []),
  ];
  const uniqueProviders = allProviders.filter(
    (p, i, arr) => arr.findIndex((x) => x.provider_id === p.provider_id) === i
  );

  const filteredSeasons = details.seasons?.filter((s) => s.season_number > 0) || [];
  const sourceCheckReady = (!localAddonTest || localProbeResolvedKey === `${type}:${id}`)
    && (!localAddonTV || seriesLookupResolvedKey === `${id}:addon`);
  const addonTVUnavailable = localAddonTest && type === "tv" && localProbeResolvedKey === `${type}:${id}` && !localAddonTV;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navbar />
      </div>

      {/* Player Modal with Tabs */}
      {player.open && (
        <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
          {!sourceCheckReady ? <div role="status" aria-label="Preparando vídeo" className="flex h-full w-full items-center justify-center">
            <button type="button" onClick={closePlayer} className="absolute left-5 top-5 rounded-full border border-white/20 p-3 text-white" aria-label="Voltar"><X size={20}/></button>
            <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden="true" />
          </div> : localAddonTV && seriesLookupError ? <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-5 px-6 text-center text-white">
            <button type="button" onClick={closePlayer} className="absolute left-5 top-5 rounded-full border border-white/20 p-3" aria-label="Voltar"><X size={20}/></button>
            <p className="max-w-md text-lg font-semibold">{CONTENT_UNAVAILABLE_MESSAGE}</p>
            <button type="button" onClick={()=>{setLocalProbeResolvedKey(null);setSeriesLookupResolvedKey(null);setSourceRetry(value=>value+1);}} className="rounded-full border border-white/25 px-5 py-2 text-sm hover:border-primary">Tentar novamente</button>
          </div> : <div className="w-full h-full">
            <IPTVPlayer
              key={`${type}-${id}`}
              playbackKey={playerKey}
              contentTitle={title}
              year={year}
              source={player.source}
              season={player.seasonNum}
              episode={player.episodeNum}
              getStreamUrl={getPlayerUrl}
              onPrepareLanguage={prepareLanguage}
              certification={certification}
              onClose={closePlayer}
              audioOptions={type === "movie" ? audioOptions : episodeAudioOptions}
              initialTime={player.initialTime}
              initialLanguage={player.language}
              onProgress={recordProgress}
              onEnded={advanceEpisode}
              onPlaybackStarted={()=>setStartedKey(playerKey)}
              episodes={type==="tv"?episodes:undefined}
              seasons={details.seasons}
              episodeListSeason={selectedSeason}
              episodeListLoading={episodeListLoading}
              onSelectSeason={handleSeasonChange}
              onSelectEpisode={type==="tv"?selectEpisode:undefined}
              onPrepareEpisode={(season,episode)=>{void prepareEpisode(season,episode);}}
              nextEpisode={nextEpisode}
              nextPreparing={nextPreparing}
            />
          </div>}
        </div>
      )}

      {/* Hero */}
      <div className="details-hero premium-detail-hero relative w-full min-h-[70vh]">
        <img src={backdropUrl(details.backdrop_path)} alt={title} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        <div className="relative z-10 flex items-end min-h-[70vh] pb-12">
          <div className="details-poster"><img src={posterUrl(details.poster_path)} alt={title}/><span>MOX · {type==="movie"?"FILME":"SÉRIE"}</span></div>
          <div className="details-copy px-4 md:px-12 max-w-3xl">
            <span className="eyebrow detail-eyebrow">{type==="movie"?"UMA HISTÓRIA PARA O SEU TEMPO":"SUA PRÓXIMA MARATONA"}</span>
            <h1 className="details-title mb-4">{title}</h1>

            <div className="flex items-center gap-4 mb-4 text-sm">
              <span className="flex items-center gap-1 text-yellow-400">
                <Star className="w-4 h-4 fill-current" /> {rating}%
              </span>
              {year && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="w-4 h-4" /> {year}
                </span>
              )}
              {runtime > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-4 h-4" /> {runtime} min
                </span>
              )}
            </div>

            {details.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {details.genres.map((g) => (
                  <span key={g.id} className="px-3 py-1 bg-secondary rounded-full text-xs font-medium">
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {details.overview && (
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{details.overview}</p>
            )}

            <div className="flex flex-wrap gap-4 z-30 relative items-center mt-6">
              {addonTVUnavailable && <span role="status" className="rounded-full border border-white/20 bg-black/45 px-5 py-3 text-sm text-white/80">Indisponível no momento. Aguarde novas atualizações do catálogo.</span>}
              {!addonTVUnavailable && availability!=="available" && <div className="flex flex-wrap items-center gap-3"><span role="status" className="rounded-full border border-white/25 bg-black/55 px-5 py-3 text-sm font-semibold text-white">{availability==="checking"?"Verificando disponibilidade…":"Em Breve na MOX"}</span>{availability==="upcoming"&&<button type="button" onClick={()=>refreshTitleAvailability(type!,Number(id))} className="rounded-full border border-white/25 px-4 py-2 text-sm text-white/80 hover:border-primary">Verificar novamente</button>}</div>}
              {/* Botão Assistir ou Continuar Assistindo (primeiro à esquerda) */}
              {!addonTVUnavailable && availability==="available" && (() => {
                const progress = savedProgress;
                if (progress && !progress.completed && progress.progress < 100) {
                  return (
                    <button
                      onClick={() => openPlayer(progress.season, progress.episode)}
                      className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-primary-foreground font-semibold px-8 py-3 rounded-lg transition-colors shadow-md"
                      style={{ minWidth: 180 }}
                    >
                      <Play className="w-5 h-5 fill-current" /> Continuar Assistindo
                    </button>
                  );
                }
                // Não assistido: mostrar botão Assistir
                return (
                  <button
                    onClick={() => openPlayer(type === 'movie' ? undefined : selectedSeason, type === 'movie' ? undefined : 1)}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-primary-foreground font-semibold px-8 py-3 rounded-lg transition-colors shadow-md"
                    style={{ minWidth: 180 }}
                  >
                    <Play className="w-5 h-5 fill-current" /> Assistir
                  </button>
                );
              })()}
              {/* Botão Trailer */}
              {trailerKey && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-foreground font-semibold px-6 py-3 rounded-lg transition-colors shadow-md"
                  style={{ minWidth: 120 }}
                >
                  <Youtube className="w-5 h-5" /> Trailer
                </button>
              )}
              <SaveTitleButton item={details} type={type==="movie"?"movie":"tv"}/>
              {/* Dropdown premium dos três pontinhos */}
              {(() => {
                const progress = savedProgress;
                if (progress) {
                  return (
                    <div className="relative">
                      <button
                        className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#28283a] transition-colors border border-[#28283a] shadow-md"
                        onClick={() => {
                          const menu = document.getElementById('options-menu-premium');
                          if (menu) menu.classList.toggle('hidden');
                        }}
                        aria-label="Mais opções"
                        type="button"
                        style={{ marginLeft: 8 }}
                      >
                        <svg width="22" height="22" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/></svg>
                      </button>
                      <div id="options-menu-premium" className="hidden absolute right-0 mt-2 w-48 bg-[#181824] border border-[#28283a] rounded-xl shadow-2xl z-[9999] py-2 space-y-1 animate-fade-in" style={{ minWidth: 180 }}>
                        <button
                          onClick={() => {
                            removeWatchProgress(details.id,type==="movie"?"movie":"tv");
                          }}
                          className="w-full text-left px-5 py-3 text-base text-white hover:bg-[#28283a] rounded-lg transition-colors font-medium"
                        >
                          Reiniciar
                        </button>
                        <button
                          onClick={() => {
                            removeWatchProgress(details.id,type==="movie"?"movie":"tv");
                          }}
                          className="w-full text-left px-5 py-3 text-base text-red-500 hover:bg-red-900/30 rounded-lg transition-colors font-medium"
                        >
                          Remover dos Assistidos
                        </button>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          </div>
        </div>
      </div>

      {showTrailer&&trailerKey&&<TrailerDialog title={title} videoKey={trailerKey} onClose={closeTrailer}/>}

      <nav className="detail-tabs" aria-label="Informações do título">{(type==="tv"?[['episodes','Episódios'],['about','Sobre o título'],['similar','Você também pode gostar']]:[['about','Sobre o título'],['similar','Você também pode gostar']]).map(([key,label])=><button key={key} aria-pressed={(type==="movie"&&detailTab==="episodes"?"about":detailTab)===key} onClick={()=>setDetailTab(key as "episodes"|"about"|"similar")}>{label}</button>)}</nav>
      {(detailTab==="about"||(type==="movie"&&detailTab==="episodes"))&&<section className="detail-information"><div className="detail-story"><span className="eyebrow">POR DENTRO DA HISTÓRIA</span><h2>Uma história que merece seu tempo.</h2><p>{details.overview||"Sinopse indisponível."}</p><dl className="story-facts"><div><dt>Ano</dt><dd>{year||"—"}</dd></div><div><dt>Formato</dt><dd>{type==="movie"?"Filme":"Série"}</dd></div><div><dt>Gêneros</dt><dd>{details.genres?.map(g=>g.name).join(" · ")||"—"}</dd></div></dl></div>      {/* Info sections */}
      <div className="detail-about">
        {directors.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Direção</h3>
            <p className="text-sm">{directors.map((d) => d.name).join(", ")}</p>
          </div>
        )}

        {cast.length > 0 && (
          <div className="mt-10 mb-14">
            <h2 className="text-xl font-bold mb-6">Elenco</h2>
            <div className="flex gap-6 md:gap-8 overflow-x-auto scrollbar-hide pb-4 px-2 md:px-0">
              {cast.map((actor) => (
                <div key={actor.id} className="flex-shrink-0 w-24 text-center">
                  <div className="w-20 h-20 mx-auto rounded-full overflow-hidden bg-secondary mb-2">
                    <img
                      src={actor.profile_path ? posterUrl(actor.profile_path, 'w185') : '/placeholder.svg'}
                      alt={actor.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs font-medium truncate">{actor.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{actor.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {uniqueProviders.length > 0 && (
          <div className="mb-16">
            <h2 className="text-xl font-bold mb-6">Onde Assistir</h2>
            <div className="flex flex-wrap gap-6">
              {uniqueProviders.map((p) => (
                <div key={p.provider_id} className="bg-secondary rounded-lg p-3 md:p-4" title={p.provider_name}>
                  <img
                    src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                    alt={p.provider_name}
                    className="w-12 h-12 md:w-14 md:h-14 rounded object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

</section>}

      {/* Seasons & Episodes (TV only) */}
      {type === "tv" && detailTab === "episodes" && filteredSeasons.length > 0 && (
        <div className="detail-episodes px-4 md:px-12 pb-10">
          {/* Título + Linha separadora */}
          <h2 className="text-xl font-bold mb-2">Episódios</h2>
          <div className="h-px bg-foreground/20 mb-6" />

          {/* Dropdown de Temporada */}
          <div className="relative inline-block mb-8">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSeasonDropdown((v) => !v);
              }}
              className="flex items-center gap-2 bg-secondary hover:bg-secondary/80 text-foreground font-semibold px-5 py-2.5 rounded-md transition-colors text-sm"
            >
              Temporada {selectedSeason}
              <ChevronDown className={`w-4 h-4 transition-transform ${showSeasonDropdown ? "rotate-180" : ""}`} />
            </button>

            {showSeasonDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-20 min-w-[180px] py-1 max-h-64 overflow-y-auto">
                {filteredSeasons.map((season) => (
                  <button
                    key={season.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSeasonChange(season.season_number);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                      selectedSeason === season.season_number
                        ? "bg-primary/20 text-primary font-semibold"
                        : "hover:bg-secondary text-foreground"
                    }`}
                  >
                    Temporada {season.season_number}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Episódios em Row Horizontal */}
          <div className="detail-episode-grid">
            {episodes.map((ep) => (
              <div
                key={ep.id}
                onClick={() => openPlayer(selectedSeason, ep.episode_number)}
                role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter")openPlayer(selectedSeason,ep.episode_number);}} className="detail-episode-card group"
              >
                <div className="aspect-video relative bg-secondary">
                  <img
                    src={ep.still_path ? posterUrl(ep.still_path, "w500") : "/placeholder.svg"}
                    alt={ep.name}
                    className="w-full h-full object-cover"
                  />
                  {availability!=="available" && <span className={`media-unavailable-overlay${availability==="checking"?" is-checking":""}`}><span>{availability==="checking"?"Verificando":"Em Breve na MOX"}</span></span>}
                  <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Play className="w-10 h-10 text-primary fill-current" />
                  </div>
                </div>
                <div className="p-4">
                  <h4 className="text-base font-bold truncate">
                    E{ep.episode_number} - {ep.name}
                  </h4>
                  {ep.overview && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{ep.overview}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conteúdos Relacionados */}
      {detailTab === "similar" && similar.length > 0 && (
        <div className="pb-16">
          <ContentRow
            title="Conteúdos Relacionados"
            items={similar}
            mediaType={type === "movie" ? "filme" : "serie"}
          />
        </div>
      )}
      <SiteFooter />
    </div>
  );
}
