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

  if (error) {
    console.error("Error fetching addons:", error);
    // If not authenticated or error, return default addons
    return getFallbackAddons();
  }

  return data as NuvioAddon[];
}

function getFallbackAddons(): NuvioAddon[] {
  return [
    { url: "https://v3-cinemeta.strem.io/manifest.json", name: "Cinemeta", enabled: true, sort_order: 0 },
    { url: "https://torrentio.strem.fun/manifest.json", name: "Torrentio", enabled: true, sort_order: 1 },
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
    
    return data.streams.map((s: any) => ({
      name: s.name,
      title: s.title,
      description: s.description || s.title,
      url: s.url,
      infoHash: s.infoHash,
      externalUrl: s.externalUrl,
      addonName: addon.name || addon.url,
    }));
  } catch (err) {
    console.error("Error fetching from addon", addon.url, err);
    return [];
  }
}
