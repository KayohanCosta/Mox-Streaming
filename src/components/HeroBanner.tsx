import { useState, useEffect, useRef } from "react";
import { MediaItem, getTitle, getRating, backdropUrl } from "@/lib/tmdb";
import { useNavigate } from "react-router-dom";
import { Play, Info, ChevronLeft, ChevronRight, Star } from "lucide-react";

interface HeroBannerProps {
  items: MediaItem[];
  isLoading?: boolean;
}

export default function HeroBanner({ items, isLoading }: HeroBannerProps) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const navigate = useNavigate();

  useEffect(() => {
    if (!items.length) return;
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % items.length);
    }, 6000);
    return () => clearInterval(timerRef.current);
  }, [items.length]);

  const goTo = (index: number) => {
    setCurrent(index);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % items.length);
    }, 6000);
  };

  if (isLoading || !items.length) {
    return (
      <div className="relative h-[70vh] md:h-[85vh] bg-surface animate-shimmer bg-gradient-to-r from-surface via-surface-hover to-surface bg-[length:200%_100%]" />
    );
  }

  const item = items[current];
  const type = item.media_type === "movie" || item.release_date ? "movie" : "tv";

  return (
    <div className="relative h-[70vh] md:h-[85vh] overflow-hidden">
      {/* Background image */}
      {items.map((it, i) => (
        <div
          key={it.id}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === current ? 1 : 0 }}
        >
          <img
            src={backdropUrl(it.backdrop_path, "original")}
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
      ))}

      {/* Gradients */}
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute inset-0 gradient-hero-bottom" />

      {/* Content */}
      <div className="absolute inset-0 flex items-end md:items-center pb-24 md:pb-0">
        <div className="px-4 md:px-12 max-w-2xl animate-fade-in" key={item.id}>
          <div className="flex items-center gap-2 mb-3">
            <span className="bg-primary/20 text-primary text-xs font-semibold px-3 py-1 rounded-full border border-primary/30">
              #{current + 1} Em Alta
            </span>
            <span className="flex items-center gap-1 text-rating text-sm font-semibold">
              <Star className="w-3.5 h-3.5 fill-current" />
              {getRating(item)}%
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl lg:text-6xl font-black mb-4 leading-tight text-glow">
            {getTitle(item)}
          </h1>

          {item.overview && (
            <p className="text-sm md:text-base text-foreground/80 mb-6 line-clamp-3">
              {item.overview}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => navigate(`/details/${type}/${item.id}`)}
              className="flex items-center gap-2 bg-primary hover:bg-primary/80 text-primary-foreground font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              <Play className="w-5 h-5 fill-current" />
              Assistir
            </button>
            <button
              onClick={() => navigate(`/details/${type}/${item.id}`)}
              className="flex items-center gap-2 bg-secondary hover:bg-surface-hover text-foreground font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              <Info className="w-5 h-5" />
              Detalhes
            </button>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      <button
        onClick={() => goTo((current - 1 + items.length) % items.length)}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80 p-2 rounded-full transition-colors z-40"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <button
        onClick={() => goTo((current + 1) % items.length)}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/50 hover:bg-background/80 p-2 rounded-full transition-colors z-40"
      >
        <ChevronRight className="w-5 h-5" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-24 md:bottom-30 right-8 md:right-12 flex gap-3 z-[120] pointer-events-auto">
        {items.slice(0, 10).map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Ir para slide ${i + 1}`}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current ? "w-8 bg-primary" : "w-3 bg-foreground/30 hover:bg-foreground/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
