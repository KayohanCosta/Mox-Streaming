import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Play, HardDrive, AlertTriangle, Film, Tv } from "lucide-react";

interface TorrentStream {
  name: string;
  title: string;
  infoHash: string;
  fileIdx?: number;
}

interface TorrentPlayerProps {
  imdbId: string;
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

function parseStreamInfo(title: string) {
  const lines = title.split("\n");
  const quality = lines[0] || "";
  const size = title.match(/💾\s*([\d.]+\s*[GMKT]B)/i)?.[1] || "";
  const seeds = title.match(/👤\s*(\d+)/)?.[1] || "0";
  const source = title.match(/⚙️\s*(.+)/)?.[1]?.trim() || "";
  const lang = title.match(/🇧🇷|Portugu|DUB|DUAL|PT-BR/i) ? "🇧🇷 PT-BR" : "";
  return { quality, size, seeds: Number(seeds), source, lang };
}

export default function TorrentPlayer({ imdbId, type, season, episode }: TorrentPlayerProps) {
  const [streams, setStreams] = useState<TorrentStream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStream, setSelectedStream] = useState<TorrentStream | null>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);
  const scriptLoadedRef = useRef(false);

  // Fetch streams from torrentio
  useEffect(() => {
    async function fetchStreams() {
      try {
        setLoading(true);
        setError(null);
        const mediaType = type === "movie" ? "movie" : "series";
        const idPart =
          type === "movie" ? imdbId : `${imdbId}:${season}:${episode}`;

        const res = await fetch(
          `https://torrentio.strem.fun/stream/${mediaType}/${idPart}.json`
        );

        if (!res.ok) throw new Error("Falha ao buscar torrents");

        const data = await res.json();
        const allStreams: TorrentStream[] = data.streams || [];

        // Prioritize PT-BR / Dual audio
        const ptStreams = allStreams.filter((s) => {
          const t = (s.title || "").toLowerCase();
          return (
            t.includes("dual") ||
            t.includes("dub") ||
            t.includes("portugu") ||
            t.includes("pt-br") ||
            t.includes("🇧🇷") ||
            t.includes("brazilian") ||
            t.includes("multi")
          );
        });

        // Sort by seeds (descending)
        const sort = (arr: TorrentStream[]) =>
          arr.sort((a, b) => {
            const seedsA = Number(a.title.match(/👤\s*(\d+)/)?.[1] || 0);
            const seedsB = Number(b.title.match(/👤\s*(\d+)/)?.[1] || 0);
            return seedsB - seedsA;
          });

        const sorted = sort(ptStreams.length > 0 ? ptStreams : allStreams);
        setStreams(sorted.slice(0, 25));

        if (sorted.length === 0) {
          setError("Nenhum torrent encontrado para este conteúdo.");
        }
      } catch {
        setError("Não foi possível buscar torrents. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    if (imdbId) {
      fetchStreams();
    } else {
      setLoading(false);
      setError("ID IMDB não disponível para este conteúdo. Não é possível buscar torrents.");
    }
  }, [imdbId, type, season, episode]);

  // Load webtor SDK once
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    const script = document.createElement("script");
    script.src =
      "https://cdn.jsdelivr.net/npm/@webtor/embed-sdk-js/dist/index.min.js";
    script.async = true;
    script.charset = "utf-8";
    script.onload = () => {
      scriptLoadedRef.current = true;
    };
    document.head.appendChild(script);
    return () => {
      try {
        document.head.removeChild(script);
      } catch {}
    };
  }, []);

  const playStream = useCallback(
    (stream: TorrentStream) => {
      setSelectedStream(stream);
      setPlayerReady(false);

      const magnet = `magnet:?xt=urn:btih:${stream.infoHash}${TRACKERS}`;

      // Wait for webtor SDK
      const initPlayer = () => {
        if (!playerRef.current) return;

        // Clear previous player
        playerRef.current.innerHTML = "";
        const playerDiv = document.createElement("div");
        playerDiv.id = `webtor-player-${Date.now()}`;
        playerDiv.style.width = "100%";
        playerDiv.style.height = "100%";
        playerRef.current.appendChild(playerDiv);

        const w = (window as any);
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
          features: {
            p2pRecovery: true,
          },
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
    },
    []
  );

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

  // If a stream is selected, show the player
  if (selectedStream) {
    return (
      <div className="flex flex-col h-full">
        {/* Mini bar to go back to list */}
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
          <span className="text-xs text-foreground/60 truncate">
            {selectedStream.title.split("\n")[0]}
          </span>
          {!playerReady && (
            <span className="flex items-center gap-1 text-xs text-primary ml-auto">
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
        {streams.map((stream, i) => {
          const info = parseStreamInfo(stream.title);
          return (
            <button
              key={`${stream.infoHash}-${i}`}
              onClick={() => playStream(stream)}
              className="w-full flex items-center gap-4 p-3 rounded-lg bg-card/50 hover:bg-card border border-border/20 hover:border-primary/30 transition-all group text-left"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Play className="w-5 h-5 text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-foreground truncate">
                    {info.quality}
                  </span>
                  {info.lang && (
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                      {info.lang}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {info.size && <span>💾 {info.size}</span>}
                  <span>👤 {info.seeds} seeds</span>
                  {info.source && <span>⚙️ {info.source}</span>}
                </div>
              </div>

              {type === "movie" ? (
                <Film className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <Tv className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
