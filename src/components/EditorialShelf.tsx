import { Link } from "react-router-dom";
import { ArrowUpRight, Play } from "lucide-react";
import { MediaItem, backdropUrl, getTitle, getYear } from "@/lib/tmdb";
export default function EditorialShelf({ items }: { items: MediaItem[] }) {
 return <section className="editorial-shelf"><div className="section-heading"><div><span className="eyebrow">DÊ PLAY EM OUTRA PERSPECTIVA</span><h2>Uma história muda tudo.</h2></div></div><div className="editorial-grid">{items.filter(i=>i.backdrop_path).slice(0,3).map((item,i)=><Link key={item.id} to={`/details/${item.media_type==='movie'||item.release_date?'movie':'tv'}/${item.id}`} className="editorial-card"><img src={backdropUrl(item.backdrop_path)} alt="" loading="lazy"/><div className="editorial-shade"/><span className="editorial-index">0{i+1} / EM DESTAQUE</span><div><span className="eyebrow">{getYear(item)} · {item.media_type==='movie'||item.release_date?'CINEMA':'SÉRIES'}</span><h3>{getTitle(item)}</h3><span className="editorial-cta"><Play size={14} fill="currentColor"/> Conheça a história <ArrowUpRight size={15}/></span></div></Link>)}</div></section>;
}
