import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Search, Home, Film, Tv, Sparkles, Menu, X } from "lucide-react";

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
  const navigate = useNavigate();
  const location = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setSearchOpen(false);
      setQuery("");
    }
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
              <form onSubmit={handleSearch} className="flex items-center">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar filmes, séries..."
                  className="bg-secondary text-foreground text-sm rounded-l-lg px-4 py-2 w-48 md:w-64 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button type="submit" className="bg-primary text-primary-foreground px-3 py-2 rounded-r-lg">
                  <Search className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <button onClick={() => setSearchOpen(true)} className="text-foreground/70 hover:text-foreground transition-colors">
                <Search className="w-5 h-5" />
              </button>
            )}
            {searchOpen && (
              <button onClick={() => { setSearchOpen(false); setQuery(""); }} className="text-foreground/70 hover:text-foreground">
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
