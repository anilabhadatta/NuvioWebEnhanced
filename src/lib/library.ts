import { supabase } from "./supabase";
import { getActiveProfileId } from "./profiles";
import { TMDBMovie } from "./tmdb";
import { handleInvalidTokenError } from "./useAuth";
import { saveLibraryToIndexedDB } from "./db";

export type LibraryCategory = "movie" | "series" | "anime";

export interface LibraryItem {
  id: string | number;
  supabaseId?: string;
  title: string;
  type: "movie" | "tv" | "series";
  category: LibraryCategory;
  posterPath?: string | null;
  backdropPath?: string | null;
  overview?: string;
  releaseDate?: string;
  rating?: number;
  voteCount?: number;
  genres?: string[];
  originalLanguage?: string;
  addedAt: number;
}

const STORAGE_KEY_PREFIX = "nuvio_saved_library_";

function getStorageKey(): string {
  if (typeof window === "undefined") return `${STORAGE_KEY_PREFIX}1`;
  const profileId = getActiveProfileId();
  return `${STORAGE_KEY_PREFIX}${profileId}`;
}

function getSyncClientId(): string {
  if (typeof window === "undefined") return "nuvio-web-client";
  let clientId = localStorage.getItem("nuvio_sync_client_id");
  if (!clientId) {
    clientId = "nuvio-web-" + Math.random().toString(36).substring(2, 10);
    try {
      localStorage.setItem("nuvio_sync_client_id", clientId);
    } catch {}
  }
  return clientId;
}

export function autoDetectCategory(
  movie: Partial<TMDBMovie> & { original_language?: string; media_type?: string }
): LibraryCategory {
  const isTv =
    movie.media_type === "tv" ||
    movie.media_type === "series" ||
    (!movie.title && !!movie.name);
  const lang = (movie.original_language || "").toLowerCase();
  const genres = movie.genre_ids || [];

  // TMDB Genre 16 = Animation
  const isAnimation = genres.includes(16);

  if (isAnimation && (lang === "ja" || lang === "japanese")) {
    return "anime";
  }

  // Also check if overview or title contains anime indicators
  const fullText = `${movie.title || ""} ${movie.name || ""} ${movie.overview || ""}`.toLowerCase();
  if (isAnimation && (fullText.includes("anime") || fullText.includes("manga"))) {
    return "anime";
  }

  if (isTv) return "series";
  return "movie";
}

/**
 * Synchronous local cache reader for instant UI rendering.
 */
export function getLibraryItems(): LibraryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return [];
    const items = JSON.parse(raw);
    return Array.isArray(items) ? items : [];
  } catch (e) {
    console.error("Failed to read library items", e);
    return [];
  }
}

/**
 * Persists library items to localStorage and broadcasts an update event.
 */
export function saveLibraryItems(items: LibraryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("nuvio:library-updated", { detail: items }));
  } catch (e) {
    console.error("Failed to save library items", e);
  }
}

/**
 * Pulls library items from Supabase (`sync_pull_library` or `library_items` table),
 * scoped to the active profile index, mirrored from NuvioMobile.
 */
