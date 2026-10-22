import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
const collections=[{id:'movies',number:'01',title:'Cinema',description:'Grandes histórias. Novas perspectivas.'},{id:'series',number:'02',title:'Séries',description:'Só mais um episódio.'},{id:'anime',number:'03',title:'Animes',description:'Universos além da imaginação.'},{id:'doramas',number:'04',title:'Doramas',description:'Conexões que atravessam a tela.'}];
export default function CollectionTiles(){return <section className="collection-tiles" aria-label="Explore coleções">{collections.map(c=><Link key={c.id} to={`/category/${c.id}`}><span className="collection-number">{c.number}</span><div><h3>{c.title}</h3><p>{c.description}</p></div><ArrowUpRight size={21}/></Link>)}</section>}
