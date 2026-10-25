import { CONTENT_UNAVAILABLE_MESSAGE } from "@/lib/redecanais";
import { useEffect, useRef, useState, useCallback } from "react";
import type Hls from "hls.js";
import type { MovieLanguage, MovieLanguageOption } from "@/lib/redecanais";
import type { Episode, Season } from "@/lib/tmdb";
import EpisodeDrawer from "@/components/EpisodeDrawer";
import {
  Loader2,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RotateCcw,
  RotateCw,
  Subtitles,
  Languages,
  ArrowLeft,
  ListVideo,
  SkipForward,
} from "lucide-react";

interface IPTVPlayerProps {
  contentTitle: string;
  year?: string;
  source: string;
  season?: number;
  episode?: number;
  getStreamUrl: (
    source: string,
    sNum?: number,
    eNum?: number,
    language?: MovieLanguage,
    signal?: AbortSignal
  ) => Promise<string>;
  onPrepareLanguage?: (language:MovieLanguage, signal?:AbortSignal)=>Promise<string>;
  certification?: string;
  onClose?: () => void;
  liveMode?: boolean;
  channelNumber?: number;
  audioOptions?: MovieLanguageOption[];
  initialTime?: number;
  initialLanguage?: MovieLanguage;
  onProgress?: (progress: { currentTime: number; duration: number; language: MovieLanguage; completed: boolean }) => void;
  onEnded?: () => void | Promise<void>;
  onPlaybackStarted?:()=>void;
  playbackKey?: string;
  episodes?: Episode[];
  seasons?: Season[];
  episodeListSeason?: number;
  episodeListLoading?: boolean;
  onSelectSeason?: (season:number)=>void;
  onSelectEpisode?: (season:number,episode:number)=>void;
  onPrepareEpisode?: (season:number,episode:number)=>void;
  nextEpisode?: {season:number;episode:number;name:string};
  nextPreparing?: boolean;
}

