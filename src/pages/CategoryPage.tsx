import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { fetchCategory, CATEGORIES, MediaItem } from "@/lib/tmdb";
import MediaCard from "@/components/MediaCard";
import SiteFooter from "@/components/SiteFooter";
import Navbar from "@/components/Navbar";
import { ChevronLeft, ChevronRight } from "lucide-react";

const categoryLabels: Record<string, string> = {
  movies: "Filmes Populares",
  series: "Séries",
  anime: "Animes",
  doramas: "Doramas",
  novelas: "Novelas",
};

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  return <CategoryBrowser key={category} category={category}/>;
}

function CategoryBrowser({category}:{category?:string}) {
  const [year,setYear]=useState("");
  const [error,setError]=useState(false);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const baseEndpoint = CATEGORIES[category as keyof typeof CATEGORIES];
  const endpoint=year&&baseEndpoint?(category==="movies"?`discover/movie?sort_by=popularity.desc&vote_count.gte=1000&primary_release_year=${year}`:category==="series"?`discover/tv?sort_by=vote_average.desc&vote_count.gte=1000&first_air_date_year=${year}`:`${baseEndpoint}&first_air_date_year=${year}`):baseEndpoint;

  useEffect(() => {
    if (!endpoint) return;
    let active=true;
    setLoading(true);setError(false);
    fetchCategory(endpoint, page)
      .then((data) => {
        if(!active)return;
        setItems(data.results);
        setTotalPages(Math.max(1,Math.min(data.total_pages,500)));
      })
      .catch(()=>{if(active)setError(true);})
      .finally(() => {if(active)setLoading(false);});
    return()=>{active=false;};
  }, [endpoint, page]);


  const mediaType = category === "movies" ? "movie" : "tv";

  if (!endpoint) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Navbar />
        <p className="text-muted-foreground">Categoria não encontrada</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="browse-page">
        <div className="browse-heading"><div><span className="eyebrow">EXPLORE O CATÁLOGO</span><h1 className="browse-title">{categoryLabels[category!] || category}</h1></div><label className="browse-year"><span>Ano de lançamento</span><select aria-label="Ano de lançamento" value={year} onChange={event=>{setYear(event.target.value);setPage(1);}}><option value="">Todos os anos</option>{Array.from({length:new Date().getFullYear()-1870+2},(_,i)=>new Date().getFullYear()+1-i).map(value=><option key={value} value={value}>{value}</option>)}</select></label></div>
        <p className="browse-limit-note">Explore as páginas disponíveis. Filtre por ano para aprofundar sua busca.</p>
        {error&&<p role="alert" className="mb-8 text-sm text-amber-200">Não foi possível carregar esta página. Tente novamente em instantes.</p>}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {loading
            ? Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-lg bg-muted animate-shimmer bg-gradient-to-r from-muted via-surface-hover to-muted bg-[length:200%_100%]" />
              ))
            : items.filter(i => i.poster_path).map((item) => (
<MediaCard key={item.id} item={item} type={mediaType} />
              ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="catalog-pagination flex justify-center items-center gap-4 mt-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Página anterior" disabled={loading||page === 1}
              className="bg-secondary hover:bg-surface-hover disabled:opacity-30 p-2 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Próxima página" disabled={loading||page >= totalPages}
              className="bg-secondary hover:bg-surface-hover disabled:opacity-30 p-2 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
