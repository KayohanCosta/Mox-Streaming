import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, Home, Film, Tv, Sparkles, Menu, X, Star } from "lucide-react";
import { searchMulti, MediaItem, getTitle, getYear, getRating, posterUrl } from "@/lib/tmdb";

const navItems = [
  { label: "Início", path: "/", icon: Home },
  { label: "Filmes", path: "/category/movies", icon: Film },
  { label: "Séries", path: "/category/series", icon: Tv },
  { label: "Animes", path: "/category/anime", icon: Sparkles },
  { label: "Doramas", path: "/category/doramas", icon: Tv },
];

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<MediaItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close suggestions on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => {
      searchMulti(query)
        .then((data) => {
          const filtered = data.results
            .filter((r) => r.poster_path && (r.media_type === "movie" || r.media_type === "tv"))
            .slice(0, 6);
          setSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
        })
        .catch(console.error);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (item: MediaItem) => {
    navigate(`/details/${item.media_type}/${item.id}`);
    setSearchOpen(false);
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background/95 via-background/70 to-transparent backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1 flex-shrink-0">
            <span className="text-primary font-black text-2xl tracking-tight">MOX</span>
            <span className="text-foreground font-light text-lg hidden sm:inline">Streaming</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.pathname === item.path ? "text-primary" : "text-foreground/70"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Search & Mobile toggle */}
          <div className="flex items-center gap-3">
            {searchOpen ? (
              <div ref={containerRef} className="relative">
                <form onSubmit={handleSearch} className="flex items-center">
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    placeholder="Buscar filmes, séries..."
                    className="bg-secondary text-foreground text-sm rounded-l-lg px-4 py-2 w-48 md:w-72 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button type="submit" className="bg-primary text-primary-foreground px-3 py-2 rounded-r-lg">
                    <Search className="w-4 h-4" />
                  </button>
                </form>

                {/* Suggestions Dropdown */}
                {showSuggestions && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-2xl overflow-hidden z-50 animate-fade-in">
                    {suggestions.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleSuggestionClick(item)}
                        className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-secondary/80 transition-colors text-left"
                      >
                        <img
                          src={posterUrl(item.poster_path, "w92")}
                          alt={getTitle(item)}
                          className="w-10 h-14 rounded object-cover flex-shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{getTitle(item)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{item.media_type === "movie" ? "Filme" : "Série"}</span>
                            <span>{getYear(item)}</span>
                            <span className="flex items-center gap-0.5 text-rating">
                              <Star className="w-3 h-3 fill-current" />
                              {getRating(item)}%
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                    <button
                      onClick={handleSearch}
                      className="w-full px-3 py-2.5 text-sm text-primary hover:bg-secondary/80 transition-colors text-center border-t border-border"
                    >
                      Ver todos os resultados para "{query}"
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="text-foreground/70 hover:text-foreground transition-colors">
                <Search className="w-5 h-5" />
              </button>
            )}
            {searchOpen && (
              <button onClick={() => { setSearchOpen(false); setQuery(""); setSuggestions([]); setShowSuggestions(false); }} className="text-foreground/70 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-foreground/70 hover:text-foreground"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-background/95 backdrop-blur-md border-t border-border animate-fade-in">
          <div className="px-4 py-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/70 hover:bg-secondary"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
