import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { posterUrl, type Episode } from "@/lib/tmdb";
import { useEpisodeAvailability, type TitleAvailability } from "@/lib/titleAvailability";

interface Props {
  episode: Episode;
  titleId: number;
  season: number;
  titleStatus: TitleAvailability;
  onPlay: (season: number, episode: number) => void;
}

export default function AvailableEpisodeCard({ episode, titleId, season, titleStatus, onPlay }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "300px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const episodeStatus = useEpisodeAvailability(titleId, season, episode.episode_number, visible && titleStatus === "available");
  const status = titleStatus === "available" ? episodeStatus : titleStatus;
  const playable = status === "available";
  const play = () => { if (playable) onPlay(season, episode.episode_number); };
  return (
    <div ref={cardRef} onClick={play} role="button" tabIndex={playable ? 0 : -1}
      aria-disabled={!playable} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); play(); } }}
      className="detail-episode-card group">
      <div className="aspect-video relative bg-secondary">
        <img src={episode.still_path ? posterUrl(episode.still_path, "w500") : "/placeholder.svg"}
          alt={episode.name} className="w-full h-full object-cover" />
        {!playable && <span className={`media-unavailable-overlay${status === "checking" ? " is-checking" : ""}`}>
          <span>{status === "checking" ? "Verificando" : "Em Breve na MOX"}</span>
        </span>}
        {playable && <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover:opacity-100 transition-opacity">
          <Play className="w-10 h-10 text-primary fill-current" />
        </div>}
      </div>
      <div className="p-4">
        <h4 className="text-base font-bold truncate">E{episode.episode_number} - {episode.name}</h4>
        {episode.overview && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{episode.overview}</p>}
      </div>
    </div>
  );
}
