import { supabase } from "./supabase";
import { getActiveProfileId } from "./profiles";

/**
 * Plugin management — a Plugin is a REPOSITORY of scrapers. Its manifest lists
 * multiple scraper scripts, each backed by a JS file. This is distinct from an
 * Addon (a single Stremio addon, see addons.ts).
 *
 * Storage:
 *  - Supabase table `plugins` (profile_id, url, name, enabled, sort_order)
 *  - RPC `sync_push_plugins` { p_profile_id, p_plugins: [{ url, name, enabled, sort_order }] }
 *  - Local cache `nuvio_plugin_repos`.
 *
 * Mirrors NuvioMobile PluginManifest / PluginManifestScraper.
 */

export interface PluginManifestScraper {
  id: string;
  name: string;
  description?: string;
  version: string;
  filename: string;
  supportedTypes?: string[];
  enabled?: boolean;
  hasSettings?: boolean;
  logo?: string;
  contentLanguage?: string[];
  supportsExternalPlayer?: boolean;
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  author?: string;
  scrapers: PluginManifestScraper[];
}

export interface PluginRepository {
  url: string;            // manifest URL
  name: string;
  enabled: boolean;
  sort_order: number;
  version?: string;
  description?: string;
  author?: string;
  scraperCount: number;
  scrapers: PluginManifestScraper[];
  errorMessage?: string | null;
}

const LOCAL_KEY = "nuvio_plugin_repos";

function readLocal(): PluginRepository[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as PluginRepository[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(repos: PluginRepository[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(repos));
  } catch { /* ignore */ }
}

export async function fetchPluginManifest(url: string): Promise<PluginManifest | null> {
  try {
    const res = await fetch(url.trim());
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.scrapers)) return null;
    return data as PluginManifest;
  } catch {
    return null;
  }
}

/** Load plugin repositories for the active profile (Supabase first, then local). */
export async function fetchPlugins(): Promise<PluginRepository[]> {
  const profileId = getActiveProfileId();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data, error } = await supabase
        .from("plugins")
        .select("url, name, enabled, sort_order")
        .eq("profile_id", profileId)
        .order("sort_order", { ascending: true });
      if (!error && data && data.length > 0) {
        // Merge cloud rows with any locally-cached manifest details.
        const local = readLocal();
        const repos = (data as any[]).map((row, i) => {
          const cached = local.find((r) => r.url === row.url);
          return {
            url: row.url,
            name: row.name || cached?.name || row.url,
            enabled: row.enabled !== false,
            sort_order: row.sort_order ?? i,
            version: cached?.version,
            description: cached?.description,
            author: cached?.author,
            scraperCount: cached?.scraperCount ?? 0,
            scrapers: cached?.scrapers ?? [],
          } as PluginRepository;
        });
        writeLocal(repos);
        return repos;
      }
    }
  } catch (e) {
    console.error("fetchPlugins supabase error", e);
  }
  return readLocal();
}

export async function pushPlugins(repos: PluginRepository[]): Promise<boolean> {
  writeLocal(repos);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const profileId = getActiveProfileId();
    const payload = repos.map((r, index) => ({
      url: r.url,
      name: r.name || "",
      enabled: r.enabled !== false,
      sort_order: index,
    }));
    const { error } = await supabase.rpc("sync_push_plugins", {
      p_profile_id: profileId,
      p_plugins: payload,
    });
    if (error) {
      console.error("sync_push_plugins failed", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("pushPlugins failed", e);
    return false;
  }
}

function repoFromManifest(url: string, manifest: PluginManifest, sortOrder: number): PluginRepository {
  return {
    url,
    name: manifest.name || url,
    enabled: true,
    sort_order: sortOrder,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    scraperCount: manifest.scrapers.length,
    scrapers: manifest.scrapers,
  };
}

export async function addPluginRepo(rawUrl: string, existing: PluginRepository[]): Promise<{ ok: boolean; repo?: PluginRepository; error?: string }> {
  const url = rawUrl.trim();
  if (existing.some((r) => r.url === url)) {
    return { ok: false, error: "Repository already installed." };
  }
  const manifest = await fetchPluginManifest(url);
  if (!manifest) {
    return { ok: false, error: "Invalid plugin repository. Manifest must list a `scrapers` array." };
  }
  const repo = repoFromManifest(url, manifest, existing.length);
  const next = [...existing, repo];
  await pushPlugins(next);
  return { ok: true, repo };
}

export async function removePluginRepo(url: string, existing: PluginRepository[]): Promise<PluginRepository[]> {
  const next = existing.filter((r) => r.url !== url).map((r, i) => ({ ...r, sort_order: i }));
  await pushPlugins(next);
  return next;
}

export async function togglePluginRepo(url: string, existing: PluginRepository[]): Promise<PluginRepository[]> {
  const next = existing.map((r) => (r.url === url ? { ...r, enabled: !r.enabled } : r));
  await pushPlugins(next);
  return next;
}

export async function refreshPluginRepo(url: string, existing: PluginRepository[]): Promise<PluginRepository[]> {
  const manifest = await fetchPluginManifest(url);
  const next = existing.map((r) =>
    r.url === url
      ? (manifest ? repoFromManifest(url, manifest, r.sort_order) : { ...r, errorMessage: "Failed to refresh repository" })
      : r,
  );
  writeLocal(next);
  return next;
}
