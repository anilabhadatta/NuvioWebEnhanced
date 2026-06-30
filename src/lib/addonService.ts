import { createBrowserClient } from "@supabase/ssr";
import { fetchAddons, fetchAddonManifest } from "./addons";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dpyhjjcoabcglfmgecug.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRweWhqamNvYWJjZ2xmbWdlY3VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3ODYyNDcsImV4cCI6MjA4NjM2MjI0N30.U-3QSNDdpsnvRk_7ZL419AFTOtggHJJcmkodxeXjbkg";

export const createAddonClient = () => {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
};

export interface NuvioAddon {
  url: string;
  name: string;
  enabled: boolean;
  sort_order: number;
}

/**
 * Fetch the active profile's installed Stremio addons (single addons only).
 * Delegates to the addon management layer (addons.ts) which is profile-scoped
 * and kept separate from plugin repositories (plugins.ts). Disabled addons are
 * filtered out so stream/subtitle queries only hit active sources.
 */
export async function fetchUserAddons(): Promise<NuvioAddon[]> {
  const addons = await fetchAddons();
  return addons
    .filter((a) => a.enabled !== false)
    .map((a) => ({ url: a.url, name: a.name, enabled: a.enabled !== false, sort_order: a.sort_order }));
}

/**
 * Builds the URL to fetch streams from a Stremio addon
 */
export function buildStreamUrl(manifestUrl: string, type: string, videoId: string): string {
  // baseUrl is everything before /manifest.json
  const baseUrl = manifestUrl.split("/manifest.json")[0];
  const query = manifestUrl.includes("?") ? "?" + manifestUrl.split("?")[1] : "";
  return `${baseUrl}/stream/${encodeURIComponent(type)}/${encodeURIComponent(videoId)}.json${query}`;
}

export interface StreamItem {
  name?: string;
  title?: string;
  description?: string;
  url?: string;
  infoHash?: string;
  externalUrl?: string;
  addonName?: string;
  addonUrl?: string;
}

// Streams the browser can't realistically play smoothly. REMUX files are huge
// (often 40-80GB) and AV1 falls back to software decode in most browsers, which
// can't sustain realtime 1080p/4K. We hide these from the web player entirely.
// We also hide AVI/XviD/DivX as they force inefficient software decoding over HTTP.
const UNSUPPORTED_STREAM_PATTERN = /\b(remux|av1|av01|avi|xvid|divx)\b/i;

/**
 * True when a stream is light enough for in-browser playback. Filters out
 * REMUX and AV1 sources, which are too heavy for the WASM/WebCodecs pipeline.
 */
export function isSupportedStream(s: StreamItem): boolean {
  const text = `${s.name || ""} ${s.title || ""} ${s.description || ""}`;
  return !UNSUPPORTED_STREAM_PATTERN.test(text);
}


function isLikelySubtitleAddon(addon: NuvioAddon): boolean {
  const str = (addon.name + " " + addon.url).toLowerCase();
  return str.includes("subtitle") || str.includes("opensubtitles");
}

function isLikelyMetaAddon(addon: NuvioAddon): boolean {
  const str = (addon.name + " " + addon.url).toLowerCase();
  return str.includes("cinemeta") || str.includes("tmdb") || str.includes("cyberflix") || str.includes("seriesgraph") || str.includes("rpdb") || str.includes("mdblist");
}

function isLikelyStreamAddon(addon: NuvioAddon): boolean {
  const str = (addon.name + " " + addon.url).toLowerCase();
  return str.includes("torrentio") || str.includes("comet") || str.includes("jacketio") || str.includes("mediafusion") || str.includes("aiostreams") || str.includes("annatar") || str.includes("knightcrawler") || str.includes("stremify") || str.includes("peerflix");
}

export async function fetchStreamsFromAddon(addon: NuvioAddon, type: string, videoId: string): Promise<StreamItem[]> {
  try {
    if (isLikelySubtitleAddon(addon) || isLikelyMetaAddon(addon)) {
      return []; // Skip meta/catalog and subtitle addons
    }

    const streamUrl = buildStreamUrl(addon.url, type, videoId);
    console.log("Fetching streams from:", streamUrl);
    const res = await fetch(streamUrl);
    if (!res.ok) return [];

    const data = await res.json();
    if (!data || !data.streams) return [];

    return data.streams.map((s: any) => {
      let prettyName = addon.name || addon.url;
      if (prettyName.startsWith("http")) {
        try {
          const urlObj = new URL(prettyName);
          prettyName = urlObj.hostname.replace("www.", "");
        } catch (e) { }
      }
      return {
        name: s.name,
        title: s.title,
        description: s.description || s.title,
        url: s.url,
        infoHash: s.infoHash,
        externalUrl: s.externalUrl,
        addonName: prettyName,
        addonUrl: addon.url,
      };
    }).filter(isSupportedStream);
  } catch (err) {
    console.error("Error fetching from addon", addon.url, err);
    return [];
  }
}

