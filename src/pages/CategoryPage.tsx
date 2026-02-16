import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { fetchCategory, CATEGORIES, MediaItem, getTitle, getYear, getRating, posterUrl } from "@/lib/tmdb";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";

const categoryLabels: Record<string, string> = {
  movies: "🎬 Filmes Populares",
  series: "📺 Séries",
  anime: "⚡ Animes",
  doramas: "🌸 Doramas",
  novelas: "🇧🇷 Novelas",
};

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const endpoint = CATEGORIES[category as keyof typeof CATEGORIES];

  useEffect(() => {
    if (!endpoint) return;
    setLoading(true);
    fetchCategory(endpoint, page)
      .then((data) => {
        setItems(data.results);
        setTotalPages(Math.min(data.total_pages, 20));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
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
      <div className="pt-24 px-4 md:px-8 max-w-[1400px] mx-auto pb-12">
        <h1 className="text-2xl font-bold mb-8">{categoryLabels[category!] || category}</h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {loading
            ? Array.from({ length: 18 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] rounded-lg bg-muted animate-shimmer bg-gradient-to-r from-muted via-surface-hover to-muted bg-[length:200%_100%]" />
              ))
            : items.filter(i => i.poster_path).map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/details/${mediaType}/${item.id}`)}
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
                      <span className="flex items-center gap-1 text-xs text-rating font-bold">
                        <Star className="w-3 h-3 fill-current" /> {getRating(item)}%
                      </span>
                    </div>
                  </div>
                  <h3 className="text-sm font-medium mt-2 truncate">{getTitle(item)}</h3>
                  <p className="text-xs text-muted-foreground">{getYear(item)}</p>
                </div>
              ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-4 mt-10">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="bg-secondary hover:bg-surface-hover disabled:opacity-30 p-2 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="bg-secondary hover:bg-surface-hover disabled:opacity-30 p-2 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
