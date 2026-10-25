import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import MediaCard from "@/components/MediaCard";
import { fetchCategory, MediaItem } from "@/lib/tmdb";
import "./AcervoPage.css";

type Collection = "movies" | "series" | "anime" | "doramas" | "novelas";
const collections: { id: Collection; label: string; description: string }[] = [
  { id: "movies", label: "Filmes", description: "Histórias para uma noite inteira" },
  { id: "series", label: "Séries", description: "Mundos para acompanhar" },
  { id: "anime", label: "Animes", description: "Universos sem limites" },
  { id: "doramas", label: "Doramas", description: "Histórias para sentir" },
  { id: "novelas", label: "Novelas", description: "Tramas que ficam com você" },
];
const genres = [
  { id: "all", label: "Todos os gêneros" }, { id: "28", label: "Ação" },
  { id: "12", label: "Aventura" }, { id: "16", label: "Animação" },
  { id: "35", label: "Comédia" }, { id: "80", label: "Crime" },
  { id: "18", label: "Drama" }, { id: "10751", label: "Família" },
  { id: "14", label: "Fantasia" }, { id: "27", label: "Terror" },
  { id: "9648", label: "Mistério" }, { id: "10749", label: "Romance" },
  { id: "878", label: "Ficção científica" }, { id: "53", label: "Suspense" },
];
const tvGenres = new Set(["16", "35", "80", "18", "10751", "9648"]);
const sortOptions = [
  { value: "popularity.desc", label: "Mais populares" },
  { value: "vote_average.desc", label: "Mais bem avaliados" },
  { value: "primary_release_date.desc", label: "Mais recentes" },
];
function endpointFor(collection: Collection, genre: string, year: string, sort: string) {
  const movie = collection === "movies";
  const base = movie ? "discover/movie" : "discover/tv";
  const params = new URLSearchParams({ sort_by: movie ? sort : sort.replace("primary_release_date", "first_air_date"), "vote_count.gte": sort === "vote_average.desc" ? "100" : "20", include_adult: "false" });
  if (genre !== "all" && (movie || tvGenres.has(genre))) params.set("with_genres", genre);
  if (year) params.set(movie ? "primary_release_year" : "first_air_date_year", year);
  if (collection === "anime") { params.set("with_genres", genre !== "all" && tvGenres.has(genre) && genre !== "16" ? `16,${genre}` : "16"); params.set("with_keywords", "210024|222243"); }
  if (collection === "doramas") { params.set("with_original_language", "ko|ja|zh"); params.set("with_genres", genre !== "all" && tvGenres.has(genre) ? `18,${genre}` : "18"); params.set("without_genres", "16"); }
  if (collection === "novelas") { params.set("with_origin_country", "BR"); params.set("with_genres", genre !== "all" && tvGenres.has(genre) ? `10766,${genre}` : "10766"); params.set("without_keywords", "210024|222243"); }
  return `${base}?${params.toString()}`;
}
export default function AcervoPage() {
  const [collection, setCollection] = useState<Collection>("movies");
  const [genre, setGenre] = useState("all");
  const [year, setYear] = useState("");
  const [sort, setSort] = useState("popularity.desc");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const mediaType = collection === "movies" ? "movie" : "tv";
  const endpoint = useMemo(() => endpointFor(collection, genre, year, sort), [collection, genre, year, sort]);
  const selectedCollection = collections.find(item => item.id === collection)!;
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    fetchCategory(endpoint, page).then(data => {
      if (!active) return;
      setItems(data.results.filter(item => item.poster_path));
      setPages(Math.max(1, Math.min(data.total_pages, 500)));
    }).catch(() => { if (active) { setItems([]); setError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [endpoint, page, attempt]);
  function chooseCollection(next: Collection) { setCollection(next); setGenre("all"); setPage(1); }
  function chooseGenre(next: string) { setGenre(next); setPage(1); }
  return <div className="min-h-screen bg-background">
    <Navbar />
    <main className="acervo-page">
      <header className="acervo-intro"><span className="eyebrow">MOX / ACERVO</span><h1>Seu próximo favorito<br/><em>está por aqui.</em></h1><p>Explore filmes, séries e histórias de todo tipo. Encontre pelo gênero, época ou pelo que combina com você hoje.</p></header>
      <div className="acervo-collections" aria-label="Categorias do acervo">{collections.map(item => <button key={item.id} type="button" className={`acervo-collection${collection === item.id ? " is-active" : ""}`} aria-pressed={collection === item.id} onClick={() => chooseCollection(item.id)}><span>{item.label}</span><small>{item.description}</small></button>)}</div>
      <div className="acervo-divider" />
      <section className="acervo-discover" aria-label="Explorar por gênero"><div className="acervo-section-heading"><span className="eyebrow">ENCONTRE SEU CLIMA</span><h2>Explore por gênero<span>.</span></h2></div><div className="acervo-genres">{genres.filter(item => collection === "movies" || item.id === "all" || tvGenres.has(item.id)).map(item => <button type="button" key={item.id} className={genre === item.id ? "is-active" : ""} aria-pressed={genre === item.id} onClick={() => chooseGenre(item.id)}>{item.label}</button>)}</div></section>
      <section className="acervo-results" aria-label="Títulos do acervo"><div className="acervo-results-top"><div><span className="eyebrow">SELEÇÃO MOX</span><h2>{genre === "all" ? selectedCollection.label : `${selectedCollection.label} · ${genres.find(item => item.id === genre)?.label}`}</h2></div><div className="acervo-filters"><label className="acervo-select"><span>Ano</span><span className="acervo-select-control"><select value={year} onChange={event => {setYear(event.target.value);setPage(1);}} aria-label="Ano de lançamento"><option value="">Todos os anos</option>{Array.from({length:51},(_,i)=>new Date().getFullYear()-i).map(value=><option key={value} value={value}>{value}</option>)}</select><ChevronDown size={15} aria-hidden="true"/></span></label><label className="acervo-select"><span>Ordenar</span><span className="acervo-select-control"><select value={sort} onChange={event => {setSort(event.target.value);setPage(1);}} aria-label="Ordenar títulos">{sortOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={15} aria-hidden="true"/></span></label></div></div>
        {error && <div className="acervo-state" role="alert">Não conseguimos carregar esta seleção. <button onClick={()=>setAttempt(current=>current+1)}>Tentar novamente</button></div>}
        {!error && <div className="acervo-grid" aria-busy={loading}>{loading ? Array.from({length:18},(_,i)=><div key={i} className="acervo-skeleton"/>) : items.map(item=><MediaCard key={item.id} item={item} type={mediaType}/>)}</div>}
        {!loading && !error && items.length===0 && <div className="acervo-state"><Search size={22}/><p>Nenhum título nesta combinação. Tente outro filtro.</p></div>}
        {!error && pages>1 && <nav className="acervo-pagination" aria-label="Páginas do acervo"><button type="button" disabled={page===1 || loading} onClick={()=>setPage(n=>Math.max(1,n-1))} aria-label="Página anterior"><ChevronLeft size={19}/></button><span>Página {page} de {pages}</span><button type="button" disabled={page>=pages || loading} onClick={()=>setPage(n=>Math.min(pages,n+1))} aria-label="Próxima página"><ChevronRight size={19}/></button></nav>}
      </section>
      <aside className="acervo-next"><span>CONTINUE EXPLORANDO</span><p>Uma boa história sempre puxa outra.</p><Link to="/search">Buscar pelo nome <ChevronRight size={16}/></Link></aside>
    </main><SiteFooter />
  </div>;
}
