import { supabase } from "./supabase";
import { getActiveProfileId } from "./profiles";

/**
 * Addon management — an Addon is a SINGLE Stremio addon (one manifest.json).
 * This is distinct from a Plugin (a repository of scrapers, see plugins.ts).
 *
 * Storage:
 *  - Supabase table `addons` (profile_id, url, name, enabled, sort_order)
 *  - RPC `sync_push_addons` { p_profile_id, p_addons: [{ url, name, enabled, sort_order }] }
 *  - Local cache `nuvio_addons` for instant load / offline.
 */

export interface ManagedAddon {
  url: string;          // always ends in /manifest.json (query preserved)
  name: string;
  enabled: boolean;
  sort_order: number;
  manifest?: AddonManifest | null;
  errorMessage?: string | null;
}

export interface AddonManifest {
  id: string;
  name: string;
  description?: string;
  version?: string;
  logo?: string;
  resources?: any[];
  types?: string[];
  catalogs?: any[];
  behaviorHints?: Record<string, unknown>;
}

const LOCAL_KEY = "nuvio_addons";

const DEFAULT_ADDONS: ManagedAddon[] = [
  { url: "https://v3-cinemeta.strem.io/manifest.json", name: "Cinemeta", enabled: true, sort_order: 0 },
  { url: "https://opensubtitles-v3.strem.io/manifest.json", name: "OpenSubtitles v3", enabled: true, sort_order: 1 },
];

/** Normalize a user-provided addon URL so it always points at manifest.json. */
export function normalizeManifestUrl(input: string): string {
  let url = input.trim();
  if (url.startsWith("stremio://")) url = "https://" + url.slice("stremio://".length);
  // Strip a trailing manifest.json variations, then re-append cleanly.
  const queryIndex = url.indexOf("?");
  const query = queryIndex >= 0 ? url.slice(queryIndex) : "";
  let base = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  base = base.replace(/\/+$/, "");
  if (!base.endsWith("/manifest.json")) {
    base = base.endsWith("manifest.json") ? base : `${base}/manifest.json`;
  }
  return base + query;
}

export async function fetchAddonManifest(url: string): Promise<AddonManifest | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as AddonManifest;
  } catch {
    return null;
  }
}

function readLocal(): ManagedAddon[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as ManagedAddon[]) : null;
  } catch {
    return null;
  }
}

function writeLocal(addons: ManagedAddon[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(addons));
  } catch { /* ignore */ }
}

/** Load addons for the active profile (Supabase first, then local cache, then defaults). */
export async function fetchAddons(): Promise<ManagedAddon[]> {
  const profileId = getActiveProfileId();
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data, error } = await supabase
        .from("addons")
        .select("url, name, enabled, sort_order")
        .eq("profile_id", profileId)
        .order("sort_order", { ascending: true });
      if (!error && data && data.length > 0) {
        const addons = (data as any[]).map((a, i) => ({
          url: a.url,
          name: a.name || a.url,
          enabled: a.enabled !== false,
          sort_order: a.sort_order ?? i,
        }));
        writeLocal(addons);
        return addons;
      }
    }
  } catch (e) {
    console.error("fetchAddons supabase error", e);
  }
  return readLocal() ?? DEFAULT_ADDONS;
}

export async function pushAddons(addons: ManagedAddon[]): Promise<boolean> {
  writeLocal(addons);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return false;
    const profileId = getActiveProfileId();
    const payload = addons
      .filter((a, i, arr) => arr.findIndex((x) => x.url === a.url) === i)
      .map((a, index) => ({
        url: a.url,
        name: a.name || "",
        enabled: a.enabled !== false,
        sort_order: index,
      }));
    const { error } = await supabase.rpc("sync_push_addons", {
      p_profile_id: profileId,
      p_addons: payload,
    });
    if (error) {
      console.error("sync_push_addons failed", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("pushAddons failed", e);
    return false;
  }
}

export async function addAddon(rawUrl: string, existing: ManagedAddon[]): Promise<{ ok: boolean; addon?: ManagedAddon; error?: string }> {
  const url = normalizeManifestUrl(rawUrl);
  if (existing.some((a) => a.url === url)) {
    return { ok: false, error: "Addon already installed." };
  }
  const manifest = await fetchAddonManifest(url);
  if (!manifest) {
    return { ok: false, error: "Could not load addon manifest. Check the URL." };
  }
  const addon: ManagedAddon = {
    url,
    name: manifest.name || url,
    enabled: true,
    sort_order: existing.length,
    manifest,
  };
  const next = [...existing, addon];
  await pushAddons(next);
  return { ok: true, addon };
}

export async function removeAddon(url: string, existing: ManagedAddon[]): Promise<ManagedAddon[]> {
  const next = existing.filter((a) => a.url !== url).map((a, i) => ({ ...a, sort_order: i }));
  await pushAddons(next);
  return next;
}

export async function toggleAddon(url: string, existing: ManagedAddon[]): Promise<ManagedAddon[]> {
  const next = existing.map((a) => (a.url === url ? { ...a, enabled: !a.enabled } : a));
  await pushAddons(next);
  return next;
}

/** Re-fetch one addon's manifest (the per-addon refresh button). */
export async function refreshAddon(url: string, existing: ManagedAddon[]): Promise<ManagedAddon[]> {
  const manifest = await fetchAddonManifest(url);
  return existing.map((a) =>
    a.url === url
      ? { ...a, manifest, name: manifest?.name || a.name, errorMessage: manifest ? null : "Failed to refresh manifest" }
      : a,
  );
}

/** Re-fetch every addon's manifest (the global Addon sync refresh button). */
export async function refreshAllAddons(existing: ManagedAddon[]): Promise<ManagedAddon[]> {
  const refreshed = await Promise.all(
    existing.map(async (a) => {
      const manifest = await fetchAddonManifest(a.url);
      return { ...a, manifest, name: manifest?.name || a.name, errorMessage: manifest ? null : "Failed to refresh manifest" };
    }),
  );
  return refreshed;
}
