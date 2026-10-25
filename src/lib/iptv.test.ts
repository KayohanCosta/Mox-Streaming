import { afterEach, describe, expect, it } from "vitest";
import {
  clearIPTVPlaylist,
  fetchIPTVList,
  filterLocalChannelsForFortaleza,
  getIPTVPlaylistConfig,
  parseM3U,
  saveIPTVPlaylist,
} from "./iptv";

afterEach(() => {
  clearIPTVPlaylist();
});

describe("IPTV playlist", () => {
  it("parses M3U channels and their categories", () => {
    const streams = parseM3U([
      "#EXTM3U",
      '#EXTINF:-1 tvg-id="42" tvg-logo="https://example.com/logo.png" group-title="Canais",Canal de notícias',
      "https://example.com/news.m3u8",
      '#EXTINF:-1 group-title="Séries",Minha Série S02E03 (2024)',
      "https://example.com/series.mkv",
    ].join("\n"));

    expect(streams).toEqual([
      {
        title: "Canal de notícias",
        category: "Canais",
        logo: "https://example.com/logo.png",
        tmdbId: "42",
        type: "movie",
        url: "https://example.com/news.m3u8",
      },
      {
        title: "Minha Série S02E03 (2024)",
        category: "Séries",
        type: "tv",
        season: 2,
        episode: 3,
        year: "2024",
        url: "https://example.com/series.mkv",
      },
    ]);
  });

  it("saves a validated playlist for later use", async () => {
    const config = {
      source: "content" as const,
      value: "#EXTM3U\n#EXTINF:-1,Canal local\nhttps://example.com/live.m3u8",
    };

    await expect(saveIPTVPlaylist(config)).resolves.toHaveLength(1);
    expect(getIPTVPlaylistConfig()).toEqual(config);
    await expect(fetchIPTVList()).resolves.toHaveLength(1);
  });

  it("does not save a playlist that contains no streams", async () => {
    await expect(saveIPTVPlaylist({ source: "content", value: "#EXTM3U\n" }))
      .rejects.toThrow("Nenhum canal ou conteúdo foi encontrado");
    expect(getIPTVPlaylistConfig()).toBeNull();
  });

  it("keeps general channels and only explicitly Fortaleza local channels", () => {
    const streams = parseM3U([
      "#EXTM3U",
      '#EXTINF:-1 group-title="Notícias",Canal nacional',
      'https://example.com/nacional.m3u8',
      '#EXTINF:-1 group-title="Canais Locais" tvg-city="Fortaleza",Canal da cidade',
      'https://example.com/fortaleza.m3u8',
      '#EXTINF:-1 group-title="Canais Locais" tvg-city="Recife",Canal do Recife',
      'https://example.com/recife.m3u8',
      '#EXTINF:-1 group-title="Canais Locais",Canal sem cidade',
      'https://example.com/desconhecido.m3u8',
    ].join("\n"));
    expect(filterLocalChannelsForFortaleza(streams).map((stream) => stream.title))
      .toEqual(["Canal nacional", "Canal da cidade"]);
  });
});
