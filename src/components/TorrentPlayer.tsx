import { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Volume2, Wifi, HardDrive } from "lucide-react";

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
  "udp://exodus.desync.com:6969",
  "udp://open.demonii.com:1337/announce",
  "udp://tracker.openbittorrent.com:6969/announce",
].map((t) => `&tr=${encodeURIComponent(t)}`).join("");

function getEmbedUrl(stream: TorrentStream): string {
  const magnet = `magnet:?xt=urn:btih:${stream.infoHash}&dn=${encodeURIComponent(stream.name)}${TRACKERS}`;
  // instant.io é o player WebTorrent mais confiável no browser
  return `https://instant.io/#${stream.infoHash}`;
}

function qualityColor(q: string) {
  if (q === "4K") return "text-yellow-400 border-yellow-400/30 bg-yellow-400/10";
  if (q === "1080p") return "text-blue-400 border-blue-400/30 bg-blue-400/10";
  if (q === "720p") return "text-green-400 border-green-400/30 bg-green-400/10";
  return "text-muted-foreground border-border bg-secondary/30";
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
          // Auto-seleciona o melhor (PT-BR com mais seeds)
          setSelectedStream(allStreams[0]);
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

  if (selectedStream) {
    return (
      <div className="flex flex-col h-full">
        {/* Barra info torrent */}
        <div className="flex items-center justify-between px-4 py-2 bg-card/60 border-b border-border/30 flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {selectedStream.ptBr && (
              <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0"
                style={{ color: "hsl(142 70% 45%)", borderColor: "hsl(142 70% 45% / 0.3)", backgroundColor: "hsl(142 70% 45% / 0.1)" }}>
                🇧🇷 <Volume2 className="w-2.5 h-2.5" />
              </span>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${qualityColor(selectedStream.quality)}`}>
              {selectedStream.quality}
            </span>
            <span className="text-xs text-muted-foreground truncate">{selectedStream.name}</span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="flex items-center gap-1 text-xs" style={{ color: "hsl(142 70% 45%)" }}>
              <Wifi className="w-3 h-3" /> {selectedStream.seeds}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <HardDrive className="w-3 h-3" /> {selectedStream.size}
            </span>
            <button
              onClick={() => setSelectedStream(null)}
              className="text-xs text-primary hover:text-primary/80 underline"
            >
              Trocar
            </button>
          </div>
        </div>

        {/* Player embed */}
        <div className="flex-1 relative bg-black">
          <iframe
            key={selectedStream.infoHash}
            src={getEmbedUrl(selectedStream)}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen"
            allowFullScreen
            title="Torrent Player"
          />
        </div>
      </div>
    );
  }

  // Lista de torrents
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30 flex-shrink-0">
        <h3 className="text-sm font-bold text-foreground">
          {streams.length} torrents encontrados
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Selecione um torrent para iniciar o streaming
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
                <span className="text-primary text-sm">▶</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
