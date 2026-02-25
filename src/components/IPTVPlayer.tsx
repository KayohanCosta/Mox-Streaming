import { useEffect, useRef, useState, useCallback } from "react";
import {
  Loader2,
  AlertTriangle,
  Maximize2,
  Play,
  Pause,
  Volume2,
  VolumeX,
  SkipBack,
  SkipForward,
  Headphones,
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

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPlayingRef = useRef(false);
  const flashRef = useRef<NodeJS.Timeout | null>(null);
  const [flashActive, setFlashActive] = useState(false);

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

    const onTime = () => setCurrentTime(video.currentTime);
    const onPlay = () => {
      setIsPlaying(true);
      isPlayingRef.current = true;
      console.debug("IPTVPlayer: onPlay - show overlay (no timeout)");
      setShowOverlay(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
    const onPause = () => {
      setIsPlaying(false);
      isPlayingRef.current = false;
      console.debug("IPTVPlayer: onPause - show overlay and clear timeout");
      setShowOverlay(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
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
  }, [streamUrl]);

  /* ================= OVERLAY CONTROL (SIMPLES E ESTÁVEL) ================= */

  const handleOverlayActivity = useCallback(() => {
    // Sempre mostra o overlay
    console.debug("IPTVPlayer: overlay activity, isPlaying=" + isPlayingRef.current);
    setShowOverlay(true);

    // flash visual temporário para debug (mostra borda rápida)
    setFlashActive(true);
    if (flashRef.current) clearTimeout(flashRef.current);
    flashRef.current = setTimeout(() => setFlashActive(false), 400);

    // Limpa timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Se tá tocando, agenda desaparecimento após 3s
    if (isPlayingRef.current) {
      timeoutRef.current = setTimeout(() => {
        console.debug("IPTVPlayer: hiding overlay after timeout");
        setShowOverlay(false);
      }, 3000);
    }
  }, []);

  // Usaremos handlers React diretamente no container (mais previsível)

  /* ================= CONTROLES ================= */

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.paused ? video.play() : video.pause();
    handleOverlayActivity();
  };

  const seekTo = (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, time));
    handleOverlayActivity();
  };

  const jump = (delta: number) => {
    seekTo(currentTime + delta);
  };

  const changeVolume = (v: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = v;
    setVolume(v);
    setIsMuted(v === 0);
  };

  const toggleMute = () => {
    changeVolume(isMuted ? 0.6 : 0);
    handleOverlayActivity();
  };

  const handleFullscreen = () => {
    if (!containerRef.current) return;

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      containerRef.current.requestFullscreen().catch(() => {});
    }
    handleOverlayActivity();
  };

  const formatTime = (t: number) => {
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

  /* ================= RENDER ================= */

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col h-full bg-black rounded-2xl overflow-hidden cursor-pointer"
        onMouseMove={handleOverlayActivity}
        onPointerMove={handleOverlayActivity}
        onPointerDown={handleOverlayActivity}
        onTouchStart={handleOverlayActivity}
        onClick={() => togglePlay()}
    >
      {/* TÍTULO + CLASSIFICAÇÃO (SEMPRE INTERATIVO) */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 p-6 transition-opacity duration-300 pointer-events-none ${
          showOverlay ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-white text-lg font-bold drop-shadow">
              {contentTitle}
            </h3>
            {year && (
              <p className="text-white/70 text-sm drop-shadow">{year}</p>
            )}
          </div>
          <div className={`${getCertColor()} text-white font-bold text-sm px-2.5 py-1 rounded drop-shadow`}>
            {certLabel}
          </div>
        </div>
      </div>

      {/* VIDEO AREA */}
      <div className="flex-1 flex items-center justify-center relative bg-black">
        {loading ? (
          <Loader2 className="w-16 h-16 animate-spin text-white/60" />
        ) : error ? (
          <div className="flex flex-col items-center gap-3">
            <AlertTriangle className="w-12 h-12 text-red-500" />
            <p className="text-white text-center text-sm">{error}</p>
          </div>
        ) : streamUrl ? (
          <video
            ref={videoRef}
            src={streamUrl}
            className="w-full h-full object-contain pointer-events-none"
            playsInline
          />
        ) : null}
      </div>

      {/* BUFFER INDICATOR */}
      {isBuffering && streamUrl && (
        <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-12 h-12 animate-spin text-white/80" />
        </div>
      )}

      {/* CONTROLES INFERIORES */}
      {streamUrl && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-30 px-6 pb-6 transition-opacity duration-300 pointer-events-none ${
            showOverlay ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* Progress Bar */}
          <div className="mb-4 flex items-center gap-2 text-white text-xs">
            <span className="min-w-fit">{formatTime(currentTime)}</span>
            <div
              className="relative h-2 flex-1 bg-white/20 rounded cursor-pointer hover:h-3 transition-all pointer-events-auto"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                seekTo(ratio * duration);
              }}
            >
              <div
                className="h-full bg-purple-500 rounded transition-all"
                style={{
                  width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="min-w-fit">{formatTime(duration)}</span>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between pointer-events-auto">
            {/* Left: Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="text-white/70 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-6 h-6" />
                ) : (
                  <Volume2 className="w-6 h-6" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => {
                  changeVolume(Number(e.target.value));
                  handleOverlayActivity();
                }}
                className="w-24 accent-purple-500"
              />
            </div>

            {/* Center: Play Controls */}
            <div className="flex items-center gap-6">
              <button
                onClick={() => {
                  jump(-10);
                  handleOverlayActivity();
                }}
                className="text-white/70 hover:text-white transition-colors"
              >
                <SkipBack className="w-6 h-6" />
              </button>

              <button
                onClick={togglePlay}
                className="w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-700 flex items-center justify-center text-white transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6" />
                ) : (
                  <Play className="w-6 h-6 ml-0.5" />
                )}
              </button>

              <button
                onClick={() => {
                  jump(10);
                  handleOverlayActivity();
                }}
                className="text-white/70 hover:text-white transition-colors"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            {/* Right: Audio + Fullscreen */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-white/70">
                <Headphones className="w-5 h-5" />
              </div>
              <button
                onClick={handleFullscreen}
                className="text-white/70 hover:text-white transition-colors"
              >
                <Maximize2 className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}