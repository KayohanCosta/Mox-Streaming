import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
export default function SiteFooter() {
  return <footer className="site-footer"><div><Link to="/" className="brand-wordmark">mox<span>•</span></Link><p>Histórias que ficam com você.</p></div><div className="footer-links"><Link to="/my-list">Minha lista <ArrowUpRight size={13}/></Link><Link to="/category/movies">Filmes <ArrowUpRight size={13} /></Link><Link to="/category/series">Séries <ArrowUpRight size={13} /></Link></div><span className="footer-note">Seu tempo. Sua próxima história.</span></footer>;
}
