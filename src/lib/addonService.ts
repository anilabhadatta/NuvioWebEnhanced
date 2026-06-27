import { createBrowserClient } from "@supabase/ssr";

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

export async function fetchUserAddons(): Promise<NuvioAddon[]> {
  const supabase = createAddonClient();
  const { data, error } = await supabase
    .from("addons")
    .select("url, name, enabled, sort_order")
    .eq("profile_id", 1)
    .order("sort_order", { ascending: true });

  let addons: NuvioAddon[] = [];

  if (error) {
    console.error("Error fetching addons:", error);
    addons = getFallbackAddons();
  } else {
    addons = data as NuvioAddon[];
  }

  // Merge with localStorage addons if in browser
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("nuvio_plugins");
      if (cached) {
        const localPlugins = JSON.parse(cached);
        localPlugins.forEach((p: any) => {
          if (!addons.find(a => a.url === p.url)) {
            // Check if it's a repo with providers
            if (p.providers && p.providers.length > 0) {
               // Add each provider URL. Usually provider URL is something like the plugin url
               // But wait, the repo just installs the providers. 
               // Actually we just add the repo url itself, Nuvio stream parsing will handle it if supported.
               addons.push({ url: p.url, name: p.name, enabled: true, sort_order: addons.length });
            } else {
               addons.push({ url: p.url, name: p.name, enabled: true, sort_order: addons.length });
            }
          }
        });
      }
    } catch (e) {}
  }

  return addons;
}

function getFallbackAddons(): NuvioAddon[] {
  return [
    { url: "https://v3-cinemeta.strem.io/manifest.json", name: "Cinemeta", enabled: true, sort_order: 0 },
    { url: "https://torrentio.strem.fun/manifest.json", name: "Torrentio", enabled: true, sort_order: 1 },
    { url: "https://opensubtitles-v3.strem.io/manifest.json", name: "OpenSubtitles v3", enabled: true, sort_order: 2 }
  ];
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
}

export async function fetchStreamsFromAddon(addon: NuvioAddon, type: string, videoId: string): Promise<StreamItem[]> {
  try {
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
        } catch(e) {}
      }
      return {
        name: s.name,
        title: s.title,
        description: s.description || s.title,
        url: s.url,
        infoHash: s.infoHash,
        externalUrl: s.externalUrl,
        addonName: prettyName,
      };
    });
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

function buildSubtitleUrl(manifestUrl: string, type: string, videoId: string): string {
  const baseUrl = manifestUrl.split("/manifest.json")[0];
  const query = manifestUrl.includes("?") ? "?" + manifestUrl.split("?")[1] : "";
  return `${baseUrl}/subtitles/${encodeURIComponent(type)}/${encodeURIComponent(videoId)}.json${query}`;
}

export async function fetchAllSubtitles(type: string, videoId: string): Promise<SubtitleItem[]> {
  const addons = await fetchUserAddons();
  
  const promises = addons.map(async (addon) => {
    try {
      const subUrl = buildSubtitleUrl(addon.url, type, videoId);
      const res = await fetch(subUrl);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data || !data.subtitles) return [];
      
      return data.subtitles.map((sub: any, idx: number) => {
        let prettyName = addon.name || addon.url;
        if (prettyName.startsWith("http")) {
          try {
             prettyName = new URL(prettyName).hostname.replace("www.", "");
          } catch(e){}
        }
        return {
          id: `${prettyName}-${idx}`,
          lang: sub.lang || 'Unknown',
          name: sub.lang ? `${sub.lang} (${prettyName})` : `Subtitle (${prettyName})`,
          url: sub.url
        }
      });
    } catch(e) { 
      return []; 
    }
  });

  const results = await Promise.all(promises);
  return results.flat();
}
