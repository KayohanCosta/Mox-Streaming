import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
export default function NotFound() {
  return <div className="min-h-screen bg-background"><Navbar /><main className="min-h-screen flex flex-col items-center justify-center px-6 text-center"><span className="eyebrow mb-5">CENA NÃO ENCONTRADA · 404</span><h1 className="browse-title mb-5">Essa história mudou de endereço.</h1><p className="text-muted-foreground mb-8 max-w-md">A página que você procura não está disponível. Encontre seu próximo título na página inicial.</p><Link to="/" className="action-primary"><ArrowLeft size={17} /> Voltar ao início</Link></main></div>;
}
