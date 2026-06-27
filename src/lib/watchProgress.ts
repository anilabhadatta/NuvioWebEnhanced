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

export function saveWatchProgress(progress: WatchProgress) {
  if (typeof window === "undefined") return;
  try {
    const existingStr = localStorage.getItem(STORAGE_KEY);
    let allProgress: WatchProgress[] = existingStr ? JSON.parse(existingStr) : [];
    
    // Remove existing entry for the same media
    allProgress = allProgress.filter(p => p.id !== progress.id);
    
    // If it's more than 95% complete, don't keep it in continue watching
    const percent = progress.duration > 0 ? (progress.currentTime / progress.duration) : 0;
    if (percent < 0.95 && progress.currentTime > 5) { // At least 5 seconds watched
      allProgress.unshift(progress); // add to top
    }
    
    // Keep only last 30
    allProgress = allProgress.slice(0, 30);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(allProgress));
  } catch (e) {
    console.error("Failed to save watch progress", e);
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

export function getResumeTime(id: string, type: string, season?: number, episode?: number): number {
  const all = getWatchProgress();
  const found = all.find(p => p.id === id && p.type === type && p.season === season && p.episode === episode);
  return found ? found.currentTime : 0;
}
