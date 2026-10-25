import { Link } from "react-router-dom";
import { ArrowUpRight, Play } from "lucide-react";
import { MediaItem, backdropUrl, getTitle, getYear } from "@/lib/tmdb";
import { useTitleAvailability } from "@/lib/titleAvailability";
function EditorialCard({item,index}:{item:MediaItem;index:number}){
 const type=item.media_type==='movie'||item.release_date?'movie':'tv';
 const availability=useTitleAvailability(type,item.id);
 return <Link to={`/details/${type}/${item.id}`} className="editorial-card"><img src={backdropUrl(item.backdrop_path)} alt="" loading="lazy"/><div className="editorial-shade"/>{availability!=="available"&&<span className={`media-unavailable-overlay${availability==="checking"?" is-checking":""}`}><span>{availability==="checking"?"Verificando":"Em Breve na MOX"}</span></span>}<span className="editorial-index">0{index+1} / EM DESTAQUE</span><div><span className="eyebrow">{getYear(item)} · {type==='movie'?'CINEMA':'SÉRIES'}</span><h3>{getTitle(item)}</h3><span className="editorial-cta"><Play size={14} fill="currentColor"/> Conheça a história <ArrowUpRight size={15}/></span></div></Link>;
}
export default function EditorialShelf({ items }: { items: MediaItem[] }) {
 return <section className="editorial-shelf"><div className="section-heading"><div><span className="eyebrow">DÊ PLAY EM OUTRA PERSPECTIVA</span><h2>Uma história muda tudo.</h2></div></div><div className="editorial-grid">{items.filter(i=>i.backdrop_path).slice(0,3).map((item,i)=><EditorialCard key={item.id} item={item} index={i}/>)}</div></section>;
}
