import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, AlertTriangle, Volume2, Wifi, HardDrive, Play, ArrowLeft, Users, Download } from "lucide-react";

interface TorrentStream {
  name: string;
  title: string;
  infoHash: string;
  seeds: number;
  leechers: number;
  size: string;
  quality: string;
  ptBr: boolean;
}

interface TorrentPlayerProps {
  contentTitle: string;
  year?: string;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
}

function qualityColor(q: string) {
  if (q === "4K") return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
  if (q === "1080p") return "text-blue-400 border-blue-400/30 bg-blue-400/10";
  if (q === "720p") return "text-green-400 border-green-400/30 bg-green-400/10";
  return "text-muted-foreground border-border bg-secondary/30";
}

function getMagnetLink(stream: TorrentStream): string {
  const trackers = [
    "udp://tracker.opentrackr.org:1337/announce",
    "udp://open.stealth.si:80/announce",
    "udp://tracker.torrent.eu.org:451/announce",
    "udp://exodus.desync.com:6969/announce",
    "udp://open.demonii.com:1337/announce",
    "udp://tracker.openbittorrent.com:6969/announce",
    "wss://tracker.btorrent.xyz",
    "wss://tracker.openwebtorrent.com",
    "wss://tracker.webtorrent.dev",
  ].map((t) => `&tr=${encodeURIComponent(t)}`).join("");
  return `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.name)}${trackers}`;
}

// Declare WebTorrent global loaded from CDN
declare global {
  interface Window {
    WebTorrent: new () => WebTorrentClient;
  }
}

interface WebTorrentFile {
  name: string;
  length: number;
  renderTo: (
    el: HTMLElement | string,
    opts?: Record<string, unknown>,
    cb?: (err: Error | null, elem: HTMLElement) => void
  ) => void;
  getBlobURL: (cb: (err: Error | null, url: string) => void) => void;
  streamTo: (elem: HTMLVideoElement) => void;
}

interface WebTorrentTorrent {
  files: WebTorrentFile[];
  progress: number;
  downloadSpeed: number;
  uploadSpeed: number;
  numPeers: number;
  downloaded: number;
  length: number;
  done: boolean;
  ready: boolean;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  off: (event: string, cb: (...args: unknown[]) => void) => void;
  destroy: (cb?: () => void) => void;
}

interface WebTorrentClient {
  add: (
    magnetOrHash: string,
    opts?: Record<string, unknown>,
    cb?: (torrent: WebTorrentTorrent) => void
  ) => WebTorrentTorrent;
  destroy: (cb?: () => void) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
}

function loadWebTorrentCDN(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.WebTorrent) return resolve();
    const existing = document.getElementById("webtorrent-cdn");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", reject);
      return;
    }
    const script = document.createElement("script");
    script.id = "webtorrent-cdn";
    script.src = "https://cdn.jsdelivr.net/npm/webtorrent@latest/webtorrent.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar WebTorrent"));
    document.head.appendChild(script);
  });
}

