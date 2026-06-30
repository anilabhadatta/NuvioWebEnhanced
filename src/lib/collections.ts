import { supabase } from "./supabase";
import { getActiveProfileId } from "./profiles";

/**
 * UI Collections — custom home layouts, mirrored from NuvioMobile
 * CollectionRepository / CollectionModels. A collection is a user-defined set of
 * folders, each backed by catalog/TMDB/Trakt sources. The JSON is authored in an
 * external editor (e.g. imkaptain.github.io/Kaptain-Collection) and imported here.
 *
 * Persistence is a per-profile JSONB blob in Supabase:
 *  - sync_pull_collections { p_profile_id } → [{ collections_json }]
 *  - sync_push_collections { p_profile_id, p_collections_json: <array> }
 * plus a local cache for instant load.
 */

export interface CollectionSource {
  provider?: string;          // "addon" | "tmdb" | "trakt"
  addonId?: string;
  type?: string;
  catalogId?: string;
  genre?: string;
  tmdbSourceType?: string;
  title?: string;
  tmdbId?: number;
  traktListId?: number;
  mediaType?: string;
  sortBy?: string;
  sortHow?: string;
}

export interface CollectionFolder {
  id: string;
  title: string;
  coverImageUrl?: string;
  coverEmoji?: string;
  tileShape?: string;         // poster | landscape | wide | square
  hideTitle?: boolean;
  sources?: CollectionSource[];
  catalogSources?: { addonId: string; type: string; catalogId: string; genre?: string }[];
  // Kaptain Collection extended fields
  heroBackdropUrl?: string;
  titleLogoUrl?: string;
  focusGifUrl?: string;
  focusGifEnabled?: boolean;
  heroVideoUrl?: string;
}

export interface Collection {
  id: string;
  title: string;
  backdropImageUrl?: string;
  pinToTop?: boolean;
  viewMode?: string;          // TABBED_GRID | ROWS | FOLLOW_LAYOUT
  showAllTab?: boolean;
  folders: CollectionFolder[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  collectionCount?: number;
  folderCount?: number;
}

const LOCAL_KEY = "nuvio_collections";

export function loadLocalCollections(): Collection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Collection[]) : [];
  } catch {
    return [];
  }
}

function saveLocalCollections(collections: Collection[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(collections));
  } catch { /* ignore */ }
}

/** Validate a collections JSON string (top-level array of Collection). */
export function validateCollectionsJson(jsonString: string): ValidationResult {
  if (!jsonString.trim()) return { valid: false, error: "JSON is empty." };
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e: any) {
    return { valid: false, error: `Invalid JSON: ${e?.message || "parse error"}` };
  }
  if (!Array.isArray(parsed)) {
    return { valid: false, error: "Top-level JSON must be an array of collections." };
  }
  let folderCount = 0;
  for (let ci = 0; ci < parsed.length; ci++) {
    const c = parsed[ci] as Collection;
    if (!c.id?.trim()) return { valid: false, error: `Collection #${ci + 1} is missing an id.` };
    if (!c.title?.trim()) return { valid: false, error: `Collection "${c.id}" is missing a title.` };
    const folders = c.folders || [];
    for (let fi = 0; fi < folders.length; fi++) {
      const f = folders[fi];
      if (!f.id?.trim()) return { valid: false, error: `Folder #${fi + 1} in "${c.title}" is missing an id.` };
      if (!f.title?.trim()) return { valid: false, error: `Folder "${f.id}" in "${c.title}" is missing a title.` };
      folderCount++;
    }
  }
  return { valid: true, collectionCount: parsed.length, folderCount };
}

export function importCollectionsJson(jsonString: string): { ok: boolean; collections?: Collection[]; error?: string } {
  const validation = validateCollectionsJson(jsonString);
  if (!validation.valid) return { ok: false, error: validation.error };
  const collections = JSON.parse(jsonString) as Collection[];
  saveLocalCollections(collections);
  return { ok: true, collections };
}

export function exportCollectionsJson(collections: Collection[]): string {
  return JSON.stringify(collections, null, 2);
}

export async function pullCollections(): Promise<Collection[]> {
  const profileId = getActiveProfileId();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return loadLocalCollections();
    const { data, error } = await supabase.rpc("sync_pull_collections", { p_profile_id: profileId });
    if (error || !data) return loadLocalCollections();
    const blob = Array.isArray(data) ? data[0] : data;
    const json = blob?.collections_json;
    const collections: Collection[] = Array.isArray(json) ? json : [];
    saveLocalCollections(collections);
    return collections;
  } catch (e) {
    console.error("pullCollections failed", e);
    return loadLocalCollections();
  }
}

export async function pushCollections(collections: Collection[]): Promise<boolean> {
  saveLocalCollections(collections);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const profileId = getActiveProfileId();
    const { error } = await supabase.rpc("sync_push_collections", {
      p_profile_id: profileId,
      p_collections_json: collections,
    });
    if (error) {
      console.error("sync_push_collections failed", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("pushCollections failed", e);
    return false;
  }
}
