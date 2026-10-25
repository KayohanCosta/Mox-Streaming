export interface IPTVStream {
  title: string;
  category?: string;
  logo?: string;
  locationHint?: string;
  tmdbId?: string;
  type: "movie" | "tv";
  season?: number;
  episode?: number;
  year?: string;
  url: string;
}

export type IPTVPlaylistConfig =
  | { source: "url"; value: string }
  | { source: "content"; value: string };

const IPTV_STORAGE_KEY = "mox_iptv_playlist";
let cachedList: IPTVStream[] | null = null;

export function getIPTVPlaylistConfig(): IPTVPlaylistConfig | null {
  const value = localStorage.getItem(IPTV_STORAGE_KEY);
  if (!value) return null;

  const config: unknown = JSON.parse(value);
  if (
    typeof config !== "object" ||
    config === null ||
    !("source" in config) ||
    !("value" in config) ||
    typeof config.source !== "string" ||
    typeof config.value !== "string" ||
    (config.source !== "url" && config.source !== "content")
  ) {
    throw new Error("A lista IPTV salva está inválida. Configure a lista novamente.");
  }

  return config as IPTVPlaylistConfig;
}

export async function saveIPTVPlaylist(config: IPTVPlaylistConfig): Promise<IPTVStream[]> {
  const streams = await loadPlaylist(config);
  if (streams.length === 0) {
    throw new Error("Nenhum canal ou conteúdo foi encontrado. Verifique se a lista está no formato M3U.");
  }

  localStorage.setItem(IPTV_STORAGE_KEY, JSON.stringify(config));
  cachedList = streams;
  return streams;
}

export function clearIPTVPlaylist(): void {
  localStorage.removeItem(IPTV_STORAGE_KEY);
  cachedList = null;
}

export async function fetchIPTVList(): Promise<IPTVStream[]> {
  if (cachedList) return cachedList;
  const config = getIPTVPlaylistConfig();
  if (!config) return [];
  cachedList = await loadPlaylist(config);
  return cachedList;
}

async function loadPlaylist(config: IPTVPlaylistConfig): Promise<IPTVStream[]> {
  if (config.source === "content") return parseM3U(config.value);

  let playlistUrl: URL;
  try {
    playlistUrl = new URL(config.value);
  } catch {
    throw new Error("Informe um endereço válido para a lista IPTV.");
  }
  if (playlistUrl.protocol !== "http:" && playlistUrl.protocol !== "https:") {
    throw new Error("O endereço da lista deve começar com http:// ou https://.");
  }

  let response: Response;
  try {
    response = await fetch(playlistUrl);
  } catch {
    throw new Error("Não foi possível acessar a lista. Verifique o endereço e se o servidor permite acesso pelo navegador.");
  }
  if (!response.ok) {
    throw new Error(`Falha ao baixar a lista IPTV (HTTP ${response.status}).`);
  }
  return parseM3U(await response.text());
}

export function parseM3U(m3u: string): IPTVStream[] {
  const lines = m3u.split(/\r?\n/);
  const streams: IPTVStream[] = [];
  let current: Partial<IPTVStream> = {};

  for (const sourceLine of lines) {
    const line = sourceLine.trim();
    if (line.startsWith("#EXTINF")) {
      const info = line.match(/#EXTINF:[^,]*,(.*)/);
      const rawTitle = info ? info[1].trim() : "";
      const tvgNameMatch = line.match(/tvg-name="([^"]+)"/i);
      const tvgIdMatch = line.match(/tvg-id="([^"]+)"/i);
      const locationMatch = line.match(/(?:tvg-country|tvg-region|tvg-city)="([^"]+)"/i);
      const title = (tvgNameMatch ? tvgNameMatch[1] : rawTitle).trim();
      current = { title: cleanupTitle(title) };
      if (locationMatch) current.locationHint = locationMatch[1].trim();

      const tmdbMatch = (tvgIdMatch?.[1] || rawTitle).match(/TMDB:(\d+)/i);
      if (tmdbMatch) current.tmdbId = tmdbMatch[1];
      if (!current.tmdbId && tvgIdMatch?.[1] && /^\d+$/.test(tvgIdMatch[1])) {
        current.tmdbId = tvgIdMatch[1];
      }

      const groupMatch = line.match(/group-title="([^"]+)"/i);
      const logoMatch = line.match(/tvg-logo="([^"]+)"/i);
      if (logoMatch && /^https?:\/\//i.test(logoMatch[1])) current.logo = logoMatch[1];
      if (groupMatch) {
        current.category = groupMatch[1].trim();
        const group = current.category.toLowerCase();
        current.type = group.includes("serie") || group.includes("series") || group.includes("tv") ? "tv" : "movie";
      }
      if (tvgIdMatch && /fortaleza|local|regional/i.test(tvgIdMatch[1])) {
        current.locationHint = [current.locationHint, tvgIdMatch[1]].filter(Boolean).join(" ");
      }

      const seasonEpMatch = rawTitle.match(/T(\d+)E(\d+)/i)
        || rawTitle.match(/S(\d+)E(\d+)/i)
        || rawTitle.match(/(\d+)[xX](\d+)/);
      if (seasonEpMatch) {
        current.season = parseInt(seasonEpMatch[1], 10);
        current.episode = parseInt(seasonEpMatch[2], 10);
        current.type = "tv";
      }

      const yearMatch = rawTitle.match(/\b(19\d{2}|20\d{2})\b/);
      if (yearMatch) current.year = yearMatch[1];
    } else if (line && !line.startsWith("#")) {
      if (current.title) {
        current.url = line;
        if (!current.type) current.type = "movie";
        streams.push(current as IPTVStream);
      }
      current = {};
    }
  }

  return streams;
}

export function filterLocalChannelsForFortaleza(streams: IPTVStream[]): IPTVStream[] {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return streams.filter((stream) => {
    const description = normalize([stream.title, stream.category, stream.locationHint].filter(Boolean).join(" "));
    const markedLocal = /\b(locais?|regionais?|cidades?)\b/.test(description);
    if (!markedLocal) return true;
    return /\bfortaleza\b/.test(description);
  });
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
  let filtered = list.filter((stream) => stream.tmdbId === params.tmdbId && stream.type === params.type);
  if (params.type === "tv" && params.season && params.episode) {
    filtered = filtered.filter((stream) => stream.season === params.season && stream.episode === params.episode);
  }
  if (filtered.length > 0) return filtered[0].url;
  if (!params.title && !params.altTitle) return null;

  const normalize = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/gi, "");
  const target = normalize(params.title || "");
  const altTarget = normalize(params.altTitle || "");
  let fallback = list.filter((stream) => {
    const name = normalize(stream.title);
    return name === target || name.includes(target) || target.includes(name)
      || (altTarget && (name === altTarget || name.includes(altTarget) || altTarget.includes(name)));
  });
  if (params.type === "tv" && params.season && params.episode) {
    fallback = fallback.filter((stream) => stream.season === params.season && stream.episode === params.episode);
  }
  if (params.year) {
    fallback = fallback.filter((stream) => !stream.year || stream.year === params.year);
  }
  return fallback.length > 0 ? fallback[0].url : null;
}
