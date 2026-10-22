import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Link2, Play, Search, Settings2, Tv, Upload } from "lucide-react";
import IPTVPlayer from "@/components/IPTVPlayer";
import SiteFooter from "@/components/SiteFooter";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchIPTVList,
  getIPTVPlaylistConfig,
  IPTVPlaylistConfig,
  IPTVStream,
  saveIPTVPlaylist,
} from "@/lib/iptv";

export default function TVPage() {
  const [streams, setStreams] = useState<IPTVStream[]>([]);
  const [selectedStream, setSelectedStream] = useState<IPTVStream | null>(null);
  const [playlistConfig, setPlaylistConfig] = useState<IPTVPlaylistConfig | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [playlistText, setPlaylistText] = useState("");
  const [fileName, setFileName] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showSetup, setShowSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPlaylist() {
      try {
        const config = getIPTVPlaylistConfig();
        if (!active) return;
        if (!config) {
          setShowSetup(true);
          return;
        }

        setPlaylistConfig(config);
        if (config.source === "url") setPlaylistUrl(config.value);
        const list = await fetchIPTVList();
        if (!active) return;
        setStreams(list);
        setSelectedStream(list[0] ?? null);
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar a lista IPTV.");
          setShowSetup(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPlaylist();
    return () => {
      active = false;
    };
  }, []);

  const categories = useMemo(
    () => [...new Set(streams.map((stream) => stream.category).filter((value): value is string => Boolean(value)))],
    [streams],
  );
  const filteredStreams = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return streams.filter((stream) => {
      const matchesCategory = category === "all" || stream.category === category;
      const matchesSearch = !normalizedSearch
        || stream.title.toLowerCase().includes(normalizedSearch)
        || stream.category?.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [category, search, streams]);
  const selectedIndex = selectedStream ? streams.indexOf(selectedStream) : -1;
  const channelNumber = selectedIndex >= 0 ? selectedIndex + 1 : undefined;

  const changeChannel = useCallback((direction: -1 | 1) => {
    if (streams.length === 0) return;
    setSelectedStream((current) => {
      const currentIndex = current ? streams.indexOf(current) : -1;
      const nextIndex = currentIndex < 0
        ? (direction === 1 ? 0 : streams.length - 1)
        : (currentIndex + direction + streams.length) % streams.length;
      return streams[nextIndex];
    });
  }, [streams]);

  useEffect(() => {
    if (!selectedStream || showSetup) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable=true]")) return;
      if (event.key === "ArrowUp") {
        event.preventDefault();
        changeChannel(-1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        changeChannel(1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [changeChannel, selectedStream, showSetup]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const config: IPTVPlaylistConfig | null = playlistUrl.trim()
      ? { source: "url", value: playlistUrl.trim() }
      : playlistText.trim()
        ? { source: "content", value: playlistText.trim() }
        : null;

    if (!config) {
      setError("Cole o conteúdo M3U, selecione um arquivo ou informe o endereço da sua lista.");
      return;
    }

    setSaving(true);
    try {
      const list = await saveIPTVPlaylist(config);
      setPlaylistConfig(config);
      setStreams(list);
      setSelectedStream(list[0] ?? null);
      setShowSetup(false);
      setPlaylistText("");
      setFileName("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a lista IPTV.");
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      setPlaylistText(await file.text());
      setPlaylistUrl("");
      setFileName(file.name);
    } catch {
      setError("Não foi possível ler esse arquivo. Tente selecionar outro arquivo M3U.");
    }
  };

  const getStreamUrl = useCallback(async (source: string) => source, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main className="browse-page">
        {showSetup ? (
          <section className="mx-auto max-w-2xl">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Tv className="h-7 w-7" />
              </div>
              <h1 className="browse-title">Configure sua TV</h1>
              <p className="mt-2 text-muted-foreground">
                {playlistConfig
                  ? "Atualize sua lista IPTV para continuar assistindo."
                  : "Para começar, adicione uma lista IPTV em formato M3U."}
              </p>
            </div>

            <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-border bg-card p-5 md:p-8">
              <div className="space-y-2">
                <label htmlFor="iptv-url" className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-4 w-4 text-primary" />
                  Endereço da lista
                </label>
                <Input
                  id="iptv-url"
                  type="url"
                  value={playlistUrl}
                  onChange={(event) => {
                    setPlaylistUrl(event.target.value);
                    if (event.target.value) {
                      setPlaylistText("");
                      setFileName("");
                    }
                  }}
                  placeholder="https://exemplo.com/lista.m3u"
                  autoComplete="url"
                />
                <p className="text-xs text-muted-foreground">
                  O servidor da lista precisa permitir acesso pelo navegador (CORS).
                </p>
              </div>

              <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou cole o conteúdo M3U
                <span className="h-px flex-1 bg-border" />
              </div>

              <div className="space-y-2">
                <label htmlFor="iptv-content" className="text-sm font-medium">Conteúdo da lista</label>
                <Textarea
                  id="iptv-content"
                  value={playlistText}
                  onChange={(event) => {
                    setPlaylistText(event.target.value);
                    setPlaylistUrl("");
                    setFileName("");
                  }}
                  placeholder={"#EXTM3U\n#EXTINF:-1,Canal exemplo\nhttps://exemplo.com/canal.m3u8"}
                  className="min-h-40 font-mono text-xs"
                />
              </div>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
                <Upload className="h-4 w-4" />
                {fileName || "Selecionar arquivo M3U"}
                <input
                  type="file"
                  accept=".m3u,.m3u8,.txt,audio/x-mpegurl,application/vnd.apple.mpegurl"
                  className="sr-only"
                  onChange={handleFileChange}
                />
              </label>

              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? "Validando lista..." : "Salvar lista"}
                </Button>
                {playlistConfig && (
                  <Button type="button" variant="outline" onClick={() => setShowSetup(false)}>
                    Cancelar
                  </Button>
                )}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                A lista é salva somente neste navegador.
              </p>
            </form>
          </section>
        ) : (
          <>
            <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="mb-1 flex items-center gap-2 text-sm font-medium text-primary">
                  <Tv className="h-4 w-4" /> IPTV
                </p>
                <h1 className="browse-title">TV ao vivo</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {loading ? "Carregando lista..." : `${streams.length} canais e conteúdos disponíveis`}
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowSetup(true)}>
                <Settings2 className="h-4 w-4" />
                Trocar lista
              </Button>
            </div>

            {error && (
              <p role="alert" className="mb-5 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            )}

            {!loading && streams.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                Sua lista não possui canais ou conteúdos M3U.
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
                <section className="min-w-0">
                  <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-2xl">
                    <div className="aspect-video">
                      {selectedStream ? (
                        <IPTVPlayer
                          contentTitle={selectedStream.title}
                          source={selectedStream.url}
                          getStreamUrl={getStreamUrl}
                          liveMode
                          channelNumber={channelNumber}
                        />
                      ) : (
                        <div className="flex h-full flex-col items-center justify-center gap-3 text-white/60">
                          <Tv className="h-12 w-12 text-primary" />
                          <p>Escolha um canal para começar</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        {selectedStream ? "Sintonizado" : "Aguardando canal"}
                      </p>
                      <p className="mt-1 truncate font-semibold">
                        {selectedStream
                          ? `${String(channelNumber).padStart(2, "0")} · ${selectedStream.title}`
                          : "Nenhum canal selecionado"}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {selectedStream?.category || "Programação fornecida pela sua lista IPTV"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Canal anterior"
                        title="Canal anterior (↑)"
                        disabled={streams.length < 2}
                        onClick={() => changeChannel(-1)}
                      >
                        <ChevronUp className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Próximo canal"
                        title="Próximo canal (↓)"
                        disabled={streams.length < 2}
                        onClick={() => changeChannel(1)}
                      >
                        <ChevronDown className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </section>

                <aside className="flex min-h-[440px] flex-col overflow-hidden rounded-2xl border border-border bg-card">
                  <div className="space-y-3 border-b border-border p-4">
                    <div>
                      <h2 className="font-semibold">Guia de canais</h2>
                      <p className="text-xs text-muted-foreground">{filteredStreams.length} canais na seleção</p>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar canal..."
                        className="pl-9"
                        aria-label="Buscar canal"
                      />
                    </div>
                    <select
                      value={category}
                      onChange={(event) => setCategory(event.target.value)}
                      aria-label="Filtrar por categoria"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="all">Todas as categorias</option>
                      {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </div>

                  <div className="flex-1 overflow-y-auto p-2">
                    {loading ? (
                      <div className="space-y-2 p-2" aria-label="Carregando canais">
                        {Array.from({ length: 6 }, (_, index) => (
                          <div key={index} className="h-[68px] animate-pulse rounded-lg bg-secondary/80" />
                        ))}
                      </div>
                    ) : filteredStreams.length ? (
                      filteredStreams.map((stream) => {
                        const index = streams.indexOf(stream);
                        const isSelected = selectedIndex === index;
                        return (
                          <button
                            key={`${stream.url}-${index}`}
                            onClick={() => setSelectedStream(stream)}
                            aria-current={isSelected ? "true" : undefined}
                            className={`mb-1 flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors ${
                              isSelected
                                ? "bg-primary/15 text-foreground ring-1 ring-inset ring-primary/50"
                                : "text-foreground/80 hover:bg-secondary"
                            }`}
                          >
                            <span className={`w-8 shrink-0 text-center font-mono text-xs ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-secondary">
                              <Play className={`h-4 w-4 ${isSelected ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{stream.title}</span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {stream.category || "Sem categoria"}
                              </span>
                            </span>
                            {isSelected && (
                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-red-400">Ao vivo</span>
                            )}
                          </button>
                        );
                      })
                    ) : (
                      <p className="p-5 text-center text-sm text-muted-foreground">
                        Nenhum canal encontrado para essa busca.
                      </p>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
