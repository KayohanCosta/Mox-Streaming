import { useState, useRef, useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MediaItem, getTitle, getYear, getRating, posterUrl, fetchVideos } from "@/lib/tmdb";
import { useNavigate } from "react-router-dom";

interface Top10RowProps {
  items: MediaItem[];
  isLoading?: boolean;
}

export default function Top10Row({ items, isLoading }: Top10RowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [trailerKeys, setTrailerKeys] = useState<Record<number, string>>({});
  const navigate = useNavigate();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 20);
    setShowRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 20);
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === "left" ? -amount : amount, behavior: "smooth" });
    setTimeout(checkScroll, 400);
  };

  const handleClick = (item: MediaItem) => {
    const type = item.media_type === "movie" || item.release_date ? "movie" : "tv";
    navigate(`/details/${type}/${item.id}`);
  };

  const handleMouseEnter = (item: MediaItem) => {
    hoverTimerRef.current = setTimeout(async () => {
      setHoveredId(item.id);
      if (!trailerKeys[item.id]) {
        const type = item.media_type === "movie" || item.release_date ? "movie" : "tv";
        try {
          const videos = await fetchVideos(item.id, type);
          const trailer = videos.find(
            (v) => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
          );
          if (trailer) {
            setTrailerKeys((prev) => ({ ...prev, [item.id]: trailer.key }));
          }
        } catch (e) {
          console.error("Error fetching trailer:", e);
        }
      }
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredId(null);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const top10 = items.slice(0, 10);

  if (isLoading) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4 px-4 md:px-8">🏆 Top 10 no Brasil</h2>
        <div className="flex gap-4 px-4 md:px-8 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[200px]">
              <div className="aspect-[2/3] rounded-lg bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!top10.length) return null;

  return (
    <section className="mb-10 group/row relative">
      <h2 className="text-2xl font-extrabold mb-5 px-4 md:px-8 flex items-center gap-2">
        <span className="text-glow">🏆</span> Top 10 no Brasil
      </h2>
      <div className="relative">
        {showLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-r from-background/90 to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-4 px-4 md:px-8 overflow-x-auto scrollbar-hide scroll-smooth items-end"
          style={{ minHeight: "320px" }}
        >
          {top10.filter((i) => i.poster_path).map((item, index) => {
            const isHovered = hoveredId === item.id;
            const trailerKey = trailerKeys[item.id];

            return (
              <div
                key={item.id}
                className="flex-shrink-0 relative cursor-pointer transition-all duration-500 ease-out"
                style={{
                  width: isHovered ? "480px" : "180px",
                  zIndex: isHovered ? 30 : 1,
                }}
                onMouseEnter={() => handleMouseEnter(item)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(item)}
              >
                {/* Rank number */}
                <div
                  className="absolute -left-4 bottom-0 z-10 pointer-events-none select-none transition-all duration-500"
                  style={{
                    opacity: isHovered ? 0 : 1,
                  }}
                >
                  <span
                    className="font-black italic leading-none block"
                    style={{
                      fontSize: "140px",
                      background: `linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--primary) / 0.2))`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      textShadow: "none",
                      filter: "drop-shadow(0 0 20px hsl(var(--primary) / 0.3))",
                    }}
                  >
                    {index + 1}
                  </span>
                </div>

                <div
                  className="rounded-xl overflow-hidden bg-surface relative transition-all duration-500"
                  style={{
                    height: isHovered ? "270px" : "270px",
                  }}
                >
                  {/* Poster / Trailer */}
                  {isHovered && trailerKey ? (
                    <div className="w-full h-full flex">
                      {/* Left: poster small */}
                      <div className="w-[160px] flex-shrink-0 relative">
                        <img
                          src={posterUrl(item.poster_path)}
                          alt={getTitle(item)}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-surface/80" />
                      </div>
                      {/* Right: trailer */}
                      <div className="flex-1 relative bg-black overflow-hidden">
                        <iframe
                          src={`https://www.youtube.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&showinfo=0&rel=0&modestbranding=1&loop=1&playlist=${trailerKey}&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0&annotation=0`}
                          className="absolute w-[140%] h-[140%]"
                          style={{ top: "-20%", left: "-20%" }}
                          allow="autoplay; encrypted-media"
                          title="Trailer"
                        />
                        {/* Info overlay on trailer */}
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                          <h3 className="text-sm font-bold text-foreground truncate">
                            {getTitle(item)}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                            <span className="text-rating font-bold">★ {getRating(item)}%</span>
                            <span>• {getYear(item)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <img
                        src={posterUrl(item.poster_path)}
                        alt={getTitle(item)}
                        className="w-full h-full object-cover transition-transform duration-500"
                      />
                      <div className="absolute inset-0 gradient-card opacity-0 hover:opacity-100 transition-opacity duration-300 flex items-end p-3">
                        <div>
                          <h3 className="text-sm font-bold truncate">{getTitle(item)}</h3>
                          <div className="flex items-center gap-1 text-xs mt-1">
                            <span className="text-rating font-bold">★ {getRating(item)}%</span>
                            <span className="text-muted-foreground">• {getYear(item)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Loading trailer indicator */}
                  {isHovered && !trailerKey && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {showRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-l from-background/90 to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>
    </section>
  );
}
