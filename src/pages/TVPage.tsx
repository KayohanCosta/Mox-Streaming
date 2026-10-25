import { Link } from "react-router-dom";
import { ArrowUpRight, Radio, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import "./TVPage.css";

export default function TVPage() {
  return <div className="tv-coming-page">
    <Navbar />
    <main className="tv-coming-main">
      <div className="tv-coming-grid" aria-hidden="true" />
      <div className="tv-coming-orb tv-coming-orb-one" aria-hidden="true" />
      <div className="tv-coming-orb tv-coming-orb-two" aria-hidden="true" />
      <section className="tv-coming-content" aria-labelledby="tv-coming-title">
        <div className="tv-coming-copy">
          <div className="tv-coming-kicker"><span className="tv-coming-kicker-dot" /> MOX TV <span className="tv-coming-kicker-line" /> EM CONSTRUÇÃO</div>
          <h1 id="tv-coming-title">Estamos construindo <em>algo legal</em> para você<span className="tv-coming-period">.</span></h1>
          <p>A TV da MOX está ganhando forma. Estamos preparando uma nova maneira de descobrir e acompanhar o que acontece ao vivo.</p>
          <div className="tv-coming-actions">
            <Link to="/" className="tv-coming-primary">Explorar a MOX <ArrowUpRight size={18} aria-hidden="true" /></Link>
            <Link to="/category/movies" className="tv-coming-secondary">Ver filmes</Link>
          </div>
          <div className="tv-coming-note"><Sparkles size={15} aria-hidden="true" /><span>As melhores histórias continuam esperando por você.</span></div>
        </div>
        <div className="tv-coming-art" aria-hidden="true">
          <div className="tv-coming-art-top"><span>MOX / LAB</span><span>01 — TV</span></div>
          <div className="tv-coming-art-center">
            <div className="tv-coming-ring tv-coming-ring-outer" />
            <div className="tv-coming-ring tv-coming-ring-middle" />
            <div className="tv-coming-ring tv-coming-ring-inner" />
            <div className="tv-coming-emblem"><Radio strokeWidth={1.25} /></div>
            <div className="tv-coming-art-wordmark">mox<span>•</span><small>tv</small></div>
          </div>
          <div className="tv-coming-art-bottom"><span>SINAL EM PREPARAÇÃO</span><div className="tv-coming-progress"><i /></div><span>EM BREVE</span></div>
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
