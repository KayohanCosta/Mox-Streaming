import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MediaItem } from "@/lib/tmdb";
import MediaCard from "./MediaCard";

export default function ContentRow({ title, items, mediaType, isLoading }: { title: string; items: MediaItem[]; mediaType: string; isLoading?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  if (!isLoading && !items.length) return null;
  return <section className="catalog-section">
    <div className="section-heading"><h2>{title}<span className="heading-dot">.</span></h2><div className="row-arrows"><button aria-label={`Anteriores: ${title}`} onClick={() => ref.current?.scrollBy({ left: -700, behavior: "smooth" })}><ChevronLeft size={18} /></button><button aria-label={`Próximos: ${title}`} onClick={() => ref.current?.scrollBy({ left: 700, behavior: "smooth" })}><ChevronRight size={18} /></button></div></div>
    <div ref={ref} className="catalog-track scrollbar-hide">{isLoading ? Array.from({ length: 8 }, (_, i) => <div key={i} className="poster-skeleton" />) : items.filter(i => i.poster_path).map(item => <MediaCard key={`${item.media_type}-${item.id}`} item={item} type={item.media_type === "movie" || mediaType === "filme" ? "movie" : "tv"} />)}</div>
  </section>;
}
