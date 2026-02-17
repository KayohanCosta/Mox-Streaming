const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface TorrentResult {
  id: string;
  name: string;
  info_hash: string;
  seeders: string;
  leechers: string;
  size: string;
  added: string;
  category: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function isPtBrOrDual(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("dual") ||
    lower.includes("dublado") ||
    lower.includes("dub.") ||
    lower.includes("pt-br") ||
    lower.includes("portuguese") ||
    lower.includes("nacional") ||
    lower.includes("multi")
  );
}

function parseQuality(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("2160p") || lower.includes("4k")) return "4K";
  if (lower.includes("1080p")) return "1080p";
  if (lower.includes("720p")) return "720p";
  if (lower.includes("480p")) return "480p";
  if (lower.includes("bluray") || lower.includes("blu-ray")) return "BluRay";
  if (lower.includes("web-dl") || lower.includes("webdl") || lower.includes("webrip")) return "WEB-DL";
  if (lower.includes("hdtv")) return "HDTV";
  return "SD";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const query = url.searchParams.get("q"); // search query (movie/show name)
    const type = url.searchParams.get("type") || "movie"; // movie or tv
    const imdbId = url.searchParams.get("imdb_id") || "";

    if (!query && !imdbId) {
      return new Response(
        JSON.stringify({ error: "Missing q or imdb_id parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Search on apibay.org (ThePirateBay API)
    const searchQuery = query || imdbId;
    const cat = type === "movie" ? "200" : "200"; // Video category
    const apibayUrl = `https://apibay.org/q.php?q=${encodeURIComponent(searchQuery)}&cat=${cat}`;

    const response = await fetch(apibayUrl, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`apibay responded with ${response.status}: ${text}`);
    }

    const results: TorrentResult[] = await response.json();

    // Filter out "no results" placeholder
    const validResults = results.filter(
      (r) => r.info_hash !== "0000000000000000000000000000000000000000" && r.name !== "No results returned"
    );

    // Process and sort streams
    const streams = validResults.map((r) => {
      const ptBr = isPtBrOrDual(r.name);
      const quality = parseQuality(r.name);
      const seeds = parseInt(r.seeders) || 0;
      const sizeBytes = parseInt(r.size) || 0;
      const size = formatSize(sizeBytes);

      return {
        name: r.name,
        infoHash: r.info_hash,
        seeds,
        leechers: parseInt(r.leechers) || 0,
        size,
        sizeBytes,
        quality,
        ptBr,
        title: `${quality}\n${r.name}\n💾 ${size}\n👤 ${seeds}${ptBr ? "\n🇧🇷 PT-BR/Dual" : ""}`,
      };
    });

    // Sort: PT-BR first, then by seeds
    streams.sort((a, b) => {
      if (a.ptBr && !b.ptBr) return -1;
      if (!a.ptBr && b.ptBr) return 1;
      return b.seeds - a.seeds;
    });

    return new Response(
      JSON.stringify({ streams: streams.slice(0, 30) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
