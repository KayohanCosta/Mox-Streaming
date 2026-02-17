import { useRef, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { posterUrl } from "@/lib/tmdb";
import { WatchProgressItem } from "@/hooks/useWatchProgress";

interface ContinueWatchingRowProps {
  items: WatchProgressItem[];
}

export default function ContinueWatchingRow({ items }: ContinueWatchingRowProps) {
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

  if (!items.length) return null;

  return (
    <section className="mb-8 group/row relative">
      <h2 className="text-xl font-bold mb-4 px-4 md:px-8">▶️ Continuar Assistindo</h2>
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
          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              onClick={() => navigate(`/details/${item.type}/${item.id}`)}
              className="flex-shrink-0 w-[140px] md:w-[180px] cursor-pointer group/card"
            >
              <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted relative">
                <img
                  src={item.poster_path ? posterUrl(item.poster_path) : "/placeholder.svg"}
                  alt={item.title}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/card:scale-110"
                  loading="lazy"
                />
                {/* Season/Episode badge */}
                {item.type === "tv" && item.season && item.episode && (
                  <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded">
                    S{item.season}:E{item.episode}
                  </div>
                )}
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center bg-background/40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                  <Play className="w-10 h-10 text-primary fill-current" />
                </div>
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted-foreground/30">
                  <div
                    className="h-full bg-primary rounded-r-full transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
              <h3 className="text-sm font-medium mt-2 truncate">{item.title}</h3>
              <p className="text-xs text-muted-foreground">{item.progress}% assistido</p>
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
