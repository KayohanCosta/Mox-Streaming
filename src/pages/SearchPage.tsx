import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { searchMulti, MediaItem, getTitle, getYear, getRating, posterUrl } from "@/lib/tmdb";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Search, Star } from "lucide-react";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | "movie" | "tv">("all");
  const navigate = useNavigate();

  useEffect(() => {
    if (!query) return;
    setLoading(true);
    searchMulti(query)
      .then((data) => setResults(data.results.filter((r) => r.poster_path && (r.media_type === "movie" || r.media_type === "tv"))))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [query]);

  const filtered = filter === "all" ? results : results.filter((r) => r.media_type === filter);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-24 px-4 md:px-8 max-w-[1400px] mx-auto pb-12">
        <h1 className="text-2xl font-bold mb-2">
          {query ? `Resultados para "${query}"` : "Buscar"}
        </h1>

        {/* Filters */}
        <div className="flex gap-2 mb-8">
          {(["all", "movie", "tv"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-surface-hover"
              }`}
            >
              {f === "all" ? "Todos" : f === "movie" ? "Filmes" : "Séries"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-lg bg-muted animate-shimmer bg-gradient-to-r from-muted via-surface-hover to-muted bg-[length:200%_100%]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="w-16 h-16 mb-4 opacity-30" />
            <p className="text-lg">Nenhum resultado encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/details/${item.media_type}/${item.id}`)}
                className="cursor-pointer group"
              >
                <div className="aspect-[2/3] rounded-lg overflow-hidden bg-surface relative">
                  <img
                    src={posterUrl(item.poster_path)}
                    alt={getTitle(item)}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 gradient-card opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <div className="flex items-center gap-1 text-xs">
                      <Star className="w-3 h-3 text-rating fill-current" />
                      <span className="text-rating font-bold">{getRating(item)}%</span>
                    </div>
                  </div>
                </div>
                <h3 className="text-sm font-medium mt-2 truncate">{getTitle(item)}</h3>
                <p className="text-xs text-muted-foreground">{getYear(item)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
