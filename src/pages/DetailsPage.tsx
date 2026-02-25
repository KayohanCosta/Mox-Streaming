import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { fetchDetails, fetchSeasonEpisodes, fetchVideos, fetchSimilar, fetchCertification, MediaDetails, MediaItem, Episode, VideoResult, getTitle, getYear, getRating, backdropUrl, posterUrl } from "@/lib/tmdb";
import ContentRow from "@/components/ContentRow";
import Navbar from "@/components/Navbar";
import { Star, Clock, Calendar, Play, X, Youtube } from "lucide-react";
import IPTVPlayer from "@/components/IPTVPlayer";
import { saveWatchProgress } from "@/hooks/useWatchProgress";
import { findStreamInIPTVList } from "@/lib/iptv";

type PlayerSource = "iptv-1" | "iptv-2" | "iptv-3";
type PlayerTab = "iptv-1" | "iptv-2" | "iptv-3";

interface PlayerState {
  open: boolean;
  tab: PlayerTab;
  source: PlayerSource;
  seasonNum?: number;
  episodeNum?: number;
}

export default function DetailsPage() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [details, setDetails] = useState<MediaDetails | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [trailerKey, setTrailerKey] = useState<string | null>(null);
  const [showTrailer, setShowTrailer] = useState(false);
  const [similar, setSimilar] = useState<MediaItem[]>([]);
  const [certification, setCertification] = useState<string>("L");
  const [player, setPlayer] = useState<PlayerState>({ open: false, tab: "iptv-1", source: "iptv-1" });

  useEffect(() => {
    if (!id || !type) return;
    setLoading(true);
    setPlayer({ open: false, tab: "iptv-1", source: "iptv-1" });
    fetchDetails(Number(id), type as "movie" | "tv")
      .then((data) => {
        setDetails(data);
        if (type === "tv" && data.seasons?.length) {
          const firstReal = data.seasons.find((s) => s.season_number > 0);
          if (firstReal) {
            setSelectedSeason(firstReal.season_number);
            fetchSeasonEpisodes(Number(id), firstReal.season_number).then(setEpisodes);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetchVideos(Number(id), type as "movie" | "tv").then((videos) => {
      const trailer = videos.find((v) => v.site === "YouTube" && v.type === "Trailer")
        || videos.find((v) => v.site === "YouTube");
      if (trailer) setTrailerKey(trailer.key);
    }).catch(console.error);

    fetchSimilar(Number(id), type as "movie" | "tv")
      .then(setSimilar)
      .catch(console.error);

    fetchCertification(Number(id), type as "movie" | "tv")
      .then((c) => setCertification(c || "L"))
      .catch(() => setCertification("L"));
  }, [id, type]);

  useEffect(() => {
    if (player.open) {
      document.body.classList.add("overflow-hidden");
    } else {
      document.body.classList.remove("overflow-hidden");
    }
    return () => document.body.classList.remove("overflow-hidden");
  }, [player.open]);

  const handleSeasonChange = (seasonNum: number) => {
    setSelectedSeason(seasonNum);
    if (id) {
      fetchSeasonEpisodes(Number(id), seasonNum).then(setEpisodes);
    }
  };

  const openPlayer = useCallback((seasonNum?: number, episodeNum?: number) => {
    setPlayer({ open: true, tab: "iptv-1", source: "iptv-1", seasonNum, episodeNum });

    // Save to "continue watching"
    if (details) {
      saveWatchProgress({
        id: Number(id),
        type: type === "movie" ? "movie" : "tv",
        title: getTitle(details),
        poster_path: details.poster_path,
        progress: 10, // initial progress
        season: seasonNum,
        episode: episodeNum,
      });
    }
  }, [details, id, type]);

  const closePlayer = () => setPlayer(p => ({ ...p, open: false }));



  const getPlayerUrl = useCallback(
    async (source: PlayerSource, sNum?: number, eNum?: number): Promise<string> => {
      if (!id) return "";
      const title = details
        ? (details.original_title || details.original_name || getTitle(details))
        : undefined;
      const altTitle = details ? getTitle(details) : undefined;
      const streamUrl = await findStreamInIPTVList({
        tmdbId: id,
        type: type === "movie" ? "movie" : "tv",
        season: sNum,
        episode: eNum,
        title,
        altTitle,
        year: details ? getYear(details) : undefined,
      });
      return streamUrl ?? "";
    },
    [id, type, details]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="h-[70vh] bg-surface animate-shimmer bg-gradient-to-r from-surface via-surface-hover to-surface bg-[length:200%_100%]" />
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Navbar />
        <p className="text-muted-foreground">Conteúdo não encontrado</p>
      </div>
    );
  }

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

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 md:px-12">
        <Navbar />
      </div>

      {/* Player Modal with Tabs */}
      {player.open && (
        <div className="fixed inset-0 z-[60] bg-black/95 flex flex-col animate-fade-in overflow-hidden">
          <div className="flex-1 relative">
            <IPTVPlayer
              contentTitle={title}
              year={year}
              source={player.source}
              season={player.seasonNum}
              episode={player.episodeNum}
              getStreamUrl={getPlayerUrl}
              certification={certification}
            />
          </div>
        </div>
      )}

      {/* Hero */}
      <div className="relative h-[70vh] md:h-[80vh]">
        <img
          src={backdropUrl(details.backdrop_path)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute inset-0 gradient-hero-bottom" />

        <div className="absolute inset-0 flex items-end pb-16 md:pb-20">
          <div className="px-4 md:px-12 max-w-3xl animate-fade-in">
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-black mb-4 text-glow">{title}</h1>

            <div className="flex flex-wrap items-center gap-3 text-sm mb-5">
              <span className="flex items-center gap-1 text-rating font-semibold">
                <Star className="w-4 h-4 fill-current" /> {rating}%
              </span>
              {year && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" /> {year}
                </span>
              )}
              {runtime > 0 && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" /> {runtime} min
                </span>
              )}
            </div>

            {details.genres?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-5">
                {details.genres.map((g) => (
                  <span key={g.id} className="px-3 py-1 bg-secondary rounded-full text-xs font-medium">
                    {g.name}
                  </span>
                ))}
              </div>
            )}

            {details.overview && (
              <p className="text-sm md:text-base text-foreground/80 mb-6 line-clamp-4">{details.overview}</p>
            )}

            <div className="flex gap-3">
              {type === "movie" ? (
                <button
                  onClick={() => openPlayer()}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-primary-foreground font-semibold px-8 py-3 rounded-lg transition-colors"
                >
                  <Play className="w-5 h-5 fill-current" /> Assistir Agora
                </button>
              ) : (
                <button
                  onClick={() => episodes.length > 0 && openPlayer(selectedSeason, episodes[0]?.episode_number || 1)}
                  className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-primary-foreground font-semibold px-8 py-3 rounded-lg transition-colors"
                >
                  <Play className="w-5 h-5 fill-current" /> Assistir T{selectedSeason}E1
                </button>
              )}
              {trailerKey && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="flex items-center gap-2 bg-secondary hover:bg-surface-hover text-foreground font-semibold px-6 py-3 rounded-lg transition-colors"
                >
                  <Youtube className="w-5 h-5" /> Trailer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Trailer Modal */}
      {showTrailer && trailerKey && (
        <div
          className="fixed inset-0 z-50 bg-background/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowTrailer(false)}
        >
          <div className="relative w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTrailer(false)}
              className="absolute -top-10 right-0 text-foreground/70 hover:text-foreground transition-colors"
            >
              <X className="w-7 h-7" />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0`}
              title="Trailer"
              allow="autoplay; encrypted-media"
              allowFullScreen
              className="w-full h-full rounded-xl"
            />
          </div>
        </div>
      )}

      {/* Info sections - Alinhado com o Hero */}
      <div className="px-4 md:px-12 max-w-3xl pb-10 -mt-8 relative z-10">
        {/* Direção */}
        {directors.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs uppercase text-muted-foreground tracking-wider mb-1">Direção</h3>
            <p className="text-sm">{directors.map((d) => d.name).join(", ")}</p>
          </div>
        )}

        {/* Elenco */}
        {cast.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4">Elenco</h2>
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
              {cast.map((actor) => (
                <div key={actor.id} className="flex-shrink-0 w-24 text-center">
                  <div className="w-20 h-20 mx-auto rounded-full overflow-hidden bg-surface mb-2">
                    <img
                      src={actor.profile_path ? posterUrl(actor.profile_path, "w185") : "/placeholder.svg"}
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

        {/* Onde Assistir */}
        {uniqueProviders.length > 0 && (
          <div className="mb-10">
            <h2 className="text-xl font-bold mb-4">Onde Assistir</h2>
            <div className="flex flex-wrap gap-3">
              {uniqueProviders.map((p) => (
                <div key={p.provider_id} className="bg-secondary rounded-lg p-2" title={p.provider_name}>
                  <img
                    src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                    alt={p.provider_name}
                    className="w-10 h-10 rounded object-contain"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Seasons & Episodes (TV only) - Max-width 1400px */}
      {type === "tv" && details.seasons && details.seasons.length > 0 && (
        <div className="max-w-[1400px] mx-auto px-4 md:px-12 pb-10">
          <div>
            <h2 className="text-xl font-bold mb-4">Temporadas</h2>
            <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2">
              {details.seasons
                .filter((s) => s.season_number > 0)
                .map((season) => (
                  <button
                    key={season.id}
                    onClick={() => handleSeasonChange(season.season_number)}
                    className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedSeason === season.season_number
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
                    }`}
                  >
                    T{season.season_number}
                  </button>
                ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => openPlayer(selectedSeason, ep.episode_number)}
                  className="bg-card rounded-lg overflow-hidden group cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                >
                  <div className="aspect-video relative bg-surface">
                    <img
                      src={ep.still_path ? posterUrl(ep.still_path, "w500") : "/placeholder.svg"}
                      alt={ep.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Play className="w-10 h-10 text-primary fill-current" />
                    </div>
                  </div>
                  <div className="p-3">
                    <h4 className="text-sm font-semibold truncate">
                      E{ep.episode_number} - {ep.name}
                    </h4>
                    {ep.overview && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{ep.overview}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conteúdos Relacionados - Full Width */}
      {similar.length > 0 && (
        <div className="pb-16">
          <ContentRow
            title="Conteúdos Relacionados"
            items={similar}
            mediaType={type === "movie" ? "filme" : "serie"}
          />
        </div>
      )}

      {/* Similar Content removido daqui, agora está acima */}
    </div>
  );
}
