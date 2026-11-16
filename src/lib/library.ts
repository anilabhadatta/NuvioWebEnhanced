import { supabase } from "./supabase";
import { getActiveProfileId } from "./profiles";
import { TMDBMovie } from "./tmdb";
import { handleInvalidTokenError } from "./useAuth";

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

    // 1. Primary: Supabase RPC `sync_pull_library`
    let rows: any[] | null = null;
    const { data: rpcData, error: rpcError } = await supabase.rpc("sync_pull_library", {
      p_profile_id: profileId,
      p_limit: 1000,
      p_offset: 0,
    });

    if (!rpcError && Array.isArray(rpcData)) {
      rows = rpcData;
    } else {
      if (rpcError) {
        handleInvalidTokenError(rpcError);
        console.warn("sync_pull_library RPC failed, trying direct table query", rpcError);
      }
      // 2. Fallback: Direct select on `library_items`
      const { data: tableData, error: tableError } = await supabase
        .from("library_items")
        .select("*")
        .eq("profile_id", profileId)
        .order("added_at", { ascending: false });

      if (!tableError && Array.isArray(tableData)) {
        rows = tableData;
      }
    }

    if (rows && Array.isArray(rows)) {
      const mapped: LibraryItem[] = rows.map((r: any) => {
        const rawType = (r.content_type || "").toLowerCase();
        let cat: LibraryCategory = "movie";
        if (rawType === "anime") cat = "anime";
        else if (rawType === "series" || rawType === "tv") cat = "series";
        else cat = "movie";

        // Normalize poster & backdrop URLs
        let poster = r.poster || null;
        let backdrop = r.background || null;

        return {
          id: r.content_id || r.id,
          supabaseId: r.id,
          title: r.name || "Untitled",
          type: cat === "series" ? "series" : "movie",
          category: cat,
          posterPath: poster,
          backdropPath: backdrop,
          overview: r.description || "",
          releaseDate: r.release_info || "",
          rating: r.imdb_rating ? Number(r.imdb_rating) : undefined,
          genres: Array.isArray(r.genres) ? r.genres : [],
          addedAt: r.added_at ? Number(r.added_at) : Date.now(),
        };
      });

      // Save to local cache
      saveLibraryItems(mapped);
      return mapped;
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
  saveLibraryItems(updated);

  // 2. Sync to Supabase in the background
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const profileId = getActiveProfileId();
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

      // Push via sync_push_library RPC
      const { error: rpcError } = await supabase.rpc("sync_push_library", {
        p_profile_id: profileId,
        p_origin_client_id: getSyncClientId(),
        p_items: [payload],
      });

      if (rpcError) {
        console.warn("sync_push_library RPC error, upserting to library_items", rpcError);
        handleInvalidTokenError(rpcError);
        // Fallback direct upsert
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
      }
    }
  } catch (err) {
    console.error("Failed to push library item to Supabase", err);
  }

  return newItem;
}

/**
 * Removes an item from the library (both local cache and Supabase cloud).
 */
export async function removeFromLibrary(id: string | number): Promise<void> {
  const items = getLibraryItems();
  const idStr = String(id);
  const updated = items.filter((i) => String(i.id) !== idStr);

  // 1. Optimistic local update
  saveLibraryItems(updated);

  // 2. Remove from Supabase
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const profileId = getActiveProfileId();
      await supabase
        .from("library_items")
        .delete()
        .match({ content_id: idStr, profile_id: profileId });
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

  saveLibraryItems(updated);

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const profileId = getActiveProfileId();
      await supabase
        .from("library_items")
        .update({ content_type: newCategory })
        .match({ content_id: idStr, profile_id: profileId });
    }
  } catch (err) {
    console.error("Failed to update library category in Supabase", err);
  }
}
