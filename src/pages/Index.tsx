import { useState, useEffect } from "react";
import { fetchTrending, fetchTop10Brasil, fetchCategory, CATEGORIES, MediaItem } from "@/lib/tmdb";
import HeroBanner from "@/components/HeroBanner";
import ContentRow from "@/components/ContentRow";
import Top10Row from "@/components/Top10Row";
import ContinueWatchingRow from "@/components/ContinueWatchingRow";
import Navbar from "@/components/Navbar";
import { useWatchProgress } from "@/hooks/useWatchProgress";

const Index = () => {
  const [trending, setTrending] = useState<MediaItem[]>([]);
  const [top10, setTop10] = useState<MediaItem[]>([]);
  const [movies, setMovies] = useState<MediaItem[]>([]);
  const [series, setSeries] = useState<MediaItem[]>([]);
  const [anime, setAnime] = useState<MediaItem[]>([]);
  const [doramas, setDoramas] = useState<MediaItem[]>([]);
  const [novelas, setNovelas] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { items: watchProgress } = useWatchProgress();

  useEffect(() => {
    async function load() {
      try {
        const [trendData, top10Data, movData, serData, aniData, dorData, novData] = await Promise.all([
          fetchTrending(),
          fetchTop10Brasil(),
          fetchCategory(CATEGORIES.movies),
          fetchCategory(CATEGORIES.series),
          fetchCategory(CATEGORIES.anime),
          fetchCategory(CATEGORIES.doramas),
          fetchCategory(CATEGORIES.novelas),
        ]);
        setTrending(trendData);
        setTop10(top10Data);
        setMovies(movData.results);
        setSeries(serData.results);
        setAnime(aniData.results);
        setDoramas(dorData.results);
        setNovelas(novData.results);
      } catch (err) {
        console.error("Error loading data:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroBanner items={trending} isLoading={loading} />
      <div className="-mt-20 relative z-10 pb-12">
        <ContinueWatchingRow items={watchProgress} />
        <Top10Row items={top10} isLoading={loading} />
        <ContentRow title="🔥 Em Alta no Brasil" items={trending} mediaType="trending" isLoading={loading} />
        <ContentRow title="🎬 Filmes Populares" items={movies} mediaType="filme" isLoading={loading} />
        <ContentRow title="📺 Séries Mais Bem Avaliadas" items={series} mediaType="serie" isLoading={loading} />
        <ContentRow title="⚡ Animes" items={anime} mediaType="anime" isLoading={loading} />
        <ContentRow title="🌸 Doramas" items={doramas} mediaType="dorama" isLoading={loading} />
        <ContentRow title="🇧🇷 Novelas" items={novelas} mediaType="novela" isLoading={loading} />
      </div>
    </div>
  );
};

export default Index;
