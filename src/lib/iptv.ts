// src/lib/iptv.ts

export interface IPTVStream {
  title: string;
  tmdbId?: string;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  year?: string;
  url: string;
}

const IPTV_URL = "/iptv?username=16759891&password=66798188&type=m3u_plus&output=ts";

let cachedList: IPTVStream[] | null = null;

export async function fetchIPTVList(): Promise<IPTVStream[]> {
  if (cachedList) return cachedList;
  const res = await fetch(IPTV_URL);
  if (!res.ok) throw new Error("Falha ao baixar lista IPTV");
  const text = await res.text();
  cachedList = parseM3U(text);
  return cachedList;
}

function parseM3U(m3u: string): IPTVStream[] {
  const lines = m3u.split("\n");
  const streams: IPTVStream[] = [];
  let current: Partial<IPTVStream> = {};
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#EXTINF")) {
      // Exemplo: #EXTINF:-1 tvg-id="" tvg-name="Nome" group-title="Filmes", Nome do Filme (TMDB:12345)
      const info = line.match(/#EXTINF:[^,]*,(.*)/);
      const rawTitle = info ? info[1].trim() : "";
      const tvgNameMatch = line.match(/tvg-name="([^"]+)"/i);
      const tvgIdMatch = line.match(/tvg-id="([^"]+)"/i);
      const title = (tvgNameMatch ? tvgNameMatch[1] : rawTitle).trim();
      current = { title: cleanupTitle(title) };
      // Extrair TMDB ID
      const tmdbMatch = (tvgIdMatch?.[1] || rawTitle).match(/TMDB:(\d+)/i);
      if (tmdbMatch) current.tmdbId = tmdbMatch[1];
      if (!current.tmdbId && tvgIdMatch?.[1] && /^\d+$/.test(tvgIdMatch[1])) {
        current.tmdbId = tvgIdMatch[1];
      }
      // Extrair grupo
      const groupMatch = line.match(/group-title="([^"]+)"/);
      if (groupMatch) {
        const group = groupMatch[1].toLowerCase();
        current.type = group.includes("serie") || group.includes("series") || group.includes("tv") ? "tv" : "movie";
      }
      // Extrair temporada e episódio
      const seasonEpMatch = rawTitle.match(/T(\d+)E(\d+)/i)
        || rawTitle.match(/S(\d+)E(\d+)/i)
        || rawTitle.match(/(\d+)[xX](\d+)/);
      if (seasonEpMatch) {
        current.season = parseInt(seasonEpMatch[1]);
        current.episode = parseInt(seasonEpMatch[2]);
        current.type = "tv";
      }
      const yearMatch = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) current.year = yearMatch[1];
    } else if (line && !line.startsWith("#")) {
      // URL .ts
      current.url = line;
      if (!current.type) current.type = "movie";
      streams.push(current as IPTVStream);
      current = {};
    }
  }
  return streams;
}

function cleanupTitle(title: string): string {
  return title
    .replace(/\(.*?TMDB:\d+.*?\)/gi, "")
    .replace(/TMDB:\d+/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findStreamInIPTVList(params: {
  tmdbId: string;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  title?: string;
  altTitle?: string;
  year?: string;
}): Promise<string | null> {
  const list = await fetchIPTVList();
  // Match prioritário por TMDB ID
  let filtered = list.filter(s => s.tmdbId === params.tmdbId && s.type === params.type);
  if (params.type === "tv" && params.season && params.episode) {
    filtered = filtered.filter(s => s.season === params.season && s.episode === params.episode);
  }
  if (filtered.length > 0) return filtered[0].url;
  // Fallback por nome (case-insensitive)
  if (!params.title && !params.altTitle) return null;
  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/gi, "");
  const target = normalize(params.title || "");
  const altTarget = normalize(params.altTitle || "");
  let fallback = list.filter((s) => {
    const n = normalize(s.title);
    return n === target || n.includes(target) || target.includes(n) || (altTarget && (n === altTarget || n.includes(altTarget) || altTarget.includes(n)));
  });
  if (params.type === "tv" && params.season && params.episode) {
    fallback = fallback.filter(s => s.season === params.season && s.episode === params.episode);
  }
  if (params.year) {
    fallback = fallback.filter((s) => !s.year || s.year === params.year);
  }
  if (fallback.length > 0) return fallback[0].url;
  return null;
}