export async function pullLibraryItems(forceRemote = false): Promise<LibraryItem[]> {
  const profileId = getActiveProfileId();
  const cached = getLibraryItems();

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Guest or not signed in: return cached items
      return cached;
    }

    let rows: any[] = [];

    // 1. Primary: Supabase RPC `sync_pull_library`
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("sync_pull_library", {
        p_profile_id: profileId,
        p_limit: 1000,
        p_offset: 0,
      });

      if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
        rows = rpcData;
      } else if (rpcError) {
        handleInvalidTokenError(rpcError);
        console.warn("sync_pull_library RPC returned error, querying library_items table", rpcError);
      }
    } catch (e) {
      console.warn("sync_pull_library exception", e);
    }

    // 2. Comprehensive Table Query: Fetch all rows for this user
    // Scoped by profile_id or null (legacy/global mobile items)
    if (rows.length === 0) {
      try {
        const { data: tableData, error: tableError } = await supabase
          .from("library_items")
          .select("*")
          .eq("user_id", session.user.id)
          .order("added_at", { ascending: false });

        if (!tableError && Array.isArray(tableData) && tableData.length > 0) {
          // Filter to this profile or shared profile items
          const profileRows = tableData.filter(
            (r: any) =>
              r.profile_id === profileId ||
              r.profile_id === null ||
              r.profile_id === undefined ||
              (profileId === 1 && (r.profile_id === 0 || !r.profile_id))
          );
          rows = profileRows.length > 0 ? profileRows : tableData;
        }
      } catch (e) {
        console.warn("Direct library_items select error", e);
      }
    }

    if (rows && Array.isArray(rows) && rows.length > 0) {
      const mapped: LibraryItem[] = rows.map((r: any) => {
        const rawType = (r.content_type || "").toLowerCase();
        let cat: LibraryCategory = "movie";
        if (rawType === "anime") cat = "anime";
        else if (rawType === "series" || rawType === "tv") cat = "series";
        else cat = "movie";

        // Normalize poster & backdrop URLs
        let poster = r.poster || r.poster_path || null;
        let backdrop = r.background || r.backdrop_path || null;

        return {
          id: r.content_id || r.id,
          supabaseId: r.id,
          title: r.name || r.title || "Untitled",
          type: cat === "series" ? "series" : "movie",
          category: cat,
          posterPath: poster,
          backdropPath: backdrop,
          overview: r.description || r.overview || "",
          releaseDate: r.release_info || r.release_date || "",
          rating: r.imdb_rating ? Number(r.imdb_rating) : (r.vote_average ? Number(r.vote_average) : undefined),
          genres: Array.isArray(r.genres) ? r.genres : [],
          addedAt: r.added_at ? Number(r.added_at) : (r.created_at ? new Date(r.created_at).getTime() : Date.now()),
        };
      });

      // Smart Union: Merge cloud items with local cached items by content_id
      const unionMap = new Map<string, LibraryItem>();
      for (const item of mapped) {
        unionMap.set(String(item.id), item);
      }
      for (const item of cached) {
        if (!unionMap.has(String(item.id))) {
          unionMap.set(String(item.id), item);
        }
      }

      const merged = Array.from(unionMap.values()).sort((a, b) => b.addedAt - a.addedAt);

      // Save to local cache & Dexie IndexedDB
      saveLibraryItems(merged);
      saveLibraryToIndexedDB(merged, profileId);
      return merged;
    }

    return cached;
  } catch (e) {
    console.error("pullLibraryItems failed", e);
    handleInvalidTokenError(e);
    return cached;
  }
}

export function isInLibrary(id: string | number): boolean {
  const items = getLibraryItems();
  return items.some((item) => String(item.id) === String(id));
}

export function getLibraryItem(id: string | number): LibraryItem | undefined {
  const items = getLibraryItems();
  return items.find((item) => String(item.id) === String(id));
}

