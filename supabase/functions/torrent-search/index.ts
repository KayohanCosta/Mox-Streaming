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
    const query = url.searchParams.get("q");
    const type = url.searchParams.get("type") || "movie";

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Missing q parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Do multiple searches to maximize PT-BR results
    const searches = [
      query,
      `${query} dublado`,
      `${query} dual`,
      `${query} portuguese`,
    ];

    const allResults: TorrentResult[] = [];
    const seenHashes = new Set<string>();

    for (const sq of searches) {
      try {
        const res = await fetch(
          `https://apibay.org/q.php?q=${encodeURIComponent(sq)}&cat=200`,
          { headers: { Accept: "application/json" } }
        );
        if (res.ok) {
          const data: TorrentResult[] = await res.json();
          for (const r of data) {
            if (
              r.info_hash !== "0000000000000000000000000000000000000000" &&
              r.name !== "No results returned" &&
              !seenHashes.has(r.info_hash)
            ) {
              seenHashes.add(r.info_hash);
              allResults.push(r);
            }
          }
        }
      } catch { /* skip failed search */ }
    }

    const streams = allResults.map((r) => {
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
        title: `${quality} - ${r.name}`,
      };
    });

    // Sort: PT-BR first, then by seeds descending
    streams.sort((a, b) => {
      if (a.ptBr && !b.ptBr) return -1;
      if (!a.ptBr && b.ptBr) return 1;
      return b.seeds - a.seeds;
    });

    // Filter out very low seed torrents (keep at least some)
    const viable = streams.filter((s) => s.seeds >= 2);
    const result = viable.length >= 3 ? viable : streams;

    return new Response(
      JSON.stringify({ streams: result.slice(0, 30) }),
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
