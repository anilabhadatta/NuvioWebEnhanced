import { getActiveProfileId } from "./profiles";
import { TMDBMovie } from "./tmdb";

export type LibraryCategory = "movie" | "series" | "anime";

export interface LibraryItem {
  id: string | number;
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

export function autoDetectCategory(movie: Partial<TMDBMovie> & { original_language?: string; media_type?: string }): LibraryCategory {
  const isTv = movie.media_type === "tv" || movie.media_type === "series" || (!movie.title && !!movie.name);
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

export function saveLibraryItems(items: LibraryItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("nuvio:library-updated", { detail: items }));
  } catch (e) {
    console.error("Failed to save library items", e);
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

export function addToLibrary(
  movie: TMDBMovie,
  preferredCategory?: LibraryCategory
): LibraryItem {
  const items = getLibraryItems();
  const idStr = String(movie.id);
  const existingIdx = items.findIndex((i) => String(i.id) === idStr);

  const category = preferredCategory || autoDetectCategory(movie);
  const isTv = movie.media_type === "tv" || movie.media_type === "series" || (!movie.title && !!movie.name);
  const type: "movie" | "tv" | "series" = isTv ? "tv" : "movie";
  const title = movie.title || movie.name || "Untitled";

  const newItem: LibraryItem = {
    id: movie.id,
    title,
    type,
    category,
    posterPath: movie.poster_path || null,
    backdropPath: movie.backdrop_path || null,
    overview: movie.overview,
    releaseDate: movie.release_date || movie.first_air_date,
    rating: movie.vote_average,
    voteCount: (movie as any).vote_count,
    originalLanguage: movie.original_language,
    addedAt: Date.now(),
  };

  let updated: LibraryItem[];
  if (existingIdx >= 0) {
    // Update existing
    updated = [...items];
    updated[existingIdx] = { ...items[existingIdx], ...newItem };
  } else {
    // Prepend new item
    updated = [newItem, ...items];
  }

  saveLibraryItems(updated);
  return newItem;
}

export function removeFromLibrary(id: string | number): void {
  const items = getLibraryItems();
  const updated = items.filter((i) => String(i.id) !== String(id));
  saveLibraryItems(updated);
}

export function toggleLibraryItem(
  movie: TMDBMovie,
  preferredCategory?: LibraryCategory
): boolean {
  if (isInLibrary(movie.id)) {
    removeFromLibrary(movie.id);
    return false; // Removed
  } else {
    addToLibrary(movie, preferredCategory);
    return true; // Added
  }
}

export function updateLibraryCategory(id: string | number, newCategory: LibraryCategory): void {
  const items = getLibraryItems();
  const updated = items.map((item) => {
    if (String(item.id) === String(id)) {
      return { ...item, category: newCategory };
    }
    return item;
  });
  saveLibraryItems(updated);
}
