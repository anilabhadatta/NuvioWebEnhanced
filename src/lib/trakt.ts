import { config } from "./config";

/**
 * Trakt integration mirrored from NuvioMobile TraktAuthRepository.
 * Authorization-code OAuth flow with token refresh + CSRF state validation.
 *  - Authorize: https://trakt.tv/oauth/authorize
 *  - Token:     {API}/oauth/token  (grant_type authorization_code | refresh_token)
 *  - Revoke:    {API}/oauth/revoke
 * Token state persisted in localStorage so the user stays connected.
 */

export const TRAKT_API_URL = config.traktApiUrl || "https://api.trakt.tv";
export const TRAKT_AUTHORIZE_URL = "https://trakt.tv/oauth/authorize";
export const TRAKT_CLIENT_ID = config.traktClientId;
export const TRAKT_CLIENT_SECRET = config.traktClientSecret;
export const TRAKT_REDIRECT_URI = config.traktRedirectUri;

const STATE_KEY = "nuvio_trakt_oauth_state";
const AUTH_KEY = "nuvio_trakt_auth";

export interface TraktAuthState {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  createdAt: number;   // seconds
  expiresIn: number;   // seconds
  username?: string;
}

export function hasTraktCredentials(): boolean {
  return !!TRAKT_CLIENT_ID && !!TRAKT_CLIENT_SECRET;
}

export function loadTraktAuth(): TraktAuthState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw) as TraktAuthState) : null;
  } catch {
    return null;
  }
}

function saveTraktAuth(state: TraktAuthState | null) {
  if (typeof window === "undefined") return;
  if (state) localStorage.setItem(AUTH_KEY, JSON.stringify(state));
  else localStorage.removeItem(AUTH_KEY);
}

export function isTraktConnected(): boolean {
  const s = loadTraktAuth();
  return !!s?.accessToken;
}

function generateState(): string {
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

/** Build the authorize URL and stash the CSRF state for callback validation. */
export function beginTraktAuth(): string {
  const state = generateState();
  if (typeof window !== "undefined") localStorage.setItem(STATE_KEY, state);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: TRAKT_CLIENT_ID,
    redirect_uri: TRAKT_REDIRECT_URI,
    state,
  });
  return `${TRAKT_AUTHORIZE_URL}?${params.toString()}`;
}

interface TraktTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  created_at: number;
}

/** Exchange the authorization code for tokens (called from the callback page). */
export async function completeTraktAuth(code: string, returnedState: string | null): Promise<boolean> {
  if (typeof window !== "undefined") {
    const expected = localStorage.getItem(STATE_KEY);
    if (expected && returnedState && expected !== returnedState) {
      console.error("Trakt OAuth state mismatch");
      return false;
    }
    localStorage.removeItem(STATE_KEY);
  }
  try {
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
    if (!res.ok) return false;
    const token = (await res.json()) as TraktTokenResponse;
    saveTraktAuth({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenType: token.token_type,
      createdAt: token.created_at,
      expiresIn: token.expires_in,
    });
    await refreshTraktUserSettings();
    return true;
  } catch (e) {
    console.error("completeTraktAuth failed", e);
    return false;
  }
}

function isExpiringOrExpired(state: TraktAuthState): boolean {
  const expiresAt = state.createdAt + state.expiresIn;
  const now = Math.floor(Date.now() / 1000);
  return now >= expiresAt - 60;
}

async function refreshTokenIfNeeded(state: TraktAuthState): Promise<TraktAuthState | null> {
  if (!isExpiringOrExpired(state)) return state;
  try {
    const res = await fetch(`${TRAKT_API_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refresh_token: state.refreshToken,
        client_id: TRAKT_CLIENT_ID,
        client_secret: TRAKT_CLIENT_SECRET,
        redirect_uri: TRAKT_REDIRECT_URI,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    const token = (await res.json()) as TraktTokenResponse;
    const next: TraktAuthState = {
      ...state,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      tokenType: token.token_type,
      createdAt: token.created_at,
      expiresIn: token.expires_in,
    };
    saveTraktAuth(next);
    return next;
  } catch (e) {
    console.error("Trakt token refresh failed", e);
    return null;
  }
}

export async function authorizedTraktHeaders(): Promise<Record<string, string> | null> {
  let state = loadTraktAuth();
  if (!state?.accessToken) return null;
  state = await refreshTokenIfNeeded(state);
  if (!state) return null;
  return {
    "trakt-api-version": "2",
    "trakt-api-key": TRAKT_CLIENT_ID,
    Authorization: `Bearer ${state.accessToken}`,
  };
}

export async function refreshTraktUserSettings(): Promise<string | null> {
  const headers = await authorizedTraktHeaders();
  if (!headers) return null;
  try {
    const res = await fetch(`${TRAKT_API_URL}/users/settings`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const username = data?.user?.username;
    const state = loadTraktAuth();
    if (state && username) {
      saveTraktAuth({ ...state, username });
    }
    return username || null;
  } catch {
    return null;
  }
}

export async function disconnectTrakt(): Promise<void> {
  const state = loadTraktAuth();
  if (state?.accessToken && hasTraktCredentials()) {
    try {
      await fetch(`${TRAKT_API_URL}/oauth/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: state.accessToken,
          client_id: TRAKT_CLIENT_ID,
          client_secret: TRAKT_CLIENT_SECRET,
        }),
      });
    } catch { /* ignore */ }
  }
  saveTraktAuth(null);
}

/** Scrobble start/stop. ids should contain at least imdb or tmdb. */
export async function traktScrobble(
  action: "start" | "stop" | "pause",
  payload: {
    type: "movie" | "episode";
    ids: { imdb?: string; tmdb?: number };
    title?: string;
    season?: number;
    episode?: number;
    progress: number; // 0..100
  },
): Promise<boolean> {
  const headers = await authorizedTraktHeaders();
  if (!headers) return false;
  const body: any = { progress: payload.progress };
  if (payload.type === "movie") {
    body.movie = { ids: payload.ids };
  } else {
    body.show = { ids: payload.ids };
    body.episode = { season: payload.season, number: payload.episode };
  }
  try {
    const res = await fetch(`${TRAKT_API_URL}/scrobble/${action}`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok || res.status === 409;
  } catch {
    return false;
  }
}
