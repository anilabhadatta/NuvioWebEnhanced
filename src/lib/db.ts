"use client";

import Dexie, { Table } from "dexie";
import { LibraryItem } from "./library";

export interface DexieLibraryItem {
  id: string; // content_id or TMDB id
  profileId: number;
  contentType: string; // movie, series, anime
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string;
  releaseDate?: string;
  rating?: number;
  genres?: string[];
  addedAt: number;
  syncedWithCloud?: boolean;
}

export interface DexieWatchRecord {
  progressKey: string;
  profileId: number;
  contentId: string;
  contentType: string;
  title: string;
  season?: number | null;
  episode?: number | null;
  currentTime: number;
  duration: number;
  lastWatched: number;
}

export interface DexieSetting {
  key: string;
  value: any;
  updatedAt: number;
}

/**
 * NuvioDatabase — Client-side offline IndexedDB storage powered by Dexie.js.
 * Stores local library snapshots, watch progress, and custom web preferences.
 */
class NuvioDatabase extends Dexie {
  library!: Table<DexieLibraryItem, string>;
  watchHistory!: Table<DexieWatchRecord, string>;
  settings!: Table<DexieSetting, string>;

  constructor() {
    super("NuvioWebDB");
    this.version(1).stores({
      library: "&id, profileId, contentType, title, addedAt",
      watchHistory: "&progressKey, profileId, contentId, contentType, lastWatched",
      settings: "&key, updatedAt",
    });
  }
}

export const db = typeof window !== "undefined" ? new NuvioDatabase() : (null as any);

/**
 * Persists a list of LibraryItems to IndexedDB for the given profile.
 */
export async function saveLibraryToIndexedDB(
  items: LibraryItem[],
  profileId: number
): Promise<void> {
  if (!db) return;
  try {
    const records: DexieLibraryItem[] = items.map((i) => ({
      id: String(i.id),
      profileId,
      contentType: i.category,
      title: i.title,
      posterPath: i.posterPath,
      backdropPath: i.backdropPath,
      overview: i.overview,
      releaseDate: i.releaseDate,
      rating: i.rating,
      genres: i.genres,
      addedAt: i.addedAt,
      syncedWithCloud: true,
    }));

    await db.transaction("rw", db.library, async () => {
      // Clear old records for this profile and bulk put the updated ones
      await db.library.where("profileId").equals(profileId).delete();
      await db.library.bulkPut(records);
    });
  } catch (err) {
    console.warn("Failed to persist library to IndexedDB:", err);
  }
}

/**
 * Retrieves all saved library items for a profile from IndexedDB.
 */
export async function getLibraryFromIndexedDB(profileId: number): Promise<LibraryItem[]> {
  if (!db) return [];
  try {
    const records = await db.library.where("profileId").equals(profileId).toArray();
    return records.map((r: DexieLibraryItem) => ({
      id: r.id,
      title: r.title,
      type: r.contentType === "series" ? "series" : "movie",
      category: (r.contentType as any) || "movie",
      posterPath: r.posterPath || null,
      backdropPath: r.backdropPath || null,
      overview: r.overview || "",
      releaseDate: r.releaseDate || "",
      rating: r.rating,
      genres: r.genres || [],
      addedAt: r.addedAt || Date.now(),
    }));
  } catch (err) {
    console.warn("Failed to read library from IndexedDB:", err);
    return [];
  }
}

/**
 * Saves a single setting into IndexedDB.
 */
export async function setIndexedDBSetting(key: string, value: any): Promise<void> {
  if (!db) return;
  try {
    await db.settings.put({
      key,
      value,
      updatedAt: Date.now(),
    });
  } catch (err) {
    console.warn(`Failed to set IndexedDB setting [${key}]:`, err);
  }
}

/**
 * Retrieves a single setting from IndexedDB.
 */
export async function getIndexedDBSetting<T = any>(key: string, fallback?: T): Promise<T | undefined> {
  if (!db) return fallback;
  try {
    const record = await db.settings.get(key);
    return record ? (record.value as T) : fallback;
  } catch (err) {
    console.warn(`Failed to get IndexedDB setting [${key}]:`, err);
    return fallback;
  }
}

/**
 * Gathers aggregate counts across all local tables and localStorage.
 */
export async function getDatabaseStats(): Promise<{
  libraryCount: number;
  historyCount: number;
  addonsCount: number;
  pluginsCount: number;
  storageType: string;
}> {
  let libraryCount = 0;
  let historyCount = 0;
  let addonsCount = 0;
  let pluginsCount = 0;

  if (db) {
    try {
      libraryCount = await db.library.count();
      historyCount = await db.watchHistory.count();
    } catch {}
  }

  if (typeof window !== "undefined") {
    // Check localStorage addons
    try {
      const addons = localStorage.getItem("nuvio_addons");
      if (addons) {
        const arr = JSON.parse(addons);
        if (Array.isArray(arr)) addonsCount = arr.length;
      }
    } catch {}

    // Check localStorage plugins
    try {
      const plugins = localStorage.getItem("nuvio_plugin_repos");
      if (plugins) {
        const arr = JSON.parse(plugins);
        if (Array.isArray(arr)) pluginsCount = arr.length;
      }
    } catch {}

    // If IndexedDB counts are 0, check localStorage fallback
    if (libraryCount === 0) {
      for (let i = 1; i <= 6; i++) {
        const raw = localStorage.getItem(`nuvio_saved_library_${i}`);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) libraryCount += parsed.length;
          } catch {}
        }
      }
    }

    if (historyCount === 0) {
      for (let i = 1; i <= 6; i++) {
        const raw = localStorage.getItem(`nuvio_watch_progress_${i}`);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) historyCount += parsed.length;
          } catch {}
        }
      }
    }
  }

  return {
    libraryCount,
    historyCount,
    addonsCount,
    pluginsCount,
    storageType: "IndexedDB (Dexie.js)",
  };
}