// WebTorrent Video Player using CDN build
function WebTorrentVideoPlayer({ stream, onBack }: { stream: TorrentStream; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clientRef = useRef<WebTorrentClient | null>(null);
  const [status, setStatus] = useState<"loading-lib" | "connecting" | "buffering" | "playing" | "error">("loading-lib");
  const [progress, setProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [numPeers, setNumPeers] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const destroyedRef = useRef(false);

  const formatSpeed = (bps: number) => {
    if (bps >= 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`;
    if (bps >= 1024) return `${(bps / 1024).toFixed(0)} KB/s`;
    return `${bps} B/s`;
  };

  const startStreaming = useCallback(async () => {
    destroyedRef.current = false;
    try {
      setStatus("loading-lib");
      await loadWebTorrentCDN();
      if (destroyedRef.current) return;

      setStatus("connecting");
      const client = new window.WebTorrent();
      clientRef.current = client;

      client.on("error", (err: unknown) => {
        if (destroyedRef.current) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Erro no cliente WebTorrent");
      });

      const magnet = getMagnetLink(stream);

      const torrent = client.add(magnet, {}, (t: WebTorrentTorrent) => {
        if (destroyedRef.current) return;

        // Find largest video file
        const videoFile = [...t.files]
          .filter((f) => /\.(mp4|mkv|avi|mov|webm|m4v|ts|ogv)$/i.test(f.name))
          .sort((a, b) => b.length - a.length)[0];

        if (!videoFile) {
          setStatus("error");
          setErrorMsg("Nenhum arquivo de vídeo encontrado neste torrent.");
          return;
        }

        setStatus("buffering");

        // Use renderTo with the video element
        videoFile.renderTo(videoRef.current!, { autoplay: true, muted: false }, (err) => {
          if (destroyedRef.current) return;
          if (err) {
            // Fallback: getBlobURL
            videoFile.getBlobURL((blobErr, url) => {
              if (destroyedRef.current) return;
              if (blobErr || !url) {
                setStatus("error");
                setErrorMsg("Erro ao carregar o vídeo. Tente outro torrent com mais seeds.");
                return;
              }
              if (videoRef.current) {
                videoRef.current.src = url;
                videoRef.current.play().catch(() => {});
                setStatus("playing");
              }
            });
          } else {
            setStatus("playing");
          }
        });
      });

      // Progress tracking
      const onDownload = () => {
        if (destroyedRef.current) return;
        setProgress(Math.round((torrent.progress || 0) * 100));
        setDownloadSpeed(torrent.downloadSpeed || 0);
        setNumPeers(torrent.numPeers || 0);
      };

      torrent.on("download", onDownload);
      torrent.on("noPeers", () => {
        if (destroyedRef.current) return;
        setNumPeers(0);
      });
      torrent.on("error", (err: unknown) => {
        if (destroyedRef.current) return;
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Erro no torrent. Tente outro com mais seeds.");
      });

      // Poll progress every 2s
      const interval = setInterval(() => {
        if (destroyedRef.current) { clearInterval(interval); return; }
        setProgress(Math.round((torrent.progress || 0) * 100));
        setDownloadSpeed(torrent.downloadSpeed || 0);
        setNumPeers(torrent.numPeers || 0);
      }, 2000);

      // Store interval cleanup
      (clientRef as unknown as { interval?: ReturnType<typeof setInterval> }).interval = interval;

    } catch (e) {
      if (!destroyedRef.current) {
        setStatus("error");
        setErrorMsg(e instanceof Error ? e.message : "Erro ao iniciar streaming.");
      }
    }
  }, [stream]);

  useEffect(() => {
    startStreaming();
    return () => {
      destroyedRef.current = true;
      const c = clientRef as unknown as { interval?: ReturnType<typeof setInterval> };
      if (c.interval) clearInterval(c.interval);
      if (clientRef.current) {
        try { clientRef.current.destroy(); } catch { /* ignore */ }
        clientRef.current = null;
      }
    };
  }, [startStreaming]);

  const isLoading = status === "loading-lib" || status === "connecting" || status === "buffering";

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Info bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-black/90 border-b border-white/10 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors flex-shrink-0"
          >
            <ArrowLeft className="w-3 h-3" /> Trocar
          </button>
          {stream.ptBr && (
            <span className="flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0"
              style={{ color: "hsl(142 70% 45%)", borderColor: "hsl(142 70% 45% / 0.3)", backgroundColor: "hsl(142 70% 45% / 0.1)" }}>
              🇧🇷 <Volume2 className="w-2.5 h-2.5" />
            </span>
          )}
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${qualityColor(stream.quality)}`}>
            {stream.quality}
          </span>
          <span className="text-xs text-white/40 truncate hidden sm:block">{stream.name}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 text-xs">
          <span className="flex items-center gap-1 text-green-400">
            <Users className="w-3 h-3" /> {numPeers}
          </span>
          <span className="flex items-center gap-1 text-blue-400">
            <Download className="w-3 h-3" /> {formatSpeed(downloadSpeed)}
          </span>
          <span className="flex items-center gap-1" style={{ color: "hsl(142 70% 45%)" }}>
            <Wifi className="w-3 h-3" /> {stream.seeds}
          </span>
          <span className="text-white/40 flex items-center gap-1">
            <HardDrive className="w-3 h-3" /> {stream.size}
          </span>
        </div>
      </div>

      {/* Video + overlay */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black gap-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-white">
                {status === "loading-lib" && "Carregando player..."}
                {status === "connecting" && "Conectando aos peers..."}
                {status === "buffering" && "Buffering..."}
              </p>
              {numPeers > 0 && (
                <p className="text-xs text-white/50">{numPeers} peers · {formatSpeed(downloadSpeed)}</p>
              )}
              {progress > 0 && (
                <div className="w-48 h-1 bg-white/10 rounded-full overflow-hidden mx-auto mt-2">
                  <div className="h-full bg-primary transition-all duration-500 rounded-full" style={{ width: `${Math.max(progress, 1)}%` }} />
                </div>
              )}
              <p className="text-xs text-white/30 mt-2 max-w-xs">
                Streaming P2P direto no navegador. Aguarde os peers se conectarem.
              </p>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black gap-4 px-6">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <p className="text-sm text-white/70 text-center">{errorMsg}</p>
            <button
              onClick={onBack}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Escolher outro torrent
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          controls
          autoPlay
          playsInline
          style={{ display: status === "error" ? "none" : "block" }}
        />
      </div>
    </div>
  );
}

export default function TorrentPlayer({ contentTitle, year, type, season, episode }: TorrentPlayerProps) {
  const [streams, setStreams] = useState<TorrentStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<TorrentStream | null>(null);

  useEffect(() => {
    async function fetchStreams() {
      try {
        setLoading(true);
        setError(null);
        setSelectedStream(null);
        setStreams([]);

        let searchQuery = contentTitle;
        if (year) searchQuery += ` ${year}`;
        if (type === "tv" && season && episode) {
          searchQuery += ` S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

        const res = await fetch(
          `${supabaseUrl}/functions/v1/torrent-search?q=${encodeURIComponent(searchQuery)}&type=${type}`,
          {
            headers: {
              Authorization: `Bearer ${supabaseKey}`,
              apikey: supabaseKey,
            },
          }
        );

        if (!res.ok) throw new Error("Falha ao buscar torrents");

        const data = await res.json();
        const allStreams: TorrentStream[] = data.streams || [];

        if (allStreams.length === 0) {
          setError("Nenhum torrent encontrado. Tente buscar por outro título.");
        } else {
          setStreams(allStreams);
        }
      } catch {
        setError("Não foi possível buscar torrents. Verifique sua conexão.");
      } finally {
        setLoading(false);
      }
    }

    if (contentTitle) {
      fetchStreams();
    } else {
      setLoading(false);
      setError("Título não disponível.");
    }
  }, [contentTitle, year, type, season, episode]);

  if (selectedStream) {
    return <WebTorrentVideoPlayer stream={selectedStream} onBack={() => setSelectedStream(null)} />;
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Buscando torrents disponíveis...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
        <AlertTriangle className="w-10 h-10 text-destructive" />
        <p className="text-sm text-muted-foreground text-center">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex-shrink-0">
        <h3 className="text-sm font-bold text-foreground">
          {streams.length} torrents encontrados
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          🇧🇷 PT-BR primeiro · Selecione com mais seeds para melhor streaming
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-2">
        {streams.map((stream, i) => (
          <button
            key={stream.infoHash + i}
            onClick={() => setSelectedStream(stream)}
            className="w-full text-left bg-card/50 hover:bg-card border border-border/30 hover:border-primary/40 rounded-lg p-3 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="flex flex-col gap-1.5 flex-shrink-0 mt-0.5">
                {stream.ptBr && (
                  <span
                    className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border"
                    style={{ color: "hsl(142 70% 45%)", borderColor: "hsl(142 70% 45% / 0.3)", backgroundColor: "hsl(142 70% 45% / 0.1)" }}
                  >
                    🇧🇷 <Volume2 className="w-2.5 h-2.5" />
                  </span>
                )}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border text-center ${qualityColor(stream.quality)}`}>
                  {stream.quality}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed group-hover:text-foreground transition-colors">
                  {stream.name}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="flex items-center gap-1 text-xs" style={{ color: "hsl(142 70% 45%)" }}>
                    <Wifi className="w-3 h-3" />
                    <span className="font-medium">{stream.seeds}</span>
                    <span className="text-muted-foreground">seeds</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <HardDrive className="w-3 h-3" />
                    {stream.size}
                  </span>
                </div>
              </div>

              <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Play className="w-4 h-4 text-primary fill-current" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
