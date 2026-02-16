const TMDB_API_KEY = "5768cb6af3cda69c23d9b4075c0aac34";
const BASE_URL = "https://api.themoviedb.org/3/";
const IMG_BASE = "https://image.tmdb.org/t/p/";

export { TMDB_API_KEY, BASE_URL, IMG_BASE };

export interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
  genre_ids?: number[];
  popularity: number;
}

export interface MediaDetails extends MediaItem {
  genres: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  credits: {
    cast: CastMember[];
    crew: { job: string; name: string; profile_path: string | null }[];
  };
  "watch/providers"?: {
    results?: {
      BR?: {
        flatrate?: Provider[];
        rent?: Provider[];
        buy?: Provider[];
      };
    };
  };
  seasons?: Season[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface Season {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  poster_path: string | null;
  air_date?: string;
}

export interface Episode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string | null;
  air_date?: string;
  vote_average: number;
}

export function getTitle(item: MediaItem): string {
  return item.title || item.name || "Sem título";
}

export function getYear(item: MediaItem): string {
  return (item.release_date || item.first_air_date || "").split("-")[0];
}

export function getRating(item: MediaItem): number {
  return Math.round(item.vote_average * 10);
}

export function posterUrl(path: string | null, size = "w500"): string {
  if (!path) return "/placeholder.svg";
  return `${IMG_BASE}${size}${path}`;
}

export function backdropUrl(path: string | null, size = "original"): string {
  if (!path) return "/placeholder.svg";
  return `${IMG_BASE}${size}${path}`;
}

async function tmdbFetch<T>(endpoint: string): Promise<T> {
  const sep = endpoint.includes("?") ? "&" : "?";
  const res = await fetch(`${BASE_URL}${endpoint}${sep}api_key=${TMDB_API_KEY}&language=pt-BR`);
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  return res.json();
}

export async function fetchTrending(): Promise<MediaItem[]> {
  const [movies, tv] = await Promise.all([
    tmdbFetch<{ results: MediaItem[] }>("trending/movie/day"),
    tmdbFetch<{ results: MediaItem[] }>("trending/tv/day"),
  ]);
  return [...movies.results, ...tv.results]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 10)
    .map((item) => ({
      ...item,
      media_type: item.first_air_date ? "tv" : "movie",
    }));
}

export async function fetchCategory(
  endpoint: string,
  page = 1
): Promise<{ results: MediaItem[]; total_pages: number }> {
  return tmdbFetch(`${endpoint}&page=${page}`);
}

export async function fetchDetails(id: number, type: "movie" | "tv"): Promise<MediaDetails> {
  return tmdbFetch(`${type}/${id}?append_to_response=credits,watch/providers`);
}

export async function fetchSeasonEpisodes(tvId: number, seasonNumber: number): Promise<Episode[]> {
  const data = await tmdbFetch<{ episodes: Episode[] }>(`tv/${tvId}/season/${seasonNumber}`);
  return data.episodes;
}

export interface VideoResult {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
}

export async function fetchVideos(id: number, type: "movie" | "tv"): Promise<VideoResult[]> {
  const data = await tmdbFetch<{ results: VideoResult[] }>(`${type}/${id}/videos`);
  // Also try English if no PT results
  if (!data.results.length) {
    const enRes = await fetch(`${BASE_URL}${type}/${id}/videos?api_key=${TMDB_API_KEY}&language=en-US`);
    const enData = await enRes.json();
    return enData.results || [];
  }
  return data.results;
}

export async function searchMulti(
  query: string,
  page = 1
): Promise<{ results: MediaItem[]; total_pages: number }> {
  return tmdbFetch(`search/multi?query=${encodeURIComponent(query)}&page=${page}`);
}

// Category endpoints
export const CATEGORIES = {
  movies: "movie/popular?sort_by=popularity.desc&vote_count.gte=1000",
  series: "tv/top_rated?sort_by=popularity.desc&vote_count.gte=1000",
  anime: "discover/tv?sort_by=popularity.desc&with_genres=16&with_keywords=210024|222243&vote_count.gte=100",
  doramas: "discover/tv?sort_by=popularity.desc&with_original_language=ko|ja|zh&without_genres=16&vote_count.gte=50",
  novelas: "discover/tv?sort_by=popularity.desc&with_origin_country=BR&with_genres=18&without_keywords=210024|222243&vote_count.gte=20",
} as const;
