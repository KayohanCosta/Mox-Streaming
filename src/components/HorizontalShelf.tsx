import { useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  className?: string;
}

export default function HorizontalShelf({ title, eyebrow, children, className = "" }: Props) {
  const track = useRef<HTMLDivElement>(null);
  const move = (direction: number) => track.current?.scrollBy({ left: direction * Math.max(320, track.current.clientWidth * 0.8), behavior: "smooth" });
  return <section className={`mox-shelf ${className}`} aria-label={title}>
    <div className="mox-shelf-heading">
      <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
      <div className="mox-shelf-controls">
        <button type="button" aria-label={`Rolar ${title} para a esquerda`} onClick={() => move(-1)}><ChevronLeft size={20} /></button>
        <button type="button" aria-label={`Rolar ${title} para a direita`} onClick={() => move(1)}><ChevronRight size={20} /></button>
      </div>
    </div>
    <div ref={track} className="mox-shelf-track" tabIndex={0} aria-label={`Lista horizontal de ${title}`}>{children}</div>
  </section>;
}