function normalizeImageUrl(path?: string | null, size: "w500" | "original" = "w500"): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `https://image.tmdb.org/t/p/${size}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Adds an item to the library (both local cache and Supabase cloud).
 */
export async function addToLibrary(
  movie: TMDBMovie | Partial<LibraryItem>,
  preferredCategory?: LibraryCategory
): Promise<LibraryItem> {
  const items = getLibraryItems();
  const idStr = String(movie.id);
  const existingIdx = items.findIndex((i) => String(i.id) === idStr);

  const category =
    preferredCategory ||
    (movie as LibraryItem).category ||
    autoDetectCategory(movie as TMDBMovie);

  const isTv =
    (movie as any).media_type === "tv" ||
    (movie as any).media_type === "series" ||
    (movie as any).type === "series" ||
    (movie as any).type === "tv" ||
    (!(movie as any).title && !!(movie as any).name);

  const type: "movie" | "tv" | "series" = isTv ? "series" : "movie";
  const title = (movie as any).title || (movie as any).name || "Untitled";

  const poster = (movie as any).poster_path || (movie as any).posterPath || null;
  const backdrop = (movie as any).backdrop_path || (movie as any).backdropPath || null;

  const newItem: LibraryItem = {
    id: movie.id!,
    title,
    type,
    category,
    posterPath: poster,
    backdropPath: backdrop,
    overview: (movie as any).overview || "",
    releaseDate:
      (movie as any).release_date ||
      (movie as any).first_air_date ||
      (movie as any).releaseDate ||
      "",
    rating: (movie as any).vote_average || (movie as any).rating || 0,
    voteCount: (movie as any).vote_count || (movie as any).voteCount,
    originalLanguage:
      (movie as any).original_language || (movie as any).originalLanguage || "en",
    genres: (movie as any).genres || [],
    addedAt: Date.now(),
  };

  let updated: LibraryItem[];
  if (existingIdx >= 0) {
    updated = [...items];
    updated[existingIdx] = { ...items[existingIdx], ...newItem };
  } else {
    updated = [newItem, ...items];
  }

  // 1. Save locally for instant optimistic UI
  const profileId = getActiveProfileId();
  saveLibraryItems(updated);
  saveLibraryToIndexedDB(updated, profileId);

  // 2. Sync to Supabase in the background
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const payload = {
        content_id: idStr,
        content_type: category,
        name: title,
        poster: normalizeImageUrl(poster, "w500"),
        poster_shape: "POSTER",
        background: normalizeImageUrl(backdrop, "original"),
        description: newItem.overview || "",
        release_info: newItem.releaseDate || "",
        imdb_rating: newItem.rating ? Number(newItem.rating) : 0,
        genres: newItem.genres || [],
        added_at: newItem.addedAt,
        profile_id: profileId,
      };

      // 2a. Push via sync_push_library RPC
      try {
        await supabase.rpc("sync_push_library", {
          p_profile_id: profileId,
          p_origin_client_id: getSyncClientId(),
          p_items: [payload],
        });
      } catch (rpcErr) {
        console.warn("sync_push_library RPC notice:", rpcErr);
      }

      // 2b. Guaranteed direct upsert to library_items table (matches mobile table schema)
      await supabase.from("library_items").upsert({
        user_id: session.user.id,
        profile_id: profileId,
        content_id: idStr,
        content_type: category,
        name: title,
        poster: normalizeImageUrl(poster, "w500"),
        poster_shape: "POSTER",
        background: normalizeImageUrl(backdrop, "original"),
        description: newItem.overview || "",
        release_info: newItem.releaseDate || "",
        imdb_rating: newItem.rating ? Number(newItem.rating) : 0,
        genres: newItem.genres || [],
        added_at: newItem.addedAt,
      }, { onConflict: "user_id,profile_id,content_id" });

      // 2c. Broadcast sync invalidation so Android mobile apps auto-refresh!
      try {
        await supabase.rpc("emit_sync_invalidation", {
          p_user_id: session.user.id,
          p_profile_id: profileId,
          p_surface: "library",
          p_metadata: { source: "nuvio-web", content_id: idStr, action: "add" },
        });
      } catch {}
    }
  } catch (err) {
    console.error("Failed to push library item to Supabase", err);
  }

  return newItem;
}

/**
 * Removes an item from the library (both local cache, Dexie, and Supabase cloud).
 */
export async function removeFromLibrary(id: string | number): Promise<void> {
  const items = getLibraryItems();
  const idStr = String(id);
  const updated = items.filter((i) => String(i.id) !== idStr);
  const profileId = getActiveProfileId();

  // 1. Optimistic local & IndexedDB update
  saveLibraryItems(updated);
  saveLibraryToIndexedDB(updated, profileId);

  // 2. Remove from Supabase
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase
        .from("library_items")
        .delete()
        .match({ user_id: session.user.id, content_id: idStr });

      try {
        await supabase.rpc("emit_sync_invalidation", {
          p_user_id: session.user.id,
          p_profile_id: profileId,
          p_surface: "library",
          p_metadata: { source: "nuvio-web", content_id: idStr, action: "delete" },
        });
      } catch {}
    }
  } catch (err) {
    console.error("Failed to delete library item from Supabase", err);
  }
}

export async function toggleLibraryItem(
  movie: TMDBMovie,
  preferredCategory?: LibraryCategory
): Promise<boolean> {
  if (isInLibrary(movie.id)) {
    await removeFromLibrary(movie.id);
    return false; // Removed
  } else {
    await addToLibrary(movie, preferredCategory);
    return true; // Added
  }
}

export async function updateLibraryCategory(
  id: string | number,
  newCategory: LibraryCategory
): Promise<void> {
  const items = getLibraryItems();
  const idStr = String(id);
  const updated = items.map((item) => {
    if (String(item.id) === idStr) {
      return { ...item, category: newCategory };
    }
    return item;
  });
  const profileId = getActiveProfileId();

  saveLibraryItems(updated);
  saveLibraryToIndexedDB(updated, profileId);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase
        .from("library_items")
        .update({ content_type: newCategory })
        .match({ user_id: session.user.id, content_id: idStr });

      try {
        await supabase.rpc("emit_sync_invalidation", {
          p_user_id: session.user.id,
          p_profile_id: profileId,
          p_surface: "library",
          p_metadata: { source: "nuvio-web", content_id: idStr, action: "category_change" },
        });
      } catch {}
    }
  } catch (err) {
    console.error("Failed to update library category in Supabase", err);
  }
}
