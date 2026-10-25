import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import HorizontalShelf from "@/components/HorizontalShelf";

type Category = "movies" | "series" | "novelas" | "doramas" | "animes";
interface CatalogItem { tmdb_id: number; title: string; category: Category; type: "movie" | "tv"; poster: string; source_candidate: boolean }
interface CatalogResult { items: CatalogItem[]; page: number; total: number; total_pages: number }
const categories: {id: Category; label: string}[] = [
  {id:"movies",label:"Filmes"},{id:"series",label:"Séries"},{id:"novelas",label:"Novelas"},
  {id:"doramas",label:"Doramas"},{id:"animes",label:"Animes"},
];

function CatalogShelf({ category, label, search }: {category: Category; label: string; search: string}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => { setPage(1); setItems([]); }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    const params = new URLSearchParams({category, q:search, page:String(page)});
    fetch(`/addon-local/catalog/list?${params}`, {signal:controller.signal})
      .then(response => { if (!response.ok) throw new Error("Catálogo indisponível"); return response.json(); })
      .then((data: CatalogResult) => { if (!controller.signal.aborted) { setItems(old => page === 1 ? data.items : [...old, ...data.items]); setTotalPages(data.total_pages); setTotal(data.total); } })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [category, search, page]);
  if (!loading && !error && !items.length && search) return null;
  return <HorizontalShelf title={label} eyebrow={`${total.toLocaleString("pt-BR")} títulos`} className="acervo-shelf">
    {items.map(item => <article className="media-card group" key={`${item.category}:${item.tmdb_id}`}>
      <Link to={`/details/${item.type}/${item.tmdb_id}`} aria-label={`Ver ${item.title}`}>
        <div className="media-card-art">{item.poster ? <img src={item.poster} alt={item.title} loading="lazy" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-violet-950 to-black p-4 text-center font-semibold">{item.title}</div>}<div className="media-card-shade" />{!item.source_candidate && <span className="media-unavailable-overlay"><span>Indisponível</span></span>}</div>
        <h3>{item.title}</h3><p>{label}</p>
      </Link>
    </article>)}
    {loading && !items.length && Array.from({length:8}, (_,i) => <div key={i} className="acervo-card-skeleton animate-pulse rounded-xl bg-muted" />)}
    {error && <p role="alert" className="text-amber-200">Não foi possível carregar {label.toLowerCase()}.</p>}
    {!error && page < totalPages && <button type="button" disabled={loading} onClick={() => setPage(value => value + 1)} className="acervo-more-card">{loading ? "Carregando…" : `Ver mais ${label.toLowerCase()}`}</button>}
  </HorizontalShelf>;
}

export default function AddonCatalogPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  return <div className="min-h-screen bg-background text-foreground"><Navbar /><main className="browse-page">
    <div className="browse-heading"><div><span className="eyebrow">MOX · ACERVO</span><h1 className="browse-title">Encontre sua próxima história.</h1></div></div>
    <form role="search" onSubmit={event => {event.preventDefault(); setSearch(query.trim());}} className="premium-search-field mb-10 max-w-2xl">
      <Search aria-hidden="true" size={18} className="search-leading-icon" />
      <input aria-label="Buscar no acervo" value={query} onChange={event => setQuery(event.target.value)} placeholder="Busque por filme, série, novela, dorama ou anime" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-foreground outline-none placeholder:text-foreground/55" />
      <button type="submit" className="search-submit" aria-label="Buscar"><Search size={18} /></button>
    </form>
    {categories.map(category => <CatalogShelf key={category.id} category={category.id} label={category.label} search={search} />)}
  </main><SiteFooter /></div>;
}
