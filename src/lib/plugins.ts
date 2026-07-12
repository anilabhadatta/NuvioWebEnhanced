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
    let res = await fetch(url.trim());
    if (!res.ok) {
      // Try using the CORS bypass proxy
      const proxyRes = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), method: "GET" })
      });
      if (proxyRes.ok) {
        res = proxyRes;
      }
    }
    const data = await res.json();
    if (!data || !Array.isArray(data.scrapers)) return null;
    return data as PluginManifest;
  } catch {
    // Fallback: try proxy directly if fetch raises network error (like CORS)
    try {
      const proxyRes = await fetch("/api/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), method: "GET" })
      });
      if (proxyRes.ok) {
        const data = await proxyRes.json();
        if (data && Array.isArray(data.scrapers)) {
          return data as PluginManifest;
        }
      }
    } catch (e) {
      console.error("Failed to fetch plugin manifest via proxy", e);
    }
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
          const isRepoEnabled = row.enabled !== false;
          return {
            url: row.url,
            name: row.name || cached?.name || row.url,
            enabled: isRepoEnabled,
            sort_order: row.sort_order ?? i,
            version: cached?.version,
            description: cached?.description,
            author: cached?.author,
            scraperCount: cached?.scraperCount ?? 0,
            scrapers: (cached?.scrapers ?? []).map((s) => ({
              ...s,
              enabled: isRepoEnabled ? s.enabled : false,
            })),
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
      user_id: session.user.id,
      profile_id: profileId,
      url: r.url,
      name: r.name || "",
      enabled: r.enabled !== false,
      sort_order: index,
    }));

    // Try direct delete and insert first. This ensures `enabled` is synced correctly since the
    // database RPC `sync_push_plugins` might default the `enabled` column to true.
    const { error: deleteError } = await supabase
      .from("plugins")
      .delete()
      .eq("profile_id", profileId);

    if (!deleteError) {
      if (payload.length > 0) {
        const { error: insertError } = await supabase
          .from("plugins")
          .insert(payload);

        if (!insertError) {
          return true;
        }
        console.error("Direct insert failed, falling back to RPC", insertError);
      } else {
        return true;
      }
    } else {
      console.error("Direct delete failed, falling back to RPC", deleteError);
    }

    // Fallback to RPC if direct writes fail or are restricted by RLS
    const rpcPayload = repos.map((r, index) => ({
      url: r.url,
      name: r.name || "",
      enabled: r.enabled !== false,
      sort_order: index,
    }));
    const { error: rpcError } = await supabase.rpc("sync_push_plugins", {
      p_profile_id: profileId,
      p_plugins: rpcPayload,
    });

    if (rpcError) {
      console.error("sync_push_plugins failed", rpcError);
      return false;
    }
    return true;
  } catch (e) {
    console.error("pushPlugins failed", e);
    return false;
  }
}

function repoFromManifest(
  url: string,
  manifest: PluginManifest,
  sortOrder: number,
  existingRepo?: PluginRepository
): PluginRepository {
  const repoEnabled = existingRepo ? existingRepo.enabled : true;
  return {
    url,
    name: manifest.name || url,
    enabled: repoEnabled,
    sort_order: sortOrder,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    scraperCount: manifest.scrapers.length,
    scrapers: manifest.scrapers.map((s) => {
      const existingScraper = existingRepo?.scrapers.find((x) => x.id === s.id);
      const isEnabled = existingScraper ? existingScraper.enabled : (s.enabled !== false);
      return {
        ...s,
        enabled: repoEnabled ? isEnabled : false,
      };
    }),
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
  const next = existing.map((r) => {
    if (r.url === url) {
      const nextEnabled = !r.enabled;
      return {
        ...r,
        enabled: nextEnabled,
        scrapers: r.scrapers.map((s) => ({
          ...s,
          enabled: nextEnabled ? s.enabled : false,
        })),
      };
    }
    return r;
  });
  await pushPlugins(next);
  return next;
}

export async function refreshPluginRepo(url: string, existing: PluginRepository[]): Promise<PluginRepository[]> {
  const manifest = await fetchPluginManifest(url);
  const existingRepo = existing.find((r) => r.url === url);
  const next = existing.map((r) =>
    r.url === url
      ? (manifest ? repoFromManifest(url, manifest, r.sort_order, existingRepo) : { ...r, errorMessage: "Failed to refresh repository" })
      : r
  );
  await pushPlugins(next);
  return next;
}

export async function toggleScraper(
  repoUrl: string,
  scraperId: string,
  enabled: boolean,
  existing: PluginRepository[]
): Promise<PluginRepository[]> {
  const next = existing.map((r) => {
    if (r.url === repoUrl) {
      return {
        ...r,
        scrapers: r.scrapers.map((s) => (s.id === scraperId ? { ...s, enabled } : s)),
      };
    }
    return r;
  });
  await pushPlugins(next);
  return next;
}

export function getPluginsEnabledGlobal(): boolean {
  if (typeof window === "undefined") return true;
  const val = localStorage.getItem("nuvio_plugins_enabled_global");
  return val === null ? true : val === "true";
}

export function setPluginsEnabledGlobal(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("nuvio_plugins_enabled_global", enabled ? "true" : "false");
}

export function getGroupPluginsByRepo(): boolean {
  if (typeof window === "undefined") return false;
  const val = localStorage.getItem("nuvio_group_plugins_by_repo");
  return val === "true";
}

export function setGroupPluginsByRepo(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("nuvio_group_plugins_by_repo", enabled ? "true" : "false");
}

export function loadScraperSettings(scraperId: string): any {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(`nuvio_scraper_settings_${scraperId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveScraperSettings(scraperId: string, settings: any): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`nuvio_scraper_settings_${scraperId}`, JSON.stringify(settings));
  } catch { /* ignore */ }
}