export default function IPTVPlayer({
  contentTitle,
  year,
  source,
  season,
  episode,
  getStreamUrl,
  onPrepareLanguage,
  certification,
  onClose,
  liveMode = false,
  channelNumber,
  audioOptions,
  initialTime = 0,
  initialLanguage = "pt",
  onProgress,
  onEnded,
  onPlaybackStarted,
  playbackKey: providedKey,
  episodes,
  seasons,
  episodeListSeason,
  episodeListLoading,
  onSelectSeason,
  onSelectEpisode,
  onPrepareEpisode,
  nextEpisode,
  nextPreparing,
}: IPTVPlayerProps) {
  const playbackKey=providedKey || `${source}:${season || 0}:${episode || 0}`;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleError, setVisibleError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.6);
  const [isMuted, setIsMuted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showSpinner,setShowSpinner]=useState(false);
  const [bufferedSeconds, setBufferedSeconds] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [switchingLanguage,setSwitchingLanguage]=useState<MovieLanguage|null>(null);
  const [languageError,setLanguageError]=useState<string|null>(null);
  const switchController=useRef<AbortController|null>(null);
  const languageURLs=useRef(new Map<string,{url:string;expires:number}>());
  const languageWarm=useRef(new Map<string,Promise<string>>());
  const languagePreparationControllers=useRef(new Set<AbortController>());
  const [playbackStarted,setPlaybackStarted]=useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [audioSelection,setAudioSelection]=useState({key:playbackKey,value:initialLanguage});
  const language=audioSelection.key===playbackKey?audioSelection.value:initialLanguage;
  const setLanguage=(value:MovieLanguage)=>setAudioSelection({key:playbackKey,value});
  const [showEpisodes,setShowEpisodes]=useState(false);
  const [autoplayBlocked,setAutoplayBlocked]=useState(false);
  const [streamRevision, setStreamRevision] = useState(0);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(isMuted);
  const resumeTimeRef = useRef(initialTime);
  const callbacksRef = useRef({onProgress,onEnded,language,onPlaybackStarted});
  callbacksRef.current = {onProgress,onEnded,language,onPlaybackStarted};
  const requestedKeyRef=useRef(playbackKey);
  requestedKeyRef.current=playbackKey;
  const lastKeyRef=useRef(playbackKey);
  const selectionRef=useRef({key:playbackKey,language,onProgress});
  const transitioningRef=useRef(false);

  useEffect(() => {
    volumeRef.current = volume;
    mutedRef.current = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    if (!error) { setVisibleError(null); return; }
    if (liveMode) { setVisibleError(error); return; }
    setVisibleError(null);
    const timer = setTimeout(() => setVisibleError(error), 900);
    return () => clearTimeout(timer);
  }, [error, liveMode]);

  const clearHideTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimeout();
    if (isPlayingRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (document.documentElement.dataset.input === "remote" && containerRef.current?.contains(document.activeElement) && document.activeElement?.tagName === "BUTTON") return;
        setShowOverlay(false);
        setShowAudioMenu(false);
        setShowSubMenu(false);
      }, 3000);
    }
  }, [clearHideTimeout]);

  const handleActivity = useCallback(() => {
    setShowOverlay(true);
    scheduleHide();
  }, [scheduleHide]);

  /* ================= STREAM ================= */

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const progressCallback=callbacksRef.current.onProgress;
    transitioningRef.current=true;
    if(lastKeyRef.current!==playbackKey){
      lastKeyRef.current=playbackKey;resumeTimeRef.current=initialTime;setPlaybackStarted(false);
      setCurrentTime(initialTime);setDuration(0);setShowEpisodes(false);
    }

    async function load() {
      setLoading(true);
      setError(null);
      setAutoplayBlocked(false);
      videoRef.current?.pause();
      setIsPlaying(false);
      setIsBuffering(true);

      setBufferedSeconds(0);

      try {
        const key=`${playbackKey}:${language}`,cached=languageURLs.current.get(key);
        const url = cached&&cached.expires>Date.now()?cached.url:await getStreamUrl(source, season, episode, language, controller.signal);
        if(url){if(languageURLs.current.size>8)languageURLs.current.clear();languageURLs.current.set(key,{url,expires:Date.now()+240_000});}
        if (!active) return;

        if (!url) {
          setError(CONTENT_UNAVAILABLE_MESSAGE);
        } else {
          selectionRef.current={key:playbackKey,language,onProgress:progressCallback};
          transitioningRef.current=false;
          setStreamUrl(url);
          setStreamRevision((value) => value + 1);
        }
      } catch (error) {
        if (active) setError(error instanceof Error ? error.message : "Erro ao carregar stream.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [getStreamUrl, source, season, episode, language, playbackKey, initialTime]);

  /* ================= VIDEO EVENTS ================= */

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !streamUrl) return;
    const selection=selectionRef.current;
    let metadataLoaded = false;
    let lastSaved = 0;
    let endedHandled = false;
    const checkpoint = (completed = false) => {
      if (liveMode || !metadataLoaded || !Number.isFinite(video.duration) || video.duration <= 0) return;
      lastSaved = Date.now();
      selection.onProgress?.({currentTime:video.currentTime,duration:video.duration,language:selection.language,completed:completed||endedHandled});
    };

    const onLoaded = () => {
      if(transitioningRef.current||selection.key!==requestedKeyRef.current)return;
      metadataLoaded = true;
      setDuration(video.duration || 0);
      video.volume = volumeRef.current;
      video.muted = mutedRef.current;
      if (!liveMode) {
        video.currentTime = Math.min(resumeTimeRef.current, Math.max(0, video.duration - 0.25));
        resumeTimeRef.current = 0;
      }
      video.play().catch(() => {
        setIsBuffering(false);
        setAutoplayBlocked(true);
      });
    };

    const updateBuffer = () => {
      let bufferedAhead = 0;
      for (let index = 0; index < video.buffered.length; index += 1) {
        const start = video.buffered.start(index);
        const end = video.buffered.end(index);
        if (end >= video.currentTime && start <= video.currentTime + 5) {
          bufferedAhead = Math.max(bufferedAhead, end - Math.max(video.currentTime, start));
        }
      }
      setBufferedSeconds(Math.max(0, bufferedAhead));
    };
    const onTime = () => {
      if(selection.key!==requestedKeyRef.current)return;
      setCurrentTime(video.currentTime);
      updateBuffer();
      if (Date.now()-lastSaved >= 5000) checkpoint();
      if(!video.seeking&&!video.paused&&!video.error&&Number.isFinite(video.duration)&&video.duration>1&&video.duration-video.currentTime<=0.15)onFinished();
    };
    const onPlay = () => {
      setIsPlaying(true);
      isPlayingRef.current = true;
      scheduleHide();
    };
    const onPause = () => {
      checkpoint(video.ended);
      setIsPlaying(false);
      isPlayingRef.current = false;
      setShowOverlay(true);
      clearHideTimeout();
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => {
      if(selection.key!==requestedKeyRef.current||transitioningRef.current)return;
      setPlaybackStarted(true);
      callbacksRef.current.onPlaybackStarted?.();
      setAutoplayBlocked(false);
      setIsBuffering(false);

    };
    const onError = () => {
      setIsBuffering(false);
      setError(liveMode ? "Não foi possível reproduzir este canal. Verifique se o sinal está ativo e se o formato é compatível." : "Não foi possível reproduzir esta versão do filme. Tente novamente ou selecione outro idioma.");
    };
    const onSeeked = () => checkpoint();
    const onPageHide = () => checkpoint();
    const onVisibility = () => { if (document.visibilityState === "hidden") checkpoint(); };
    const onFinished = () => {
      if (endedHandled || liveMode || transitioningRef.current || selection.key!==requestedKeyRef.current) return;
      endedHandled = true;
      checkpoint(true);
      Promise.resolve(callbacksRef.current.onEnded?.()).catch((error: unknown) => {
        if (!disposed) setError(error instanceof Error ? error.message : "Não foi possível abrir o próximo episódio.");
      });
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("progress", updateBuffer);
    video.addEventListener("durationchange", updateBuffer);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("stalled", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("error", onError);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("ended", onFinished);
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    let hls: Hls | null = null;
    let disposed = false;
    const isHlsStream = /\.m3u8(?:$|[?#])/i.test(streamUrl);
    const attachStream = async () => {
      if (isHlsStream && !video.canPlayType("application/vnd.apple.mpegurl")) {
        const { default: HlsPlayer } = await import("hls.js/light");
        if (disposed) return;
        if (HlsPlayer.isSupported()) {
          hls = new HlsPlayer({
            maxBufferLength: liveMode ? 30 : 45,
            maxMaxBufferLength: liveMode ? 60 : 90,
            backBufferLength: liveMode ? 15 : 30,
            maxBufferHole: 0.5,
          });
          hls.on(HlsPlayer.Events.MEDIA_ATTACHED, () => hls?.loadSource(streamUrl));
          hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            setIsBuffering(false);
            if (data.type === HlsPlayer.ErrorTypes.NETWORK_ERROR) {
              setError("Falha ao receber o sinal IPTV. Verifique sua conexão ou tente outro canal.");
            } else if (data.type === HlsPlayer.ErrorTypes.MEDIA_ERROR) {
              hls?.recoverMediaError();
            } else {
              setError("Este canal não pôde ser reproduzido neste navegador.");
              hls?.destroy();
            }
          });
          hls.attachMedia(video);
          return;
        }
      }

      video.src = streamUrl;
      video.load();
    };
    void attachStream().catch(() => {
      if (!disposed) {
        setIsBuffering(false);
        setError("Não foi possível iniciar a reprodução deste canal.");
      }
    });

    return () => {
      disposed = true;
      checkpoint(video.ended);
      hls?.destroy();
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("progress", updateBuffer);
      video.removeEventListener("durationchange", updateBuffer);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("stalled", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("error", onError);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("ended", onFinished);
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [streamUrl, streamRevision, liveMode, scheduleHide, clearHideTimeout]);

  useEffect(()=>{
    if(error||(!loading&&!isBuffering)){setShowSpinner(false);return;}
    const timer=setTimeout(()=>setShowSpinner(true),650);
    return()=>clearTimeout(timer);
  },[loading,isBuffering,error]);

  /* ================= FULLSCREEN ================= */

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  /* ================= OVERLAY AUTO-HIDE ================= */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onMove = () => handleActivity();
    container.addEventListener("mousemove", onMove);
    container.addEventListener("touchstart", onMove);
    return () => {
      container.removeEventListener("mousemove", onMove);
      container.removeEventListener("touchstart", onMove);
    };
  }, [handleActivity]);

  /* ================= KEYBOARD ================= */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target=e.target as HTMLElement|null;
      if(target?.closest('[role="dialog"]')||target?.matches('input,select,textarea,button'))return;
      if (
        !containerRef.current?.contains(document.activeElement) &&
        document.activeElement !== document.body
      )
        return;

      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          jump(-10);
          break;
        case "ArrowRight":
          e.preventDefault();
          jump(10);
          break;
        case "ArrowUp":
          e.preventDefault();
          changeVolume(Math.min(1, volume + 0.1));
          break;
        case "ArrowDown":
          e.preventDefault();
          changeVolume(Math.max(0, volume - 0.1));
          break;
        case "f":
          e.preventDefault();
          handleFullscreen();
          break;
        case "m":
          e.preventDefault();
          toggleMute();
          break;
      }
      handleActivity();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [volume, currentTime]);

  /* ================= CONTROLS ================= */

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, time));
    setCurrentTime(video.currentTime);
    handleActivity();
  };

  const jump = (delta: number) => seekTo(currentTime + delta);

  const warmLanguage=useCallback((next:MovieLanguage)=>{
    const key=`${playbackKey}:${next}`,cached=languageURLs.current.get(key);
    if(cached&&cached.expires>Date.now())return Promise.resolve(cached.url);
    const existing=languageWarm.current.get(key);if(existing)return existing;
    const controller=new AbortController();languagePreparationControllers.current.add(controller);
    const promise=(onPrepareLanguage?onPrepareLanguage(next,controller.signal):getStreamUrl(source,season,episode,next,controller.signal)).then(url=>{if(!controller.signal.aborted)languageURLs.current.set(key,{url,expires:Date.now()+240_000});return url;}).finally(()=>{languageWarm.current.delete(key);languagePreparationControllers.current.delete(controller);});
    languageWarm.current.set(key,promise);return promise;
  },[playbackKey,onPrepareLanguage,getStreamUrl,source,season,episode]);
  useEffect(()=>{switchController.current?.abort();setSwitchingLanguage(null);setLanguageError(null);const controllers=languagePreparationControllers.current,warming=languageWarm.current;return()=>{switchController.current?.abort();for(const controller of controllers)controller.abort();controllers.clear();warming.clear();};},[playbackKey]);
  const alternateAvailable=!audioOptions||audioOptions.some(o=>o.id===(language==="pt"?"en":"pt")&&o.available);
  useEffect(()=>{
    if(liveMode||!onPrepareLanguage||!playbackStarted||!alternateAvailable)return;
    const alternate=language==="pt"?"en":"pt";
    const timer=setTimeout(()=>{void warmLanguage(alternate).catch(()=>{});},showAudioMenu?0:episode===undefined?4000:12000);
    return()=>clearTimeout(timer);
  },[liveMode,onPrepareLanguage,playbackStarted,language,alternateAvailable,showAudioMenu,warmLanguage,episode]);
  const changeLanguage = async (next: MovieLanguage) => {
    if (next === language) {
      if (error && streamUrl) { setError(null); setStreamRevision((value) => value + 1); }
      setShowAudioMenu(false);return;
    }
    switchController.current?.abort();const controller=new AbortController();switchController.current=controller;
    const key=playbackKey;setSwitchingLanguage(next);setLanguageError(null);handleActivity();
    try{
      const url=await warmLanguage(next);
      if(controller.signal.aborted||requestedKeyRef.current!==key)return;
      languageURLs.current.set(`${key}:${next}`,{url,expires:Date.now()+240_000});
      // Read the position at commit, not when the user requested a slow source.
      resumeTimeRef.current=videoRef.current?.currentTime||currentTime;
      setLanguage(next);setShowAudioMenu(false);
    }catch(error){if(!controller.signal.aborted)setLanguageError(error instanceof Error?error.message:"Não foi possível preparar esta versão.");}
    finally{if(!controller.signal.aborted)setSwitchingLanguage(null);}
  };
  const languageOptions = audioOptions ?? [
    {id: "pt" as const, label: "Português (Dublado)", available: true},
    {id: "en" as const, label: "English (Legendado)", available: true},
  ];

  const changeVolume = (v: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, v));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      changeVolume(0.6);
      setIsMuted(false);
    } else {
      const video = videoRef.current;
      if (video) { video.volume = 0; video.muted = true; }
      setIsMuted(true);
    }
    handleActivity();
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
    handleActivity();
  };

  const formatTime = (t: number) => {
    if (!isFinite(t) || t < 0) return "0:00";
    const hours = Math.floor(t / 3600);
    const minutes = Math.floor((t % 3600) / 60);
    const seconds = Math.floor(t % 60);
    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  };

  const certLabel = (certification || "L").toUpperCase();

  const getCertColor = () => {
    switch (certLabel) {
      case "L":
      case "0":
        return "bg-green-500";
      case "10":
        return "bg-blue-500";
      case "12":
        return "bg-yellow-500";
      case "14":
        return "bg-orange-500";
      case "16":
        return "bg-red-500";
      case "18":
        return "bg-red-700";
      default:
        return "bg-gray-600";
    }
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const bufferedPercent = duration?Math.min(100,(currentTime+bufferedSeconds)/duration*100):0;
  const nearEnd=duration>0&&duration-currentTime<=30&&duration-currentTime>=0;

  /* ================= RENDER ================= */

  return (
    <div
      ref={containerRef}
      onFocusCapture={handleActivity}
      className={`mox-player relative flex flex-col w-full h-full select-none bg-black overflow-hidden outline-none ${
        showOverlay ? "cursor-default" : "cursor-none"
      }`}
      tabIndex={0}
    >
      {/* VIDEO */}
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        {streamUrl && (
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            style={{display: loading || error ? "none" : undefined}}
            preload="auto"
            playsInline
          />
        )}
        {visibleError&&<div role="alert" className="flex flex-col items-center gap-3"><AlertTriangle className="w-10 h-10 text-red-400"/><p className="max-w-sm px-5 text-center text-sm text-white">{visibleError}</p></div>}
      </div>
      {((showSpinner&&!error)||(!!error&&!visibleError))&&<div role="status" aria-label="Carregando vídeo" className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-primary"/><span className="sr-only">Carregando vídeo</span></div>}

      {/* CENTER CLICK AREA */}
      {streamUrl && (
        <div
          className="absolute inset-0 z-20"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest(".player-controls")) return;
            togglePlay();
          }}
        />
      )}

      {/* TOP OVERLAY */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 pointer-events-none transition-opacity duration-500 ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`}
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
        }}
      >
        <div className="premium-player-heading p-5 pb-16">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {/* Botão de voltar */}
              {!liveMode && (
                <button
                  onClick={onClose || (() => window.history.back())}
                  className="pointer-events-auto mr-2 p-1.5 rounded-md hover:bg-white/10 transition-colors"
                  aria-label="Voltar"
                >
                  <ArrowLeft className="w-7 h-7 text-white drop-shadow-lg" />
                </button>
              )}
                  <div>
                    {liveMode && (
                      <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        {channelNumber ? `Canal ${String(channelNumber).padStart(2, "0")} · Ao vivo` : "Ao vivo"}
                      </p>
                    )}
                    <h3 className="text-white text-2xl font-semibold tracking-tight leading-tight drop-shadow-lg">
                      {contentTitle}
                    </h3>
                    {year && (
                      <p className="text-white/60 text-lg mt-0.5 drop-shadow">
                        {year}
                      </p>
                    )}
                    {!liveMode&&season!==undefined&&episode!==undefined&&<p className="mt-1 text-sm text-white/70">T{season} Ep.{episode}</p>}
              </div>
            </div>
                {!liveMode && (
                  <div
                    className={`${getCertColor()} text-white font-bold text-base px-3 py-4 rounded-lg drop-shadow-lg flex items-center justify-center mr-6`}
                    style={{ minWidth: 56, minHeight: 44 }}
                  >
                    {certLabel}
                  </div>
                )}
          </div>
        </div>
      </div>

      {/* BOTTOM CONTROLS */}
      {streamUrl && (
        <div
          className={`player-controls absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-500 ${
            showOverlay ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.5) 60%, transparent 100%)",
          }}
        >
          <div className="premium-player-console px-5 pt-16 pb-5">
            {/* PROGRESS BAR */}
            {!liveMode && (
              <div className="premium-timeline mb-3 flex items-center gap-3 text-white/80 text-xs font-mono">
              <span className="min-w-[3rem] text-right">
                {formatTime(currentTime)}
              </span>
              <div
                className="group relative flex-1 h-[5px] rounded-full cursor-pointer hover:h-[8px] transition-all"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoverProgress(
                    ((e.clientX - rect.left) / rect.width) * 100
                  );
                }}
                onMouseLeave={() => setHoverProgress(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const ratio = (e.clientX - rect.left) / rect.width;
                  seekTo(ratio * duration);
                }}
              >
                <div className="absolute inset-0 rounded-full bg-white/10" /><div className="absolute left-0 top-0 h-full rounded-full bg-white/25" style={{width:`${bufferedPercent}%`}}/>
                {hoverProgress !== null && (
                  <div
                    className="absolute top-0 left-0 h-full rounded-full bg-white/10"
                    style={{ width: `${hoverProgress}%` }}
                  />
                )}
                <div
                  className="absolute top-0 left-0 h-full rounded-full bg-purple-500 transition-[width] duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 -ml-1.5"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>
              <span className="min-w-[3rem]">{formatTime(duration)}</span>
              </div>
            )}

            {/* CONTROL BUTTONS */}
            {!liveMode&&onSelectEpisode&&<div className="mb-4 flex items-center justify-between gap-4 text-sm">
              <button type="button" aria-label="Abrir episódios" onClick={event=>{event.stopPropagation();onSelectSeason?.(season||episodeListSeason||1);setShowEpisodes(true);clearHideTimeout();}} className="flex items-center gap-2 rounded px-2 py-2 font-semibold text-white/80 hover:bg-white/10 hover:text-white"><ListVideo className="h-5 w-5"/>Episódios</button>
              {nextEpisode&&nearEnd&&<button type="button" aria-label={`Próximo episódio T${nextEpisode.season} Ep.${nextEpisode.episode}`} onClick={event=>{event.stopPropagation();onSelectEpisode(nextEpisode.season,nextEpisode.episode);}} className="flex items-center gap-2 rounded-lg border border-purple-500/50 bg-purple-500/15 px-3 py-2 text-white hover:bg-purple-500/30"><SkipForward className="h-4 w-4"/><span>Próximo episódio <span className="text-white/65">T{nextEpisode.season} Ep.{nextEpisode.episode}</span></span>{nextPreparing&&<Loader2 className="h-3 w-3 animate-spin"/>}</button>}
            </div>}
            <div className="player-button-row premium-transport flex items-center justify-between">
              {/* CENTER: Playback */}
              <div className="flex items-center gap-5">
                {!liveMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    jump(-10);
                  }}
                  className="text-white/70 hover:text-white transition-all duration-200 p-1.5 rounded-md hover:bg-white/[0.08] relative"
                  aria-label="Retroceder 10s"
                >
                  <RotateCcw className="w-6 h-6" />
                  <span className="absolute text-[9px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[1px]">
                    10
                  </span>
                </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="premium-play-toggle"
                  aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7" />
                  ) : (
                    <Play className="w-7 h-7 ml-0.5" />
                  )}
                </button>

                {!liveMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    jump(10);
                  }}
                  className="text-white/70 hover:text-white transition-all duration-200 p-1.5 rounded-md hover:bg-white/[0.08] relative"
                  aria-label="Avançar 10s"
                >
                  <RotateCw className="w-6 h-6" />
                  <span className="absolute text-[9px] font-bold top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[1px]">
                    10
                  </span>
                </button>
                )}
              </div>

              {/* LEFT: Volume */}
              <div className="flex items-center gap-2 min-w-[140px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className="text-white/70 hover:text-white transition-all duration-200 p-1.5 rounded-md hover:bg-white/[0.08]"
                  aria-label={isMuted ? "Ativar som" : "Silenciar"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    e.stopPropagation();
                    changeVolume(Number(e.target.value));
                    handleActivity();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-20 accent-purple-500"
                />
              </div>

              {/* RIGHT: Audio, Subs, Fullscreen */}
              <div className="flex items-center gap-3 min-w-[140px] justify-end relative">
                {!liveMode && (
                  <>
                {/* Audio Track */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAudioMenu((v) => !v);
                      setShowSubMenu(false);
                      handleActivity();
                    }}
                    className="text-white/70 hover:text-white transition-all duration-200 p-1.5 rounded-md hover:bg-white/[0.08]"
                    aria-label="Faixa de áudio"
                  >
                    <Languages className="w-5 h-5" />
                  </button>
                  {showAudioMenu && (
                    <div
                      className="player-settings-panel absolute bottom-full right-0 mb-2 min-w-[160px] bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 px-4">
                        Áudio
                      </p>
                      {switchingLanguage&&<p role="status" className="px-4 pb-3 text-xs leading-5 text-purple-200/75">Preparando a outra versão. O vídeo atual continua tocando.</p>}
                      {languageError&&<p role="alert" className="px-4 pb-3 text-xs leading-5 text-amber-200/80">{languageError}</p>}
                      {languageOptions.map((option) => (
                        <button key={option.id} disabled={!option.available || loading || switchingLanguage!==null}
                          onClick={() => changeLanguage(option.id)}
                          aria-pressed={language === option.id}
                          title={option.available ? option.label : "Versão indisponível na origem"}
                          className={language === option.id
                            ? "block w-full text-left px-4 py-2 text-sm text-purple-400 font-semibold hover:bg-white/[0.08] transition-colors"
                            : "block w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors"}>
                          {switchingLanguage===option.id?<Loader2 className="inline mr-2 h-3 w-3 animate-spin"/>:language === option.id ? "✓ " : ""}{option.label}{!option.available ? " · Indisponível" : ""}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Subtitles */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSubMenu((v) => !v);
                      setShowAudioMenu(false);
                      handleActivity();
                    }}
                    className="text-white/70 hover:text-white transition-all duration-200 p-1.5 rounded-md hover:bg-white/[0.08]"
                    aria-label="Legendas"
                  >
                    <Subtitles className="w-5 h-5" />
                  </button>
                  {showSubMenu && (
                    <div
                      className="player-settings-panel absolute bottom-full right-0 mb-2 min-w-[160px] bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 px-4">
                        Legendas
                      </p>
                      <p className="px-4 py-2 text-xs leading-relaxed text-white/65 max-w-[230px]">As legendas, quando disponíveis, vêm incorporadas à versão legendada.</p><button onClick={()=>{setShowSubMenu(false);setShowAudioMenu(true);}} className="px-4 py-2 text-sm text-purple-300">Escolher versão do vídeo</button>
                    </div>
                  )}
                </div>
                  </>
                )}

                {/* Fullscreen */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFullscreen();
                  }}
                  className="text-white/70 hover:text-white transition-all duration-200 p-1.5 rounded-md hover:bg-white/[0.08]"
                  aria-label={
                    isFullscreen ? "Sair da tela cheia" : "Tela cheia"
                  }
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-5 h-5" />
                  ) : (
                    <Maximize2 className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {!liveMode&&nextEpisode&&nearEnd&&duration-currentTime>0&&!showEpisodes&&!error&&<div className="premium-up-next absolute right-5 bottom-48 z-30 rounded-xl border border-purple-500/30 bg-black/85 p-4 text-white shadow-xl backdrop-blur-md">
        <p className="text-xs text-white/60">A seguir · em {Math.ceil(duration-currentTime)}s</p>
        <button type="button" onClick={()=>onSelectEpisode?.(nextEpisode.season,nextEpisode.episode)} className="mt-2 flex items-center gap-2 font-semibold"><Play className="h-4 w-4 fill-current"/>T{nextEpisode.season} Ep.{nextEpisode.episode}: {nextEpisode.name}</button>
      </div>}
      {autoplayBlocked&&!loading&&!error&&<button type="button" onClick={()=>{void videoRef.current?.play().then(()=>setAutoplayBlocked(false)).catch(()=>{});}} className="absolute inset-0 z-30 flex items-center justify-center gap-3 bg-black/40 text-white"><Play className="h-8 w-8"/>Toque para continuar</button>}
      {showEpisodes&&episodes&&<EpisodeDrawer episodes={episodes} seasons={seasons||[]} selectedSeason={episodeListSeason||season||1} activeSeason={season} activeEpisode={episode} loading={episodeListLoading} onClose={()=>{setShowEpisodes(false);handleActivity();}} onSeasonChange={onSelectSeason} onPrepare={onPrepareEpisode} onSelect={(s,e)=>{setShowEpisodes(false);onSelectEpisode?.(s,e);}}/>}
    </div>
  );
}