/**
 * Creates and downloads a complete JSON backup of all local Nuvio data.
 */
export async function exportLocalBackup(): Promise<string> {
  const stats = await getDatabaseStats();
  const backup: Record<string, any> = {
    app: "Nuvio Web Enhanced",
    version: "1.0.0",
    exportedAt: new Date().toISOString(),
    stats,
    library: {},
    watchHistory: {},
    addons: [],
    plugins: [],
    playbackSettings: {},
    elementJsSource: localStorage.getItem("nuvio.element_js_source_v3.5") || "cdn",
    defaultExternalPlayer: localStorage.getItem("nuvio.default_external_player") || "system",
    alwaysExternalPlayer: localStorage.getItem("nuvio.always_external_player") === "true",
  };

  // Export all profiles library and watch history
  for (let i = 1; i <= 6; i++) {
    try {
      const lib = localStorage.getItem(`nuvio_saved_library_${i}`);
      if (lib) backup.library[`profile_${i}`] = JSON.parse(lib);
    } catch {}

    try {
      const prog = localStorage.getItem(`nuvio_watch_progress_${i}`);
      if (prog) backup.watchHistory[`profile_${i}`] = JSON.parse(prog);
    } catch {}

    try {
      const sett = localStorage.getItem(`nuvio_playback_settings_${i}`);
      if (sett) backup.playbackSettings[`profile_${i}`] = JSON.parse(sett);
    } catch {}
  }

  try {
    const addons = localStorage.getItem("nuvio_addons");
    if (addons) backup.addons = JSON.parse(addons);
  } catch {}

  try {
    const plugins = localStorage.getItem("nuvio_plugin_repos");
    if (plugins) backup.plugins = JSON.parse(plugins);
  } catch {}

  return JSON.stringify(backup, null, 2);
}

/**
 * Restores local records from a parsed JSON backup.
 */
export async function restoreLocalBackup(jsonStr: string): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonStr);
    if (!parsed || parsed.app !== "Nuvio Web Enhanced") {
      throw new Error("Invalid backup file: Not a recognized Nuvio Web backup snapshot.");
    }

    // Restore library items
    if (parsed.library && typeof parsed.library === "object") {
      for (const [key, items] of Object.entries(parsed.library)) {
        const match = key.match(/profile_(\d+)/);
        const pId = match ? parseInt(match[1], 10) : 1;
        if (Array.isArray(items)) {
          localStorage.setItem(`nuvio_saved_library_${pId}`, JSON.stringify(items));
          await saveLibraryToIndexedDB(items as LibraryItem[], pId);
        }
      }
    }

    // Restore watch progress
    if (parsed.watchHistory && typeof parsed.watchHistory === "object") {
      for (const [key, items] of Object.entries(parsed.watchHistory)) {
        const match = key.match(/profile_(\d+)/);
        const pId = match ? parseInt(match[1], 10) : 1;
        if (Array.isArray(items)) {
          localStorage.setItem(`nuvio_watch_progress_${pId}`, JSON.stringify(items));
        }
      }
    }

    // Restore addons
    if (Array.isArray(parsed.addons)) {
      localStorage.setItem("nuvio_addons", JSON.stringify(parsed.addons));
    }

    // Restore plugins
    if (Array.isArray(parsed.plugins)) {
      localStorage.setItem("nuvio_plugin_repos", JSON.stringify(parsed.plugins));
    }

    // Restore settings
    if (parsed.defaultExternalPlayer) {
      localStorage.setItem("nuvio.default_external_player", parsed.defaultExternalPlayer);
    }
    if (parsed.alwaysExternalPlayer !== undefined) {
      localStorage.setItem("nuvio.always_external_player", String(parsed.alwaysExternalPlayer));
    }
    if (parsed.elementJsSource) {
      localStorage.setItem("nuvio.element_js_source_v3.5", parsed.elementJsSource);
    }

    window.dispatchEvent(new CustomEvent("nuvio:library-updated"));
    window.dispatchEvent(new CustomEvent("nuvio:profile-changed"));

    return { success: true, message: "Backup successfully restored and merged." };
  } catch (err: any) {
    return { success: false, message: err?.message || "Failed to parse backup JSON." };
  }
}

/**
 * Clears local IndexedDB database and resets web-specific settings to defaults.
 * Account-based cloud profiles and Supabase records remain safe in the cloud and re-sync upon sign-in.
 */
export async function resetWebSettingsAndLocalDB(): Promise<void> {
  if (db) {
    try {
      await db.library.clear();
      await db.watchHistory.clear();
      await db.settings.clear();
    } catch (err) {
      console.warn("Failed to clear Dexie tables:", err);
    }
  }

  if (typeof window !== "undefined") {
    // Clear local web preferences (revert to defaults)
    localStorage.removeItem("nuvio.default_external_player");
    localStorage.removeItem("nuvio.always_external_player");
    localStorage.removeItem("nuvio.element_js_source_v3.5");

    // Clear local caches
    for (let i = 1; i <= 6; i++) {
      localStorage.removeItem(`nuvio_playback_settings_${i}`);
      localStorage.removeItem(`nuvio_watch_progress_${i}`);
      localStorage.removeItem(`nuvio_cloud_progress_${i}`);
    }

    // Re-initialize default external player as "system"
    localStorage.setItem("nuvio.default_external_player", "system");
    localStorage.setItem("nuvio.always_external_player", "false");

    window.dispatchEvent(new CustomEvent("nuvio:library-updated"));
    window.dispatchEvent(new CustomEvent("nuvio:profile-changed"));
  }
}
