import { config } from "./config";
import { saveWatchProgress } from "./watchProgress";

export const TRAKT_API_URL = config.traktApiUrl;
export const TRAKT_CLIENT_ID = config.traktClientId;
export const TRAKT_CLIENT_SECRET = config.traktClientSecret;
export const TRAKT_REDIRECT_URI = config.traktRedirectUri;

export function getTraktAuthUrl() {
  return `${TRAKT_API_URL}/oauth/authorize?response_type=code&client_id=${TRAKT_CLIENT_ID}&redirect_uri=${encodeURIComponent(TRAKT_REDIRECT_URI)}`;
}

export async function fetchTraktToken(code: string) {
  const res = await fetch(`${TRAKT_API_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      client_id: TRAKT_CLIENT_ID,
      client_secret: TRAKT_CLIENT_SECRET,
      redirect_uri: TRAKT_REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

export async function fetchTraktWatchProgress(token: string) {
  if (!token) return [];
  try {
    const res = await fetch(`${TRAKT_API_URL}/sync/playback`, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "trakt-api-version": "2",
        "trakt-api-key": TRAKT_CLIENT_ID,
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    
    // Sync to local
    data.forEach((item: any) => {
      const type = item.type;
      const media = type === "episode" ? item.show : item.movie;
      const progress = {
        id: media.ids.tmdb.toString(),
        type: type === "episode" ? "tv" : "movie",
        title: media.title,
        poster: "",
        season: type === "episode" ? item.episode.season : undefined,
        episode: type === "episode" ? item.episode.number : undefined,
        currentTime: (item.progress / 100) * 3600, // rough estimate if no duration provided
        duration: 3600,
        updatedAt: new Date(item.paused_at).getTime()
      };
      saveWatchProgress(progress);
    });
    
    return data;
  } catch (e) {
    console.error("Failed to fetch Trakt watch progress", e);
    return [];
  }
}
