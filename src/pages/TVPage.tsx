import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ChevronDown, ChevronUp, Search, Tv } from "lucide-react";
import Navbar from "@/components/Navbar";
import SiteFooter from "@/components/SiteFooter";
import IPTVPlayer from "@/components/IPTVPlayer";
import HorizontalShelf from "@/components/HorizontalShelf";

type Quality = "low" | "720" | "1080";
interface Channel {
  id: string;
  title: string;
  category: string;
  logo: string;
  qualities: Partial<Record<Quality, {label: string; playback_url: string | null}>>;
  playback_validated: boolean;
}
interface ChannelCatalog {channels: Channel[]; categories: string[]; total: number}
const qualityOrder: Quality[] = ["low", "720", "1080"];
function availableQualities(channel: Channel | null): Quality[] {
  if (!channel) return [];
  const present = qualityOrder.filter((key) => channel.qualities[key]);
  return present.includes("720") && present.includes("1080")
    ? ["720", "1080"]
    : present.length > 2 ? [present[0], present[present.length - 1]] : present;
}
const categoryLabel = (category: string) => category === "Infantil" ? "Desenhos" : category;
const directStreamUrl = async (source: string) => source;
const EMPTY_CHANNELS: Channel[] = [];

export default function TVPage() {
  const [catalog, setCatalog] = useState<ChannelCatalog | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quality, setQuality] = useState<Quality>("720");
  const [query, setQuery] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/addon-local/catalog/channels", {signal: controller.signal})
      .then((response) => {if (!response.ok) throw new Error("Catálogo indisponível"); return response.json();})
      .then((result: ChannelCatalog) => {setCatalog(result); setSelectedId(result.channels[0]?.id ?? null);})
      .catch(() => {if (!controller.signal.aborted) setError(true);});
    return () => controller.abort();
  }, []);

  const channels = catalog?.channels ?? EMPTY_CHANNELS;
  const selected = channels.find((channel) => channel.id === selectedId) ?? null;
  const selectedIndex = selected ? channels.indexOf(selected) : -1;
  const choices = availableQualities(selected);
  const activeQuality = choices.includes(quality) ? quality : (choices.includes("720") ? "720" : choices.at(-1) ?? "low");
  const selectedSource = selected?.qualities[activeQuality]?.playback_url;
  const visible = useMemo(() => channels.filter((channel) =>
    channel.title.toLocaleLowerCase("pt-BR").includes(query.trim().toLocaleLowerCase("pt-BR"))),
    [channels, query]);

  const selectChannel = (channel: Channel) => {
    setSelectedId(channel.id);
    setQuality(channel.qualities["720"] ? "720" : channel.qualities["1080"] ? "1080" : "low");
  };
  const changeChannel = (direction: -1 | 1) => {
    if (!channels.length) return;
    selectChannel(channels[(selectedIndex + direction + channels.length) % channels.length]);
  };

  return <div className="min-h-screen bg-background text-foreground">
    <Navbar />
    <main className="browse-page">
      <header className="mb-6"><span className="eyebrow">MOX · TV</span><h1 className="browse-title">TV ao vivo</h1><p className="mt-2 text-sm text-muted-foreground">{catalog ? `${catalog.total} canais no catálogo` : "Carregando canais…"}</p></header>
      {error && <p role="alert" className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-5">Não foi possível carregar o catálogo de canais agora.</p>}
      {!error && <>
        <section className="tv-stage" aria-label="Canal selecionado">
          <div className="tv-video relative">
            {selectedSource ? <IPTVPlayer key={`${selected?.id}:${activeQuality}`} contentTitle={selected?.title ?? "Canal"} source={selectedSource} getStreamUrl={directStreamUrl} liveMode channelNumber={selectedIndex + 1} /> : <div className="flex h-full flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_center,#1a1025,#060509_72%)] px-5 text-center">
              <AlertCircle className="h-10 w-10 text-primary/80" />
              <p className="max-w-md text-lg font-semibold">Indisponível no momento. Aguarde novas atualizações do catálogo.</p>
              <p className="max-w-lg text-sm text-muted-foreground">A transmissão deste canal ainda não foi confirmada para reprodução no navegador.</p>
            </div>}
          </div>
          <div className="tv-stage-info">
            <div className="min-w-0"><p className="tv-live-label"><span /> CANAL {String(selectedIndex + 1).padStart(2,"0")}</p><h2>{selected?.title ?? "Selecione um canal"}</h2><p>{selected ? categoryLabel(selected.category) : "Catálogo do addon"}</p></div>
            <div className="flex shrink-0 gap-2"><button type="button" aria-label="Canal anterior" onClick={() => changeChannel(-1)} className="rounded-lg border border-white/15 p-2 disabled:opacity-30" disabled={channels.length < 2}><ChevronUp /></button><button type="button" aria-label="Próximo canal" onClick={() => changeChannel(1)} className="rounded-lg border border-white/15 p-2 disabled:opacity-30" disabled={channels.length < 2}><ChevronDown /></button></div>
          </div>
        </section>
        {selected && selectedSource && choices.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Qualidade do canal"><span className="mr-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Qualidade</span>{choices.map((choice) => <button type="button" key={choice} aria-pressed={activeQuality === choice} onClick={() => setQuality(choice)} className={`rounded-full border px-4 py-2 text-sm ${activeQuality === choice ? "border-primary bg-primary/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground"}`}>{selected.qualities[choice]?.label}</button>)}</div>}
        <section className="tv-channel-section" aria-label="Lista de canais">
          <div className="tv-channel-heading"><div><span className="eyebrow">EXPLORE OS CANAIS</span><h2>Canais em destaque</h2></div><div className="tv-channel-filters"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="Buscar canal" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar canal..." className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm" /></div></div></div>
          {catalog?.categories.map((group) => {
            const items = visible.filter((channel) => channel.category === group);
            return items.length ? <HorizontalShelf key={group} title={categoryLabel(group)} className="tv-category-shelf">
              {items.map((channel) => <button key={channel.id} type="button" onClick={() => selectChannel(channel)} aria-current={selectedId === channel.id ? "true" : undefined} className={`tv-channel-card ${selectedId === channel.id ? "is-active" : ""}`}><span className="tv-channel-number">{String(channels.indexOf(channel) + 1).padStart(2,"0")}</span><span className="tv-channel-logo">{channel.logo ? <img src={channel.logo} alt="" loading="lazy" /> : <Tv aria-hidden="true" />}</span><span className="tv-channel-name">{channel.title}</span><span className="tv-channel-category">{categoryLabel(channel.category)}</span></button>)}
            </HorizontalShelf> : null;
          })}
          {!visible.length && <p className="py-10 text-center text-muted-foreground">Nenhum canal encontrado.</p>}
        </section>
      </>}
    </main><SiteFooter />
  </div>;
}
