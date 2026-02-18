import { useState, useEffect, useRef } from "react";
import { Loader2, AlertTriangle, Volume2, Wifi, HardDrive, Play } from "lucide-react";

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
    "udp://tracker.internetwarriors.net:1337/announce",
    "udp://tracker.leechers-paradise.org:6969/announce",
  ].map((t) => `&tr=${encodeURIComponent(t)}`).join("");

  return `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.name)}${trackers}`;
}

interface WebTorrentFile {
  name: string;
  length: number;
  renderTo: (el: HTMLElement, opts?: { autoplay?: boolean; muted?: boolean }, cb?: (err: Error | null, elem: HTMLElement) => void) => void;
  getBlobURL: (cb: (err: Error | null, url: string) => void) => void;
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
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  destroy: () => void;
}

interface WebTorrentClient {
  add: (magnetOrHash: string, opts: Record<string, unknown>, cb?: (torrent: WebTorrentTorrent) => void) => WebTorrentTorrent;
  destroy: (cb?: () => void) => void;
}

// WebTorrent Player Component
function WebTorrentVideoPlayer({ stream, onBack }: { stream: TorrentStream; onBack: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<WebTorrentClient | null>(null);
  const [status, setStatus] = useState<"connecting" | "downloading" | "playing" | "error">("connecting");
  const [progress, setProgress] = useState(0);
  const [downloadSpeed, setDownloadSpeed] = useState(0);
  const [numPeers, setNumPeers] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let destroyed = false;
    let torrent: WebTorrentTorrent | null = null;

    async function startTorrent() {
      try {
        setStatus("connecting");

        // Dynamically import WebTorrent (browser-compatible)
        const WebTorrent = (await import("webtorrent")).default;
        if (destroyed) return;

        const client: WebTorrentClient = new WebTorrent() as unknown as WebTorrentClient;
        clientRef.current = client;

        const magnet = getMagnetLink(stream);
        setStatus("downloading");

        torrent = client.add(magnet, { announce: [] }, (t: WebTorrentTorrent) => {
          if (destroyed) return;

          // Find the largest video file
          const videoFile = t.files
            .filter((f) => /\.(mp4|mkv|avi|mov|webm|m4v|ts)$/i.test(f.name))
            .sort((a, b) => b.length - a.length)[0];

          if (!videoFile) {
            setStatus("error");
            setErrorMsg("Nenhum arquivo de vídeo encontrado neste torrent.");
            return;
          }

          if (videoRef.current) {
            videoFile.renderTo(videoRef.current, { autoplay: true }, (err) => {
              if (err) {
                // Fallback: getBlobURL
                videoFile.getBlobURL((blobErr, url) => {
                  if (blobErr || !url) {
                    setStatus("error");
                    setErrorMsg("Erro ao carregar o vídeo. Tente outro torrent.");
                    return;
                  }
                  if (videoRef.current && !destroyed) {
                    videoRef.current.src = url;
                    videoRef.current.play().catch(() => {});
                    setStatus("playing");
                  }
                });
              } else {
                if (!destroyed) setStatus("playing");
              }
            });
          }
        });

        if (torrent) {
          torrent.on("download", () => {
            if (destroyed) return;
            setProgress(Math.round((torrent!.progress || 0) * 100));
            setDownloadSpeed(Math.round((torrent!.downloadSpeed || 0) / 1024));
            setNumPeers(torrent!.numPeers || 0);
          });

          torrent.on("error", (err: unknown) => {
            if (destroyed) return;
            setStatus("error");
            setErrorMsg(err instanceof Error ? err.message : "Erro no torrent. Tente outro.");
          });
        }
      } catch (e) {
        if (!destroyed) {
          setStatus("error");
          setErrorMsg(e instanceof Error ? e.message : "Erro ao iniciar o WebTorrent.");
        }
      }
    }

    startTorrent();

    return () => {
      destroyed = true;
      if (clientRef.current) {
        try { clientRef.current.destroy(); } catch { /* ignore */ }
        clientRef.current = null;
      }
    };
  }, [stream]);

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Info bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card/80 border-b border-border/30 flex-shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {stream.ptBr && (
            <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
              style={{ color: "hsl(142 70% 45%)", borderColor: "hsl(142 70% 45% / 0.3)", backgroundColor: "hsl(142 70% 45% / 0.1)" }}>
              🇧🇷 <Volume2 className="w-2.5 h-2.5" />
            </span>
          )}
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${qualityColor(stream.quality)}`}>
            {stream.quality}
          </span>
          <span className="text-xs text-muted-foreground truncate">{stream.name}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {status === "downloading" && (
            <>
              <span className="text-xs text-green-400">{numPeers} peers</span>
              <span className="text-xs text-blue-400">{downloadSpeed} KB/s</span>
              <span className="text-xs text-muted-foreground">{progress}%</span>
            </>
          )}
          <span className="flex items-center gap-1 text-xs" style={{ color: "hsl(142 70% 45%)" }}>
            <Wifi className="w-3 h-3" /> {stream.seeds}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <HardDrive className="w-3 h-3" /> {stream.size}
          </span>
          <button onClick={onBack} className="text-xs text-primary hover:text-primary/80 underline">
            Trocar
          </button>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative flex items-center justify-center" ref={containerRef}>
        {/* Status overlay */}
        {status !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/80 gap-4">
            {status === "connecting" && (
              <>
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Conectando aos peers...</p>
              </>
            )}
            {status === "downloading" && (
              <>
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-sm font-medium text-foreground">Carregando stream...</p>
                <p className="text-xs text-muted-foreground">{numPeers} peers · {downloadSpeed} KB/s · {progress}%</p>
                <div className="w-48 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${Math.max(progress, 2)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground/60">O vídeo iniciará automaticamente quando houver dados suficientes</p>
              </>
            )}
            {status === "error" && (
              <>
                <AlertTriangle className="w-10 h-10 text-destructive" />
                <p className="text-sm text-destructive text-center px-4">{errorMsg}</p>
                <button
                  onClick={onBack}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
                >
                  Tentar outro torrent
                </button>
              </>
            )}
          </div>
        )}
        <video
          ref={videoRef}
          className="w-full h-full"
          controls
          autoPlay
          style={{ maxHeight: "calc(100vh - 100px)" }}
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
          setError("Nenhum torrent encontrado para este conteúdo.");
        } else {
          setStreams(allStreams);
        }
      } catch {
        setError("Não foi possível buscar torrents. Tente novamente.");
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
    return (
      <WebTorrentVideoPlayer
        stream={selectedStream}
        onBack={() => setSelectedStream(null)}
      />
    );
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

  // Torrent list
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex-shrink-0">
        <h3 className="text-sm font-bold text-foreground">
          {streams.length} torrents encontrados
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Selecione um torrent com mais seeds para melhor experiência
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