export interface SubtitleItem {
  id: string;
  lang: string;
  name: string;
  url: string;
}

function buildSubtitleUrl(manifestUrl: string, type: string, videoId: string, hash?: string | null): string {
  const baseUrl = manifestUrl.split("/manifest.json")[0];
  const query = manifestUrl.includes("?") ? "?" + manifestUrl.split("?")[1] : "";
  let id = videoId;
  if (hash) {
    id += `|videoHash=${hash}|infoHash=${hash}`;
  }
  return `${baseUrl}/subtitles/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json${query}`;
}


export async function fetchAllSubtitles(type: string, videoId: string, streamHash?: string | null): Promise<SubtitleItem[]> {
  const addons = await fetchUserAddons();

  // Filter out stream and meta addons from subtitle queries
  const subtitleAddons = addons.filter((addon) => 
    !isLikelyMetaAddon(addon) && !isLikelyStreamAddon(addon)
  );

  const promises = subtitleAddons.map(async (addon, addonIndex) => {
    try {
      const subUrl = buildSubtitleUrl(addon.url, type, videoId, streamHash);
      const res = await fetch(subUrl);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || !data.subtitles) return [];

      return data.subtitles.map((sub: any, idx: number) => {
        let prettyName = addon.name || addon.url;
        if (prettyName.startsWith("http")) {
          try {
            const urlObj = new URL(prettyName);
            prettyName = urlObj.hostname.replace("www.", "");
          } catch (e) { }
        }
        return {
          id: `${prettyName}-${addonIndex}-${idx}`,
          lang: sub.lang || 'Unknown',
          name: sub.lang ? `${sub.lang} (${prettyName})` : `Subtitle (${prettyName})`,
          url: sub.url
        }
      });
    } catch (e) {
      return [];
    }
  });

  const results = await Promise.all(promises);
  const flattened = results.flat();
  return flattened.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/**
 * Auto-resolve a playable stream URL for a video. Used for the auto-next-episode
 * flow where we want to start the next episode quickly without surfacing the
 * stream picker.
 *
 * When `preferredAddonUrl` is provided (the addon the user is currently watching
 * from), that addon is tried FIRST so the next episode comes from the same
 * source. If it yields nothing playable, we fall back to racing the remaining
 * enabled addons in parallel and return the first stream that comes back.
 */
export async function autoResolveFirstStream(
  type: string,
  videoId: string,
  timeoutMs: number = 10000,
  preferredAddonUrl?: string | null,
): Promise<StreamItem | null> {
  const addons = await fetchUserAddons();
  const enabled = addons.filter((a) => a.enabled !== false);
  if (enabled.length === 0) return null;

  // 1. Try the preferred addon first (same source as the current episode).
  if (preferredAddonUrl) {
    const preferred = enabled.find((a) => a.url === preferredAddonUrl);
    if (preferred) {
      try {
        const streams = await fetchStreamsFromAddon(preferred, type, videoId);
        const playable = streams.find((s) => s.url && s.url.startsWith("http"));
        if (playable) return playable;
      } catch { /* fall through to racing the rest */ }
    }
  }

  // 2. Race the remaining addons and take the first playable stream.
  const pool = preferredAddonUrl
    ? enabled.filter((a) => a.url !== preferredAddonUrl)
    : enabled;
  if (pool.length === 0) return null;

  return new Promise<StreamItem | null>((resolve) => {
    let settled = false;
    let pending = pool.length;

    const finish = (stream: StreamItem | null) => {
      if (settled) return;
      settled = true;
      resolve(stream);
    };

    const timeout = setTimeout(() => finish(null), timeoutMs);

    pool.forEach((addon) => {
      fetchStreamsFromAddon(addon, type, videoId)
        .then((streams) => {
          if (settled) return;
          const playable = streams.find((s) => s.url && s.url.startsWith("http"));
          if (playable) {
            clearTimeout(timeout);
            finish(playable);
          }
        })
        .catch(() => { /* ignore */ })
        .finally(() => {
          pending -= 1;
          if (pending <= 0 && !settled) {
            clearTimeout(timeout);
            finish(null);
          }
        });
    });
  });
}
