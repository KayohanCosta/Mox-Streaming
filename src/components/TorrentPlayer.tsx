import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Play, HardDrive, AlertTriangle, Film, Tv, Volume2 } from "lucide-react";

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

const TRACKERS = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://tracker.bittor.pw:1337/announce",
  "udp://public.popcorn-tracker.org:6969/announce",
  "udp://tracker.dler.org:6969/announce",
  "udp://exodus.desync.com:6969",
  "udp://open.demonii.com:1337/announce",
].map((t) => `&tr=${encodeURIComponent(t)}`).join("");

export default function TorrentPlayer({ contentTitle, year, type, season, episode }: TorrentPlayerProps) {
  const [streams, setStreams] = useState<TorrentStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<TorrentStream | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  // Fetch streams via edge function
  useEffect(() => {
    async function fetchStreams() {
      try {
        setLoading(true);
        setError(null);

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
      setError("Título não disponível para busca de torrents.");
    }
  }, [contentTitle, year, type, season, episode]);

  // Load webtor SDK once
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    const existing = document.querySelector('script[src*="webtor"]');
    if (existing) {
      scriptLoadedRef.current = true;
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@webtor/embed-sdk-js/dist/index.min.js";
    script.async = true;
    script.charset = "utf-8";
    script.onload = () => {
      scriptLoadedRef.current = true;
    };
    document.head.appendChild(script);
  }, []);

  const playStream = useCallback((stream: TorrentStream) => {
    setSelectedStream(stream);
    setPlayerReady(false);

    const magnet = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.name)}${TRACKERS}`;

    const initPlayer = () => {
      if (!playerRef.current) return;

      playerRef.current.innerHTML = "";
      const playerDiv = document.createElement("div");
      playerDiv.id = `webtor-player-${Date.now()}`;
      playerDiv.style.width = "100%";
      playerDiv.style.height = "100%";
      playerRef.current.appendChild(playerDiv);

      const w = window as any;
      w.webtor = w.webtor || [];
      w.webtor.push({
        id: playerDiv.id,
        magnet,
        on: (e: any) => {
          if (e.name === w.webtor.INITED) {
            setPlayerReady(true);
            e.api.play();
          }
        },
        features: { p2pRecovery: true },
        lang: "pt",
      });
    };

    if (scriptLoadedRef.current) {
      setTimeout(initPlayer, 100);
    } else {
      const interval = setInterval(() => {
        if (scriptLoadedRef.current) {
          clearInterval(interval);
          initPlayer();
        }
      }, 200);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
        <p className="text-muted-foreground">Buscando torrents disponíveis...</p>
      </div>
    );
  }

  if (error && streams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="w-12 h-12 text-destructive" />
        <p className="text-foreground/80 text-center">{error}</p>
      </div>
    );
  }

  // Player view
  if (selectedStream) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-4 py-2 bg-card/60 border-b border-border/20">
          <button
            onClick={() => {
              setSelectedStream(null);
              setPlayerReady(false);
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Voltar à lista
          </button>
          <span className="text-xs text-foreground/60 truncate flex-1">
            {selectedStream.name}
          </span>
          {!playerReady && (
            <span className="flex items-center gap-1 text-xs text-primary">
              <Loader2 className="w-3 h-3 animate-spin" /> Preparando stream...
            </span>
          )}
        </div>
        <div ref={playerRef} className="flex-1 bg-black" />
      </div>
    );
  }

  // Stream list
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-border/20">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary" />
          Torrents Disponíveis
          <span className="text-xs text-muted-foreground font-normal">
            ({streams.length} encontrados)
          </span>
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 py-2 space-y-2">
        {streams.map((stream, i) => (
          <button
            key={`${stream.infoHash}-${i}`}
            onClick={() => playStream(stream)}
            className="w-full flex items-center gap-4 p-3 rounded-lg bg-card/50 hover:bg-card border border-border/20 hover:border-primary/30 transition-all group text-left"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
              <Play className="w-5 h-5 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold bg-secondary/80 px-2 py-0.5 rounded">
                  {stream.quality}
                </span>
                {stream.ptBr && (
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                    <Volume2 className="w-3 h-3" />
                    🇧🇷 PT-BR/Dual
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground/70 truncate mb-1">{stream.name}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>💾 {stream.size}</span>
                <span>👤 {stream.seeds} seeds</span>
                <span>📥 {stream.leechers} leechers</span>
              </div>
            </div>

            {type === "movie" ? (
              <Film className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            ) : (
              <Tv className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
