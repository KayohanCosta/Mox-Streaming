import { useEffect, useRef, useState, useCallback } from "react";
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
    eNum?: number
  ) => Promise<string>;
  certification?: string;
}

export default function IPTVPlayer({
  contentTitle,
  year,
  source,
  season,
  episode,
  getStreamUrl,
  certification,
}: IPTVPlayerProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.6);
  const [isMuted, setIsMuted] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(false);

  /* ================= STREAM ================= */

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const url = await getStreamUrl(source, season, episode);
        if (!active) return;

        if (!url) {
          setError("Nenhum stream encontrado.");
        } else {
          setStreamUrl(url);
        }
      } catch {
        if (active) setError("Erro ao carregar stream.");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [getStreamUrl, source, season, episode]);

  /* ================= VIDEO EVENTS ================= */

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setDuration(video.duration || 0);
      video.volume = volume;
      video.play().catch(() => {});
    };

    const onTime = () => {
      if (!isSeeking) setCurrentTime(video.currentTime);
    };
    const onPlay = () => {
      setIsPlaying(true);
      isPlayingRef.current = true;
      scheduleHide();
    };
    const onPause = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      setShowOverlay(true);
      clearHideTimeout();
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);

    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
    };
  }, [streamUrl, isSeeking]);

  /* ================= FULLSCREEN ================= */

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  /* ================= OVERLAY AUTO-HIDE ================= */

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
    video.paused ? video.play() : video.pause();
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, time));
    setCurrentTime(video.currentTime);
    handleActivity();
  };

  const jump = (delta: number) => seekTo(currentTime + delta);

  const changeVolume = (v: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0, Math.min(1, v));
    video.volume = clamped;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      changeVolume(0.6);
      setIsMuted(false);
    } else {
      const video = videoRef.current;
      if (video) video.volume = 0;
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

  /* ================= RENDER ================= */

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col w-full h-full select-none bg-black overflow-hidden outline-none ${
        showOverlay ? "cursor-default" : "cursor-none"
      }`}
      tabIndex={0}
    >
      {/* VIDEO */}
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        {loading ? (
          <Loader2 className="w-16 h-16 animate-spin text-white/50" />
        ) : error ? (
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="w-12 h-12 text-red-500" />
            <p className="text-white text-center text-sm max-w-xs">{error}</p>
          </div>
        ) : streamUrl ? (
          <video
            ref={videoRef}
            src={streamUrl}
            className="w-full h-full object-contain"
            playsInline
          />
        ) : null}
      </div>

      {/* BUFFERING */}
      {isBuffering && streamUrl && (
        <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-3 border-white/15 border-t-purple-500 rounded-full animate-spin" />
        </div>
      )}

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
        <div className="p-5 pb-16">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {/* Botão de voltar */}
              <button
                onClick={() => window.history.back()}
                className="pointer-events-auto mr-2 p-1.5 rounded-md hover:bg-white/10 transition-colors"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-7 h-7 text-white drop-shadow-lg" />
              </button>
                  <div>
                    <h3 className="text-white text-2xl font-semibold tracking-tight leading-tight drop-shadow-lg">
                      {contentTitle}
                    </h3>
                    {year && (
                      <p className="text-white/60 text-lg mt-0.5 drop-shadow">
                        {year}
                      </p>
                    )}
              </div>
            </div>
                <div
                  className={`${getCertColor()} text-white font-bold text-base px-3 py-4 rounded-lg drop-shadow-lg flex items-center justify-center mr-6`}
                  style={{ minWidth: 56, minHeight: 44 }}
                >
                  {certLabel}
                </div>
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
          <div className="px-5 pt-16 pb-5">
            {/* PROGRESS BAR */}
            <div className="mb-3 flex items-center gap-3 text-white/80 text-xs font-mono">
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
                <div className="absolute inset-0 rounded-full bg-white/20" />
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

            {/* CONTROL BUTTONS */}
            <div className="flex items-center justify-between">
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

              {/* CENTER: Playback */}
              <div className="flex items-center gap-5">
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

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePlay();
                  }}
                  className="w-14 h-14 rounded-full flex items-center justify-center text-white border-2 border-purple-500 bg-purple-500/15 hover:bg-purple-500/30 hover:scale-105 transition-all duration-200 hover:shadow-[0_0_24px_rgba(168,85,247,0.4)]"
                  aria-label={isPlaying ? "Pausar" : "Reproduzir"}
                >
                  {isPlaying ? (
                    <Pause className="w-7 h-7" />
                  ) : (
                    <Play className="w-7 h-7 ml-0.5" />
                  )}
                </button>

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
              </div>

              {/* RIGHT: Audio, Subs, Fullscreen */}
              <div className="flex items-center gap-3 min-w-[140px] justify-end relative">
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
                      className="absolute bottom-full right-0 mb-2 min-w-[160px] bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 px-4">
                        Áudio
                      </p>
                      <button className="block w-full text-left px-4 py-2 text-sm text-purple-400 font-semibold hover:bg-white/[0.08] transition-colors">
                        ✓ Português (Original)
                      </button>
                      <button className="block w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors">
                        English
                      </button>
                      <button className="block w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors">
                        Español
                      </button>
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
                      className="absolute bottom-full right-0 mb-2 min-w-[160px] bg-black/95 backdrop-blur-xl border border-white/10 rounded-lg py-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.6)]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1 px-4">
                        Legendas
                      </p>
                      <button className="block w-full text-left px-4 py-2 text-sm text-purple-400 font-semibold hover:bg-white/[0.08] transition-colors">
                        ✓ Desativadas
                      </button>
                      <button className="block w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors">
                        Português
                      </button>
                      <button className="block w-full text-left px-4 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white transition-colors">
                        English
                      </button>
                    </div>
                  )}
                </div>

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
    </div>
  );
}
