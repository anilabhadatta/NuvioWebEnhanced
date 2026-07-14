import { supabase } from "./supabase";

export interface WatchProgress {
  id: string;        // IMDb ID (tt-prefixed) if available, otherwise TMDB ID
  type: string;      // "movie" | "tv" | "series"
  title: string;     // Show/movie title from TMDB
  poster: string;    // Backdrop or poster URL from TMDB
  season?: number;
  episode?: number;
  episodeTitle?: string;   // Episode title for TV (shown on mobile continue watching)
  episodeThumbnail?: string; // TMDB still image for the episode
  currentTime: number;
  duration: number;
  updatedAt: number;
}

const STORAGE_KEY = "nuvio_watch_progress";

export async function saveWatchProgress(progress: WatchProgress) {
  if (typeof window === "undefined") return;

  const percent = progress.duration > 0 ? (progress.currentTime / progress.duration) : 0;

  // 1. Save locally for instantaneous UI updates
  try {
    const existingStr = localStorage.getItem(STORAGE_KEY);
    let allProgress: WatchProgress[] = existingStr ? JSON.parse(existingStr) : [];

    allProgress = allProgress.filter(p => String(p.id) !== String(progress.id));

    if (percent < 0.95 && progress.currentTime > 5) {
      allProgress.unshift(progress);
    }

    allProgress = allProgress.slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
  } catch (e) {
    console.error("Failed to save watch progress locally", e);
  }

  // If local testing (indicated by "local_" prefix), skip cloud sync
  if (String(progress.id).startsWith("local_")) {
    return;
  }

  // 2. Sync cross-platform via NuvioDesktop Supabase RPC Architecture
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const profileIdStr = localStorage.getItem("nuvio_active_profile_id") || "1";
    const profileId = parseInt(profileIdStr, 10);

    // --- Mobile/Desktop compatibility ---
    // content_type: mobile uses "series" for TV shows, not "tv"
    const isTv = progress.type === "tv" || progress.type === "series";
    const contentType = isTv ? "series" : "movie";

    // content_id: use as-is (should be IMDb ID when player passes one)
    const contentId = String(progress.id);

    // video_id: mobile uses Stremio-style "{id}:{season}:{episode}" for TV.
    // This is what mobile keys its local metadata cache on for thumbnails.
    const videoId = (isTv && progress.season != null && progress.episode != null)
      ? `${contentId}:${progress.season}:${progress.episode}`
      : contentId;

    const progressKey = (progress.season !== undefined && progress.episode !== undefined)
      ? `${contentId}_s${progress.season}e${progress.episode}`
      : contentId;

    const entry = {
      content_id: contentId,
      content_type: contentType,
      video_id: videoId,
      season: progress.season || null,
      episode: progress.episode || null,
      position: Math.floor(progress.currentTime * 1000), // Mobile/Desktop expect ms
      duration: Math.floor(progress.duration * 1000),
      last_watched: progress.updatedAt,
      progress_key: progressKey
    };

    if (percent >= 0.95) {
      // Mark as fully watched — matches NuvioMobile's SupabaseWatchedSyncAdapter contract.
      await supabase.rpc("sync_delete_watch_progress", {
        p_profile_id: profileId,
        p_keys: [progressKey]
      });
      await supabase.rpc("sync_push_watched_items", {
        p_profile_id: profileId,
        p_items: [{
          content_id: contentId,
          content_type: contentType,
          title: progress.title || "",
          season: progress.season ?? null,
          episode: progress.episode ?? null,
          watched_at: Date.now()
        }]
      });
    } else {
      // Push in-progress entry.
      await supabase.rpc("sync_push_watch_progress", {
        p_profile_id: profileId,
        p_entries: [entry]
      });
    }
  } catch (e) {
    console.error("Failed to sync watch progress to cloud", e);
  }
}

export function getWatchProgress(): WatchProgress[] {
  if (typeof window === "undefined") return [];
  try {
    const existingStr = localStorage.getItem(STORAGE_KEY);
    return existingStr ? JSON.parse(existingStr) : [];
  } catch (e) {
    return [];
  }
}

export async function syncWatchProgressFromCloud() {
  if (typeof window === "undefined") return;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const profileIdStr = localStorage.getItem("nuvio_active_profile_id") || "1";
    const profileId = parseInt(profileIdStr, 10);

    const { data, error } = await supabase.rpc("sync_pull_watch_progress", {
      p_profile_id: profileId,
      p_limit: 100
    });

    if (error || !data) return;

    // Cache the raw desktop RPC records so we can check them instantly on playback
    localStorage.setItem("nuvio_cloud_progress", JSON.stringify(data));
  } catch (e) {
    console.error("Error pulling cloud progress", e);
  }
}

export function getResumeTime(id: string, type: string, season?: number, episode?: number, imdbId?: string): number {
  const local = getWatchProgress();
  const localFound = local.find(p => 
    (String(p.id) === String(id) || (imdbId && String(p.id) === String(imdbId))) && 
    p.type === type && 
    p.season === season && 
    p.episode === episode
  );
  
  try {
    const cloudStr = localStorage.getItem("nuvio_cloud_progress");
    if (cloudStr) {
      const cloudData = JSON.parse(cloudStr);
      const cloudFound = cloudData.find((p: any) => 
        (String(p.content_id) === String(id) || (imdbId && String(p.content_id) === String(imdbId))) && 
        // Accept both "tv" and "series" since old web records used "tv"
        (p.content_type === type || (p.content_type === "series" && type === "tv") || (p.content_type === "tv" && type === "series")) &&
        p.season === (season || null) && 
        p.episode === (episode || null)
      );
      
      if (cloudFound) {
        const cloudTimeSecs = cloudFound.position / 1000;
        // Use cloud time if it's more recent than local time
        if (!localFound || cloudFound.last_watched > localFound.updatedAt) {
          return cloudTimeSecs;
        }
      }
    }
  } catch (e) {}

  return localFound ? localFound.currentTime : 0;
}
