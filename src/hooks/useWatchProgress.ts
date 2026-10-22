import { profileStorageKey } from "@/lib/profiles";
import { useState, useCallback, useEffect } from "react";
import type { MovieLanguage } from "@/lib/redecanais";

export interface WatchProgressItem {
  id: number;
  type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  backdrop_path?: string | null;
  progress: number;
  season?: number;
  episode?: number;
  episode_title?: string;
  currentTime?: number; // seconds
  duration?: number; // seconds
  language?: MovieLanguage;
  completed?: boolean;
  updatedAt: number;
}
const STORAGE_KEY = "watch_progress";
const HISTORY_KEY = "watch_episode_progress";
const UPDATED_EVENT = "watch-progress-updated";
function read(key: string): WatchProgressItem[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(profileStorageKey(key)) || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is WatchProgressItem => !!x && Number.isSafeInteger(x.id) && ["movie", "tv"].includes(x.type));
  } catch { return []; }
}
function write(key: string, items: WatchProgressItem[]) {
  try { localStorage.setItem(profileStorageKey(key), JSON.stringify(items)); } catch { /* Playback continues if storage is unavailable. */ }
}
export function getWatchProgressList(): WatchProgressItem[] {
  return read(STORAGE_KEY).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20);
}
export function getWatchProgress(id: number, type: "movie" | "tv", season?: number, episode?: number) {
  if (type === "tv" && season !== undefined && episode !== undefined) {
    const history = read(HISTORY_KEY).find(x => x.id === id && x.type === type && x.season === season && x.episode === episode);
    if (history) return history;
  }
  return read(STORAGE_KEY).find(x => x.id === id && x.type === type &&
    (season === undefined || x.season === season) && (episode === undefined || x.episode === episode));
}
export function removeWatchProgress(id: number, type: "movie" | "tv") {
  for (const key of [STORAGE_KEY, HISTORY_KEY]) write(key, read(key).filter(x => x.id !== id || x.type !== type));
  window.dispatchEvent(new Event(UPDATED_EVENT));
}
export function saveWatchProgress(item: Omit<WatchProgressItem, "updatedAt">) {
  const entry: WatchProgressItem = { ...item, updatedAt: Date.now() };
  if (entry.currentTime !== undefined) entry.currentTime = Number.isFinite(entry.currentTime) ? Math.max(0, entry.currentTime) : 0;
  if (entry.duration !== undefined) entry.duration = Number.isFinite(entry.duration) ? Math.max(0, entry.duration) : 0;
  if (entry.completed) entry.progress = 100;
  else if (entry.duration && entry.currentTime !== undefined) entry.progress = Math.min(99.9, entry.currentTime / entry.duration * 100);
  else entry.progress = Math.max(0, Math.min(100, entry.progress || 0));
  write(STORAGE_KEY, [entry, ...read(STORAGE_KEY).filter(x => x.id !== item.id || x.type !== item.type)].slice(0, 50));
  if (entry.type === "tv" && entry.season !== undefined && entry.episode !== undefined) {
    write(HISTORY_KEY, [entry, ...read(HISTORY_KEY).filter(x => x.id !== item.id || x.type !== item.type || x.season !== item.season || x.episode !== item.episode)].slice(0, 300));
  }
  window.dispatchEvent(new Event(UPDATED_EVENT));
}
export function useWatchProgress() {
  const [items, setItems] = useState<WatchProgressItem[]>([]);
  const refresh = useCallback(() => setItems(getWatchProgressList()), []);
  useEffect(() => {
    refresh();
    const handler = (event: StorageEvent) => { if (event.key === profileStorageKey(STORAGE_KEY) || event.key === null) refresh(); };
    window.addEventListener("storage", handler);
    window.addEventListener(UPDATED_EVENT, refresh);
    return () => { window.removeEventListener("storage", handler); window.removeEventListener(UPDATED_EVENT, refresh); };
  }, [refresh]);
  return { items, refresh };
}
