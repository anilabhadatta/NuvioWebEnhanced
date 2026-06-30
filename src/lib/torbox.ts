/**
 * TorBox cloud library integration, mirrored from NuvioMobile TorboxApiClient.
 * Base: https://api.torbox.app, Bearer API key auth.
 *
 * NOTE: TorBox endpoints are CORS-restricted in the browser for some routes.
 * The library listing (mylist) and requestdl with redirect=false return JSON
 * and generally work; if a CORS error occurs the caller surfaces it to the user.
 */

const KEY_STORAGE = "nuvio_torbox_api_key";

export interface TorboxFile {
  id: number;
  name: string;
  size?: number;
  mimetype?: string;
}

export interface TorboxItem {
  id: number;
  name: string;
  hash?: string;
  download_state?: string;
  progress?: number;       // 0..1
  size?: number;
  files: TorboxFile[];
  cached?: boolean;
}

export function getTorboxApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY_STORAGE) || "";
}

export function setTorboxApiKey(key: string) {
  if (typeof window === "undefined") return;
  if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
  else localStorage.removeItem(KEY_STORAGE);
}

function authHeaders(apiKey: string): HeadersInit {
  return { Authorization: `Bearer ${apiKey.trim()}` };
}
void authHeaders; // retained for potential direct-call fallback; not used with proxy

/**
 * All TorBox API calls go through our same-origin JSON proxy (/api/torbox) to
 * avoid CORS. The API key travels in the x-torbox-key header (not the URL), and
 * `__KEY__` in the path is substituted server-side for endpoints that need the
 * token as a query param (requestdl).
 */
async function proxyFetch(path: string, apiKey: string): Promise<Response> {
  return fetch(`/api/torbox?p=${encodeURIComponent(path)}`, {
    headers: { "x-torbox-key": apiKey.trim() },
  });
}

export async function validateTorboxKey(apiKey: string): Promise<boolean> {
  try {
    const res = await proxyFetch("/v1/api/user/me", apiKey);
    return res.ok;
  } catch {
    return false;
  }
}

interface TorboxEnvelope<T> {
  success: boolean;
  detail?: string;
  data: T;
}

async function getEnvelope<T>(path: string, apiKey: string): Promise<T | null> {
  try {
    const res = await proxyFetch(path, apiKey);
    if (!res.ok) return null;
    const json = (await res.json()) as TorboxEnvelope<T>;
    if (!json.success) return null;
    return json.data;
  } catch (e) {
    console.error("TorBox request failed", path, e);
    return null;
  }
}

function mapItems(raw: any[]): TorboxItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => ({
    id: t.id,
    name: t.name,
    hash: t.hash,
    download_state: t.download_state,
    progress: typeof t.progress === "number" ? t.progress : undefined,
    size: t.size,
    cached: t.cached ?? t.download_present ?? undefined,
    files: Array.isArray(t.files)
      ? t.files.map((f: any) => ({ id: f.id, name: f.name, size: f.size, mimetype: f.mimetype }))
      : [],
  }));
}

export async function listTorboxTorrents(apiKey: string): Promise<TorboxItem[]> {
  const data = await getEnvelope<any[]>(`/v1/api/torrents/mylist`, apiKey);
  return mapItems(data || []);
}

export async function listTorboxUsenet(apiKey: string): Promise<TorboxItem[]> {
  const data = await getEnvelope<any[]>(`/v1/api/usenet/mylist`, apiKey);
  return mapItems(data || []);
}

export async function listTorboxWebDownloads(apiKey: string): Promise<TorboxItem[]> {
  const data = await getEnvelope<any[]>(`/v1/api/webdl/mylist`, apiKey);
  return mapItems(data || []);
}

/** Fetch a single torrent with its files (used to list playable files). */
export async function getTorboxTorrent(apiKey: string, id: number): Promise<TorboxItem | null> {
  const data = await getEnvelope<any>(
    `/v1/api/torrents/mylist?id=${id}&bypass_cache=true`,
    apiKey,
  );
  if (!data) return null;
  const arr = Array.isArray(data) ? data : [data];
  return mapItems(arr)[0] ?? null;
}

/** Request a direct download/stream link for a file. redirect=false → JSON link. */
export async function requestTorboxLink(apiKey: string, torrentId: number, fileId: number): Promise<string | null> {
  // token is substituted server-side from the x-torbox-key header (__KEY__).
  const path = `/v1/api/torrents/requestdl?token=__KEY__&torrent_id=${torrentId}&file_id=${fileId}&zip_link=false&redirect=false&append_name=false`;
  const data = await getEnvelope<string>(path, apiKey);
  return data || null;
}

export function isPlayableFile(name: string): boolean {
  return /\.(mp4|mkv|webm|avi|mov|m4v|ts)$/i.test(name);
}
