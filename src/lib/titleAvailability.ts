import { useEffect, useState } from "react";
import audit from "@/data/availability.json";

export type TitleAvailability = "available" | "upcoming" | "checking";
type ResolvedAvailability = Exclude<TitleAvailability, "checking">;
type Entry = { status: ResolvedAvailability; expires: number };

const API = import.meta.env.VITE_PLAYBACK_API_URL?.replace(/\/$/, "");
const entries = new Map<string, Entry>();
const listeners = new Map<string, Set<(status: TitleAvailability) => void>>();
const waiting: string[] = [];
const queued = new Set<string>();
let active = 0;

if (API) {
  const checkedAt = Date.parse(audit.checked_at);
  const expires = checkedAt + 30 * 60_000;
  if (expires > Date.now()) {
    for (const [key, status] of Object.entries(audit.statuses)) {
      if (status === "available" || status === "upcoming") entries.set(key, { status, expires });
    }
  }
}

function keyFor(type: string | undefined, id: number | undefined) {
  return type && Number.isSafeInteger(id) && id! > 0 ? `${type === "movie" ? "movie" : "tv"}:${id}` : "";
}

function read(key: string): TitleAvailability {
  if (!API) return "available";
  const entry = entries.get(key);
  return entry && entry.expires > Date.now() ? entry.status : "checking";
}

function publish(key: string, status: TitleAvailability) {
  for (const listener of listeners.get(key) || []) listener(status);
}

function pump() {
  if (!API) return;
  while (active < 3 && waiting.length) {
    const key = waiting.shift()!;
    active++;
    const [type, id] = key.split(":");
    void fetch(`${API}/v1/availability/${type}/${id}`, { cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.tmdb_id !== Number(id) || data.type !== type || !["available", "upcoming"].includes(data.status)) throw new Error("Resposta inválida");
        const status = data.status as ResolvedAvailability;
        entries.set(key, { status, expires: Date.now() + (status === "available" ? 15 : 5) * 60_000 });
        publish(key, status);
      })
      .catch(() => {
        entries.set(key, { status: "upcoming", expires: Date.now() + 30_000 });
        publish(key, "upcoming");
      })
      .finally(() => { active--; queued.delete(key); pump(); });
  }
}

function ensure(key: string, force = false) {
  if (!API || !key || queued.has(key) || (!force && read(key) !== "checking")) return;
  if (force) entries.delete(key);
  queued.add(key);
  waiting.push(key);
  publish(key, "checking");
  pump();
}

export function refreshTitleAvailability(type: string, id: number) {
  ensure(keyFor(type, id), true);
}

export function useTitleAvailability(type: string | undefined, id: number | undefined, enabled = true): TitleAvailability {
  const key = keyFor(type, id);
  const [status, setStatus] = useState<TitleAvailability>(() => read(key));
  useEffect(() => {
    setStatus(read(key));
    if (!key) return;
    let group = listeners.get(key);
    if (!group) { group = new Set(); listeners.set(key, group); }
    group.add(setStatus);
    if (enabled) ensure(key);
    return () => { group!.delete(setStatus); if (!group!.size) listeners.delete(key); };
  }, [key, enabled]);
  return status;
}
