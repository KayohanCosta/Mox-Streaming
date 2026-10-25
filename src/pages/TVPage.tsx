import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import "./TVPage.css";

export default function TVPage() {
  return <div className="tv-preview-page">
    <Navbar />
    <main className="tv-preview-main">
      <section className="tv-preview-shell" aria-labelledby="tv-preview-title">
        <div className="tv-preview-meta"><span>MOX / TV</span><span><i /> EM CONSTRUÇÃO</span></div>
        <div className="tv-preview-rule" />
        <div className="tv-preview-body">
          <div className="tv-preview-message">
            <span className="tv-preview-index">01 / UMA NOVA EXPERIÊNCIA</span>
            <h1 id="tv-preview-title">A TV da MOX<br />está em <span>construção.</span></h1>
            <p>Estamos preparando algo especial para você. Por enquanto, aproveite as histórias que já estão por aqui.</p>
            <Link to="/" className="tv-preview-link">Explorar o catálogo <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
          <div className="tv-preview-blueprint" aria-hidden="true">
            <div className="tv-preview-blueprint-top"><span>PROJETO 001</span><span>MOX.TV</span></div>
            <div className="tv-preview-blueprint-lines"><span /><span /><span /><span /></div>
            <strong>TV</strong>
            <div className="tv-preview-blueprint-bottom"><span>EM DESENVOLVIMENTO</span><span>●</span></div>
          </div>
        </div>
        <div className="tv-preview-rule" />
        <div className="tv-preview-foot"><span>UMA NOVA FORMA DE ESTAR AO VIVO.</span><span>EM BREVE NA MOX</span></div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
