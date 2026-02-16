import { useState, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MediaItem, getTitle, getYear, getRating, posterUrl } from "@/lib/tmdb";
import { useNavigate } from "react-router-dom";

interface ContentRowProps {
  title: string;
  items: MediaItem[];
  mediaType: string;
  isLoading?: boolean;
}

export default function ContentRow({ title, items, mediaType, isLoading }: ContentRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);
  const navigate = useNavigate();

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
    const type = item.media_type === "movie" || mediaType === "filme" ? "movie" : "tv";
    navigate(`/details/${type}/${item.id}`);
  };

  if (isLoading) {
    return (
      <section className="mb-8">
        <h2 className="text-xl font-bold mb-4 px-4 md:px-8">{title}</h2>
        <div className="flex gap-3 px-4 md:px-8 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[140px] md:w-[180px]">
              <div className="aspect-[2/3] rounded-lg bg-muted animate-shimmer bg-gradient-to-r from-muted via-surface-hover to-muted bg-[length:200%_100%]" />
              <div className="h-3 bg-muted rounded mt-2 w-3/4" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="mb-8 group/row relative">
      <h2 className="text-xl font-bold mb-4 px-4 md:px-8">{title}</h2>
      <div className="relative">
        {showLeft && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-r from-background/90 to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <div
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 px-4 md:px-8 overflow-x-auto scrollbar-hide scroll-smooth"
        >
          {items.filter(i => i.poster_path).map((item) => (
            <div
              key={item.id}
              onClick={() => handleClick(item)}
              className="flex-shrink-0 w-[140px] md:w-[180px] cursor-pointer group/card"
            >
              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface relative">
                <img
                  src={posterUrl(item.poster_path)}
                  alt={getTitle(item)}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 gradient-card opacity-0 group-hover/card:opacity-100 transition-opacity duration-300 flex items-end p-3">
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-rating font-bold">★ {getRating(item)}%</span>
                    <span className="text-muted-foreground">• {getYear(item)}</span>
                  </div>
                </div>
              </div>
              <h3 className="text-sm font-medium mt-2 truncate">{getTitle(item)}</h3>
              <p className="text-xs text-muted-foreground">{getYear(item)}</p>
            </div>
          ))}
        </div>
        {showRight && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-0 bottom-0 z-10 w-12 bg-gradient-to-l from-background/90 to-transparent flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>
    </section>
  );
}
