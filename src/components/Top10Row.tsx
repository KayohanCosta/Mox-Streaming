import { useRef } from "react";
import { ChevronLeft, ChevronRight, TrendingUp } from "lucide-react";
import { MediaItem } from "@/lib/tmdb";
import MediaCard from "./MediaCard";

export default function Top10Row({ items, isLoading }: { items: MediaItem[]; isLoading?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!isLoading && !items.length) return null;
  return <section className="catalog-section top-ten">
    <div className="section-heading"><div><span className="eyebrow"><TrendingUp size={13} /> O QUE ESTÁ EM ALTA</span><h2>Top 10 no Brasil<span className="heading-dot">.</span></h2></div>
      <div className="row-arrows"><button aria-label="Top 10 anteriores" onClick={() => ref.current?.scrollBy({ left: -700, behavior: "smooth" })}><ChevronLeft size={18} /></button><button aria-label="Próximos do Top 10" onClick={() => ref.current?.scrollBy({ left: 700, behavior: "smooth" })}><ChevronRight size={18} /></button></div>
    </div>
    <div ref={ref} className="catalog-track scrollbar-hide">{isLoading ? Array.from({ length: 8 }, (_, i) => <div key={i} className="poster-skeleton" />) : items.filter(i => i.poster_path).slice(0, 10).map((item, index) => <MediaCard key={item.id} item={item} type={item.media_type === "movie" || item.release_date ? "movie" : "tv"} rank={index + 1} />)}</div>
  </section>;
}
