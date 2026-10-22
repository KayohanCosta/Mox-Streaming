import { useState, useEffect } from "react";
import { fetchTrending, fetchTop10Brasil, fetchCategory, CATEGORIES, MediaItem } from "@/lib/tmdb";
import EditorialShelf from "@/components/EditorialShelf";
import CollectionTiles from "@/components/CollectionTiles";
import HeroBanner from "@/components/HeroBanner";
import ContentRow from "@/components/ContentRow";
import Top10Row from "@/components/Top10Row";
import ContinueWatchingRow from "@/components/ContinueWatchingRow";
import SiteFooter from "@/components/SiteFooter";
import Navbar from "@/components/Navbar";
import { useSavedTitles,savedAsMedia } from "@/hooks/useSavedTitles";
import { RefreshCw } from "lucide-react";
import { useWatchProgress } from "@/hooks/useWatchProgress";

const Index = () => {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [top10, setTop10] = useState<MediaItem[]>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [series, setSeries] = useState<MediaItem[]>([]);
  const [anime, setAnime] = useState<MediaItem[]>([]);
  const [doramas, setDoramas] = useState<MediaItem[]>([]);
  const [novelas, setNovelas] = useState<MediaItem[]>([]);
  const [pending,setPending]=useState<Record<string,boolean>>({trending:true,top10:true,movies:true,series:true,anime:true,doramas:true,novelas:true});
  const [failed,setFailed]=useState<string[]>([]);
  const [attempt,setAttempt]=useState(0);
  const saved=useSavedTitles();
  const { items: watchProgress } = useWatchProgress();

  useEffect(() => {
    let active=true;setFailed([]);setPending({trending:true,top10:true,movies:true,series:true,anime:true,doramas:true,novelas:true});
    const run=<T,>(key:string,promise:Promise<T>,apply:(data:T)=>void)=>{void promise.then(data=>{if(active)apply(data);}).catch(()=>{if(active)setFailed(old=>[...old,key]);}).finally(()=>{if(active)setPending(old=>({...old,[key]:false}));});};
    run('trending',fetchTrending(),setTrending);run('top10',fetchTop10Brasil(),setTop10);
    run('movies',fetchCategory(CATEGORIES.movies),data=>setMovies(data.results));
    run('series',fetchCategory(CATEGORIES.series),data=>setSeries(data.results));
    run('anime',fetchCategory(CATEGORIES.anime),data=>setAnime(data.results));
    run('doramas',fetchCategory(CATEGORIES.doramas),data=>setDoramas(data.results));
    run('novelas',fetchCategory(CATEGORIES.novelas),data=>setNovelas(data.results));
    return()=>{active=false;};
  }, [attempt]);

  return (
    <div className="premium-home min-h-screen bg-background">
      <Navbar />
      <div className="home-intro"><span className="eyebrow">MOX / SEU UNIVERSO DE HISTÓRIAS</span><span>Escolha o que faz seu tempo valer.</span></div>
      <HeroBanner items={trending} isLoading={pending.trending} />
      <main className="home-catalog">
        <CollectionTiles />
        {failed.length>0&&<div className="catalog-notice home-notice"><span>Algumas coleções não carregaram. Você pode continuar explorando as demais.</span><button onClick={()=>setAttempt(n=>n+1)}><RefreshCw size={13}/> Atualizar</button></div>}
        <ContinueWatchingRow items={watchProgress} />
        <Top10Row items={top10} isLoading={pending.top10} />
        {saved.length>0&&<ContentRow title="Sua lista, seu momento" items={saved.map(savedAsMedia)} mediaType="saved"/>}
        <EditorialShelf items={trending.slice(2)} />
        <ContentRow title="Filmes Populares" items={movies} mediaType="filme" isLoading={pending.movies} />
        <ContentRow title="Séries Mais Bem Avaliadas" items={series} mediaType="serie" isLoading={pending.series} />
        <ContentRow title="Animes" items={anime} mediaType="anime" isLoading={pending.anime} />
        <ContentRow title="Doramas" items={doramas} mediaType="dorama" isLoading={pending.doramas} />
        <ContentRow title="Novelas" items={novelas} mediaType="novela" isLoading={pending.novelas} />
      </main>
      <SiteFooter />
    </div>
  );
};

export default Index;
