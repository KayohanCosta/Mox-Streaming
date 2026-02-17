import { useState, useCallback, useEffect } from "react";

export interface WatchProgressItem {
  id: number;
  type: "movie" | "tv";
  title: string;
  poster_path: string | null;
  progress: number; // 0-100
  season?: number;
  episode?: number;
  updatedAt: number; // timestamp
}

const STORAGE_KEY = "watch_progress";

function getAll(): WatchProgressItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as WatchProgressItem[];
  } catch {
    return [];
  }
}

function saveAll(items: WatchProgressItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function getWatchProgressList(): WatchProgressItem[] {
  return getAll()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 20);
}

export function saveWatchProgress(item: Omit<WatchProgressItem, "updatedAt">) {
  const all = getAll();
  const idx = all.findIndex(
    (i) => i.id === item.id && i.type === item.type
  );
  const entry: WatchProgressItem = { ...item, updatedAt: Date.now() };
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.unshift(entry);
  }
  // Keep max 50
  saveAll(all.slice(0, 50));
}

export function useWatchProgress() {
  const [items, setItems] = useState<WatchProgressItem[]>([]);

  const refresh = useCallback(() => {
    setItems(getWatchProgressList());
  }, []);

  useEffect(() => {
    refresh();
    // Listen for storage changes from other tabs
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) refresh();
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refresh]);

  return { items, refresh };
}
