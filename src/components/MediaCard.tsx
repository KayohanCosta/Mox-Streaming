import { useEffect, useRef } from "react";
import { prepareMovieStream } from "@/lib/redecanais";
import SaveTitleButton from "./SaveTitleButton";
import { Link } from "react-router-dom";
import { Play, Star } from "lucide-react";
import { MediaItem, getTitle, getYear, getRating, posterUrl } from "@/lib/tmdb";

let intentPreparation:Promise<unknown>|undefined;
let lastIntent=0;
export default function MediaCard({ item, type, rank }: { item: MediaItem; type: string; rank?: number }) {
  const timer=useRef<ReturnType<typeof setTimeout>>();
  const cancel=()=>clearTimeout(timer.current);
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  const prepare=()=>{cancel();if(type!=="movie")return;timer.current=setTimeout(()=>{if(intentPreparation||Date.now()-lastIntent<15_000)return;lastIntent=Date.now();intentPreparation=prepareMovieStream(item.id,"pt").catch(()=>{}).finally(()=>{intentPreparation=undefined;});},650);};
  return <article onMouseEnter={prepare} onMouseLeave={cancel} onFocus={prepare} onBlur={cancel} className="media-card group"><Link to={`/details/${type}/${item.id}`} aria-label={`Ver ${getTitle(item)}`}>
    <div className="media-card-art">
      <img src={posterUrl(item.poster_path)} alt={getTitle(item)} loading="lazy" />
      {rank && <span className="rank-badge">{String(rank).padStart(2, "0")}</span>}
      <div className="media-card-shade" />
      <span className="card-play"><Play size={21} fill="currentColor" /></span>
      <span className="card-rating"><Star size={11} fill="currentColor" /> {getRating(item)}%</span>
    </div>
    <h3>{getTitle(item)}</h3>
    <p>{getYear(item)} <span>·</span> {type === "movie" ? "Filme" : "Série"}</p>
  </Link><SaveTitleButton item={item} type={type==="movie"?"movie":"tv"} compact/></article>;
}
