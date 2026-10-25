import { activeProfileId, getProfiles } from "@/lib/profiles";
import { ProfileAvatar } from "./ProfileGate";
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, Home, Film, Tv, Sparkles, Menu, X, Star, Bookmark } from "lucide-react";
import { searchMulti, MediaItem, getTitle, getYear, getRating, posterUrl } from "@/lib/tmdb";

const navItems = [
  { label: "Início", path: "/", icon: Home },
  { label: "Filmes", path: "/category/movies", icon: Film },
  { label: "Séries", path: "/category/series", icon: Tv },
  { label: "Animes", path: "/category/anime", icon: Sparkles },
  { label: "Doramas", path: "/category/doramas", icon: Tv },
  { label: "Novelas", path: "/category/novelas", icon: Tv },
  { label: "TV", path: "/tv", icon: Tv },
  ...(import.meta.env.DEV&&import.meta.env.VITE_ADDON_LOCAL_TEST==="1"?[{label:"Acervo",path:"/acervo",icon:Film}]:[]),
  { label: "Minha lista", path: "/my-list", icon: Bookmark },
];

export default function Navbar() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchLoading,setSearchLoading]=useState(false);
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

  useEffect(()=>{if(!searchOpen)return;const onKey=(e:KeyboardEvent)=>{if(e.key==="Escape"){setSearchOpen(false);setQuery("");setShowSuggestions(false);}};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey);},[searchOpen]);

  // Debounced search
  useEffect(() => {
    let active=true;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(() => {
      searchMulti(query)
        .then((data) => {
          if(!active)return;
          const filtered = data.results
            .filter((r) => r.poster_path && (r.media_type === "movie" || r.media_type === "tv"))
            .slice(0, 6);
          setSuggestions(filtered);
          setShowSuggestions(filtered.length > 0);
        })
        .catch(()=>{if(active)setSuggestions([]);})
        .finally(()=>{if(active)setSearchLoading(false);});
    }, 220);
    return () => { active=false;if (debounceRef.current) clearTimeout(debounceRef.current); };
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

  const profile = getProfiles().find(p => p.id === activeProfileId());
  return (
    <nav className="mox-navbar fixed top-0 left-0 right-0 z-50">
      <div className="nav-inner">
        <div className="flex items-center justify-between h-20 gap-6">
          {/* Logo */}
          <Link to="/" aria-label="MOX, início" className={`${searchOpen ? "hidden sm:flex" : "flex"} items-center gap-1 flex-shrink-0`}>
            <span className="brand-wordmark">mox<span>•</span></span>
          </Link>

          {/* Desktop Nav */}
          <div className={`${searchOpen?"hidden 2xl:flex":"hidden xl:flex"} items-center gap-7`}>
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item text-sm font-medium transition-colors hover:text-foreground ${
                  location.pathname === item.path ? "nav-active text-foreground" : "text-foreground/55"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Search & Mobile toggle */}
          <div className="flex items-center gap-3">
            {searchOpen ? (
              <div ref={containerRef} className="premium-search relative w-[clamp(15rem,34vw,30rem)] max-w-[56vw]">
                <form onSubmit={handleSearch} role="search" className="premium-search-field">
                  <Search aria-hidden="true" className="search-leading-icon" size={18}/>
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                    aria-label="Buscar títulos" aria-busy={searchLoading} placeholder="Buscar filmes e séries"
                    className="flex-1 min-w-0 bg-transparent text-foreground text-base px-4 py-2.5 focus:outline-none placeholder:text-foreground/55"
                  />
                  <button aria-label="Buscar" type="submit" className="search-submit">
                    <span aria-hidden="true">↵</span>
                  </button>
                </form>

                {/* Suggestions Dropdown */}
                {(showSuggestions||searchLoading||(query.trim().length>=2)) && (
                  <div className="search-results-panel absolute top-full left-0 right-0 z-50">
                    <div className="search-results-heading"><span>{searchLoading?"BUSCANDO HISTÓRIAS":"ENCONTRAMOS PARA VOCÊ"}</span><kbd>ESC</kbd></div>
                    {!searchLoading&&!suggestions.length&&<p className="search-empty">Nenhum título encontrado. Tente outro nome.</p>}
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
              <button onClick={() => setSearchOpen(true)} aria-label="Abrir busca" className="nav-icon text-foreground/70 hover:text-foreground transition-colors">
                <Search className="w-5 h-5" />
              </button>
            )}
            {searchOpen && (
              <button aria-label="Fechar busca" onClick={() => { setSearchOpen(false); setQuery(""); setSuggestions([]); setShowSuggestions(false); }} className="text-foreground/70 hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            )}
            {profile && <Link to="/profiles" className="nav-profile" aria-label={`Trocar perfil: ${profile.name}`}><ProfileAvatar profile={profile} small/></Link>}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={mobileOpen} className="nav-icon xl:hidden text-foreground/70 hover:text-foreground"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="xl:hidden bg-background/95 backdrop-blur-md border-t border-border animate-fade-in">
          <div className="nav-inner py-4 space-y-1">
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
