import { supabase } from "./supabase";

export interface WatchProgress {
  id: string;        // tmdb ID
  type: string;      // "movie" | "tv"
  title: string;
  poster: string;
  season?: number;
  episode?: number;
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

  // 2. Sync cross-platform via NuvioDesktop Supabase RPC Architecture
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return; 

    const profileIdStr = localStorage.getItem("nuvio_active_profile_id") || "1";
    const profileId = parseInt(profileIdStr, 10);

    const progressKey = (progress.season !== undefined && progress.episode !== undefined)
      ? `${progress.id}_s${progress.season}e${progress.episode}`
      : String(progress.id);

    const entry = {
      content_id: String(progress.id),
      content_type: progress.type,
      video_id: String(progress.id),
      season: progress.season || null,
      episode: progress.episode || null,
      position: Math.floor(progress.currentTime * 1000), // Desktop expects ms
      duration: Math.floor(progress.duration * 1000),
      last_watched: progress.updatedAt,
      progress_key: progressKey
    };

    if (percent >= 0.95) {
      // Mark as fully watched. Matches NuvioMobile's SupabaseWatchedSyncAdapter
      // contract exactly: RPC param is `p_items` (NOT p_entries) and each item is
      // { content_id, content_type, title, season, episode, watched_at }.
      await supabase.rpc("sync_delete_watch_progress", {
        p_profile_id: profileId,
        p_keys: [progressKey]
      });
      await supabase.rpc("sync_push_watched_items", {
        p_profile_id: profileId,
        p_items: [{
           content_id: String(progress.id),
           content_type: progress.type,
           title: progress.title || "",
           season: progress.season ?? null,
           episode: progress.episode ?? null,
           watched_at: Date.now()
        }]
      });
    } else {
      // Push in-progress entry. sync_push_watch_progress uses `p_entries`.
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

export function getResumeTime(id: string, type: string, season?: number, episode?: number): number {
  const local = getWatchProgress();
  const localFound = local.find(p => String(p.id) === String(id) && p.type === type && p.season === season && p.episode === episode);
  
  try {
    const cloudStr = localStorage.getItem("nuvio_cloud_progress");
    if (cloudStr) {
      const cloudData = JSON.parse(cloudStr);
      const cloudFound = cloudData.find((p: any) => 
        String(p.content_id) === String(id) && 
        p.content_type === type && 
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
