import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const controls = 'a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[role="button"][tabindex="0"],[role="link"][tabindex="0"]';

export default function DeviceNavigation() {
  const { pathname } = useLocation();
  const pageName=pathname==="/my-list"?"Minha lista":pathname==="/search"?"Buscar":pathname.startsWith("/category/")?({movies:"Filmes",series:"Séries",anime:"Animes",doramas:"Doramas",novelas:"Novelas"}[pathname.split("/").pop()!]||"Catálogo"):pathname.startsWith("/details/")?"Detalhes do título":"Início";
  useEffect(() => { window.scrollTo(0, 0); document.title=`${pageName} | MOX`; }, [pathname,pageName]);
  useEffect(() => {
    const forcedTV = new URLSearchParams(location.search).get("tv") === "1";
    const tv = forcedTV || /SmartTV|Tizen|Web0S|WebOS|Android TV|BRAVIA|AFT/i.test(navigator.userAgent);
    document.documentElement.classList.toggle("tv-mode", tv);
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable="true"]')) return;
      document.documentElement.dataset.input = "remote";
      const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
      const player = document.querySelector<HTMLElement>('.mox-player');
      if (event.key === "BrowserBack" || event.keyCode === 10009) {
        event.preventDefault(); event.stopPropagation();
        const close = dialog?.querySelector<HTMLButtonElement>('[data-dialog-close],[aria-label="Fechar episódios"]') || player?.querySelector<HTMLButtonElement>('[aria-label="Voltar"]');
        if (close) close.click(); else if (history.length > 1) history.back();
        return;
      }
      if (event.key === "MediaPlayPause" || event.keyCode === 10252) {
        const button = player?.querySelector<HTMLButtonElement>('[aria-label="Reproduzir"],[aria-label="Pausar"]');
        if (button) { event.preventDefault(); event.stopPropagation(); button.click(); }
        return;
      }
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
      if (player && !dialog && !target.closest('button,a')) {
        if (event.key === 'ArrowDown') {
          const play = player.querySelector<HTMLButtonElement>('[aria-label="Reproduzir"],[aria-label="Pausar"]');
          if (play) { event.preventDefault();event.stopPropagation();play.focus(); }
        }
        return;
      }
      const root = dialog || document;
      const items = [...root.querySelectorAll<HTMLElement>(controls)].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[aria-hidden="true"],.pointer-events-none');
      });
      if (!items.length) return;
      event.preventDefault(); event.stopPropagation();
      const active = document.activeElement as HTMLElement;
      if (!items.includes(active)) { items[0].focus(); return; }
      const from = active.getBoundingClientRect(); const x = from.x + from.width / 2, y = from.y + from.height / 2;
      const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
      const sign = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
      const ranked = items.filter(el => el !== active).map(el => {
        const r = el.getBoundingClientRect(); const dx = r.x + r.width/2 - x, dy = r.y + r.height/2 - y;
        const ahead = (horizontal ? dx : dy) * sign; const cross = Math.abs(horizontal ? dy : dx);
        return { el, ahead, score: ahead + cross * 3 + (cross > (horizontal ? from.height : from.width) ? cross * 4 : 0) };
      }).filter(item => item.ahead > 5).sort((a,b) => a.score - b.score);
      const next = ranked[0]?.el;
      if (next) { next.focus({preventScroll:true}); next.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'}); }
    };
    const onPointer = () => { delete document.documentElement.dataset.input; };
    document.addEventListener('keydown',onKey,true);
    document.addEventListener('pointerdown',onPointer,{passive:true});
    return () => { document.removeEventListener('keydown',onKey,true);document.removeEventListener('pointerdown',onPointer); };
  }, []);
  return <span className="sr-only" aria-live="polite" aria-atomic="true">{pageName}</span>;
}
