import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, ArrowUpRight } from 'lucide-react';
import { savedAsMedia,useSavedTitles } from '@/hooks/useSavedTitles';
import Navbar from '@/components/Navbar';
import SiteFooter from '@/components/SiteFooter';
import MediaCard from '@/components/MediaCard';
export default function MyListPage(){
 const items=useSavedTitles();const [filter,setFilter]=useState('all');const [sort,setSort]=useState('recent');
 const shown=items.filter(x=>filter==='all'||x.type===filter).slice().sort((a,b)=>sort==='title'?a.title.localeCompare(b.title,'pt-BR'):b.savedAt-a.savedAt);
 return <div className="min-h-screen bg-background"><Navbar/><main className="browse-page saved-page"><div className="library-heading"><div><span className="eyebrow">ESCOLHIDOS POR VOCÊ</span><h1 className="browse-title">Minha lista<span className="heading-dot">.</span></h1><p>{items.length?`${items.length} ${items.length===1?'história guardada':'histórias guardadas'} para o seu próximo play.`:'As histórias que você quer ver, em um só lugar.'}</p></div><Bookmark className="library-mark"/></div><div className="library-toolbar"><div className="filter-pills">{[['all','Todos'],['movie','Filmes'],['tv','Séries']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div><label className="library-sort"><span className="sr-only">Ordenar lista</span><select aria-label="Ordenar lista" value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Adicionados recentemente</option><option value="title">Ordem alfabética</option></select></label></div>{shown.length?<div className="media-grid">{shown.map(item=><MediaCard key={`${item.type}-${item.id}`} item={savedAsMedia(item)} type={item.type}/>)}</div>:<div className="library-empty"><Bookmark size={35}/><h2>{items.length?'Nenhum título neste filtro':'Uma boa história merece ser guardada.'}</h2><p>{items.length?'Escolha outro filtro para ver os títulos salvos.':'Toque no + de um título para adicioná-lo aqui. Sua lista fica salva neste navegador.'}</p><Link to="/category/movies" className="action-primary">Explorar o catálogo <ArrowUpRight size={16}/></Link></div>}<p className="library-local-note">Sua lista é armazenada neste navegador.</p></main><SiteFooter/></div>;
}
