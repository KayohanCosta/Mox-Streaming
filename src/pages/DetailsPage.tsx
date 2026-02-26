import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { fetchDetails, fetchSeasonEpisodes, fetchVideos, fetchSimilar, fetchCertification, MediaDetails, MediaItem, Episode, VideoResult, getTitle, getYear, getRating, backdropUrl, posterUrl } from "@/lib/tmdb";
import ContentRow from "@/components/ContentRow";
import Navbar from "@/components/Navbar";
import { Star, Clock, Calendar, Play, X, Youtube, ChevronDown } from "lucide-react";
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
  const [certification, setCertification] = useState("L");
  const [player, setPlayer] = useState<PlayerState>({ open: false, tab: "iptv-1", source: "iptv-1" });
  const [showSeasonDropdown, setShowSeasonDropdown] = useState(false);

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
      fetchSeasonEpisodes(Number(id), seasonNum).then(setEpisodes);
    }
  };

  const openPlayer = useCallback((seasonNum?: number, episodeNum?: number) => {
    setPlayer({ open: true, tab: "iptv-1", source: "iptv-1", seasonNum, episodeNum });

    if (details) {
      saveWatchProgress({
        id: Number(id),
        type: type === "movie" ? "movie" : "tv",
        title: getTitle(details),
        poster_path: details.poster_path,
        progress: 10,
        season: seasonNum,
        episode: episodeNum,
      });
    }
  }, [details, id, type]);

  const closePlayer = () => setPlayer(p => ({ ...p, open: false }));

  const getPlayerUrl = useCallback(
    async (_source: PlayerSource, _sNum?: number, _eNum?: number): Promise<string> => {
      return "https://www.w3schools.com/html/mov_bbb.mp4";
    },
    []
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!details) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <X className="w-16 h-16 text-muted-foreground mb-4" />
        <p className="text-xl text-muted-foreground">Conteúdo não encontrado</p>
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

  const filteredSeasons = details.seasons?.filter((s) => s.season_number > 0) || [];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <div className="fixed top-0 left-0 right-0 z-50">
        <Navbar />
      </div>

      {/* Player Modal with Tabs */}
      {player.open && (
        <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
          <div className="w-full h-full">
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
      <div className="relative w-full min-h-[70vh]">
        <img src={backdropUrl(details.backdrop_path)} alt={title} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

        <div className="relative z-10 flex items-end min-h-[70vh] pb-12">
          <div className="px-4 md:px-12 max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">{title}</h1>

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
              {/* Botão Assistir ou Continuar Assistindo (primeiro à esquerda) */}
              {(() => {
                const progress = JSON.parse(localStorage.getItem('watch_progress') || '[]').find((i:any) => i.id === details.id && i.type === type);
                if (progress && progress.progress > 0 && progress.progress < 100) {
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
              {/* Dropdown premium dos três pontinhos */}
              {(() => {
                const progress = JSON.parse(localStorage.getItem('watch_progress') || '[]').find((i:any) => i.id === details.id && i.type === type);
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
                            // Reiniciar progresso
                            const all = JSON.parse(localStorage.getItem('watch_progress') || '[]');
                            const idx = all.findIndex((i:any) => i.id === details.id && i.type === type);
                            if (idx >= 0) {
                              all[idx].progress = 0;
                              localStorage.setItem('watch_progress', JSON.stringify(all));
                              window.location.reload();
                            }
                          }}
                          className="w-full text-left px-5 py-3 text-base text-white hover:bg-[#28283a] rounded-lg transition-colors font-medium"
                        >
                          Reiniciar
                        </button>
                        <button
                          onClick={() => {
                            // Remover dos assistidos
                            const all = JSON.parse(localStorage.getItem('watch_progress') || '[]').filter((i:any) => !(i.id === details.id && i.type === type));
                            localStorage.setItem('watch_progress', JSON.stringify(all));
                            window.location.reload();
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

      {/* Trailer Modal */}
      {showTrailer && trailerKey && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center" onClick={() => setShowTrailer(false)}>
          <div className="relative w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowTrailer(false)}
              className="absolute -top-10 right-0 text-foreground/70 hover:text-foreground transition-colors"
            >
              <X className="w-8 h-8" />
            </button>
            <iframe
              src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1`}
              className="w-full h-full rounded-xl"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* Info sections */}
      <div className="px-4 md:px-12 max-w-3xl pb-10 -mt-8 relative z-10" style={{ zIndex: 1 }}>
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

      {/* Seasons & Episodes (TV only) */}
      {type === "tv" && filteredSeasons.length > 0 && (
        <div className="px-4 md:px-12 pb-10">
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
          <div className="flex gap-5 overflow-x-auto scrollbar-hide pb-4">
            {episodes.map((ep) => (
              <div
                key={ep.id}
                onClick={() => openPlayer(selectedSeason, ep.episode_number)}
                className="flex-shrink-0 w-[300px] bg-card rounded-[22px] overflow-hidden group cursor-pointer shadow-lg hover:shadow-xl hover:ring-2 hover:ring-primary/30 transition-all"
              >
                <div className="aspect-video relative bg-secondary">
                  <img
                    src={ep.still_path ? posterUrl(ep.still_path, "w500") : "/placeholder.svg"}
                    alt={ep.name}
                    className="w-full h-full object-cover"
                  />
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
      {similar.length > 0 && (
        <div className="pb-16">
          <ContentRow
            title="Conteúdos Relacionados"
            items={similar}
            mediaType={type === "movie" ? "filme" : "serie"}
          />
        </div>
      )}
    </div>
  );
}
