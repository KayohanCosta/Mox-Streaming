import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Play, ArrowUpRight, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { MediaItem, getTitle, getRating, getYear, backdropUrl } from "@/lib/tmdb";
import { useTitleAvailability } from "@/lib/titleAvailability";

export default function HeroBanner({ items, isLoading }: { items: MediaItem[]; isLoading?: boolean }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const slides = items.slice(0, 5);
  const selected = slides[current % slides.length];
  const selectedType = selected?.media_type === "movie" || selected?.release_date ? "movie" : "tv";
  const availability = useTitleAvailability(selectedType, selected?.id, Boolean(selected));
  useEffect(() => {
    if (paused || slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => setCurrent(n => (n + 1) % slides.length), 9000);
    return () => clearInterval(timer);
  }, [paused, slides.length]);
  if (isLoading) return <div className="cinema-hero hero-skeleton" aria-label="Carregando destaques" />;
  if(!slides.length)return <section className="cinema-hero hero-empty"><span className="eyebrow">SEU UNIVERSO DE HISTÓRIAS</span><h1>Encontre sua próxima história.</h1><p>Explore o catálogo e escolha seu próximo play.</p><Link to="/category/movies" className="action-primary">Explorar filmes <ArrowUpRight size={17}/></Link></section>;
  const item = slides[current % slides.length];
  const type = item.media_type === "movie" || item.release_date ? "movie" : "tv";
  const href = `/details/${type}/${item.id}`;
  return <section className="cinema-hero" aria-label="Destaques" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setPaused(false); }}>
    <img key={item.id} className={`hero-backdrop${availability==="upcoming"?" hero-backdrop-upcoming":""}`} src={backdropUrl(item.backdrop_path, "original")} alt="" fetchPriority="high" />
    <div className="hero-scrim" />
    <div className="hero-copy" key={`copy-${item.id}`}>
      <span className="eyebrow hero-eyebrow"><span className="brand-spark" /> HOJE, O DESTAQUE É SEU</span>
      <h1>{getTitle(item)}</h1>
      {availability==="upcoming"&&<span className="hero-availability">Em Breve na MOX</span>}
      <div className="hero-metadata"><span className="hero-score"><Star size={14} fill="currentColor" /> {getRating(item)}%</span><span>{getYear(item)}</span><span>{type === "movie" ? "Filme" : "Série"}</span></div>
      <p>{item.overview}</p>
      <div className="hero-actions"><Link className="action-primary" to={href}><Play size={18} fill="currentColor" /> Descobrir agora</Link><Link className="action-secondary" to={href}>Saiba mais <ArrowUpRight size={18} /></Link></div>
    </div>
    <div className="hero-preview-strip">{slides.slice(0,3).map((slide,i)=><button key={slide.id} onClick={()=>setCurrent(i)} aria-label={`Mostrar ${getTitle(slide)}`} aria-pressed={i===current}><img src={backdropUrl(slide.backdrop_path)} alt=""/><span>{getTitle(slide)}</span><small>0{i+1}</small></button>)}</div>
    <div className="hero-bottom"><span className="hero-caption">SUA PRÓXIMA HISTÓRIA COMEÇA AQUI</span><div className="hero-pagination"><button aria-label="Destaque anterior" onClick={() => setCurrent(n => (n - 1 + slides.length) % slides.length)}><ChevronLeft size={18} /></button><span>{String(current + 1).padStart(2, "0")} <small>/ {String(slides.length).padStart(2, "0")}</small></span><div className="hero-dots">{slides.map((slide, i) => <button key={slide.id} aria-label={`Mostrar ${getTitle(slide)}`} aria-current={i === current ? "true" : undefined} onClick={() => setCurrent(i)} className={i === current ? "active" : ""} />)}</div><button aria-label="Próximo destaque" onClick={() => setCurrent(n => (n + 1) % slides.length)}><ChevronRight size={18} /></button></div></div>
  </section>;
}
