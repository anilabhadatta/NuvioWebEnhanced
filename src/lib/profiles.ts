import { supabase } from "./supabase";
import { handleInvalidTokenError } from "./useAuth";

/**
 * Profile system mirrored from NuvioMobile (ProfileRepository).
 *  - Profiles are indexed 1..6, profile 1 is the primary.
 *  - The active profile index is persisted in localStorage so the rest of the
 *    data layer (addons, plugins, collections, watch progress) can scope its
 *    Supabase RPCs to the right profile.
 *  - Supabase RPCs: sync_pull_profiles / sync_push_profiles / sync_delete_profile_data.
 */

export const MAX_PROFILES = 6;
export const ACTIVE_PROFILE_KEY = "nuvio_active_profile_id";

export const PROFILE_COLORS = [
  "#1E88E5", "#E53935", "#43A047", "#FB8C00",
  "#8E24AA", "#00ACC1", "#F4511E", "#3949AB",
  "#C0CA33", "#D81B60", "#00897B", "#5E35B1",
];

export interface NuvioProfile {
  id?: string;
  user_id?: string;
  profile_index: number;
  name: string;
  avatar_color_hex: string;
  avatar_id?: string | null;
  avatar_url?: string | null;
  uses_primary_addons?: boolean;
  uses_primary_plugins?: boolean;
  pin_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ProfilePushPayload {
  profile_index: number;
  name: string;
  avatar_color_hex: string;
  uses_primary_addons?: boolean;
  uses_primary_plugins?: boolean;
  avatar_id?: string | null;
  avatar_url?: string | null;
}

export const DEFAULT_FALLBACK_PROFILES: NuvioProfile[] = [
  {
    profile_index: 1,
    name: "Default Profile",
    avatar_color_hex: "#FB8C00",
    uses_primary_addons: true,
    uses_primary_plugins: true,
  },
];

export function getActiveProfileId(): number {
  if (typeof window === "undefined") return 1;
  const raw = localStorage.getItem(ACTIVE_PROFILE_KEY);
  const n = raw ? parseInt(raw, 10) : 1;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function setActiveProfileId(index: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_PROFILE_KEY, String(index));
  // Notify listeners in the same tab (storage event only fires cross-tab).
  window.dispatchEvent(new CustomEvent("nuvio:profile-changed", { detail: index }));
}

export async function pullProfiles(): Promise<NuvioProfile[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      // Fallback to local cache so offline and local guests retain profiles
      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("nuvio_profiles_cache");
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
        } catch {}
      }
      return DEFAULT_FALLBACK_PROFILES;
    }

    let userProfiles: NuvioProfile[] = [];

    // 1. Primary: Supabase sync_pull_profiles RPC
    try {
      const { data, error } = await supabase.rpc("sync_pull_profiles");
      if (error) {
        handleInvalidTokenError(error);
      } else if (data && Array.isArray(data) && data.length > 0) {
        userProfiles = data;
      }
    } catch (e) {
      console.warn("sync_pull_profiles exception", e);
    }

    // 2. Direct table fallback if RPC returned 0 rows
    if (userProfiles.length === 0) {
      try {
        const { data: tableData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .order("profile_index", { ascending: true });
        if (tableData && Array.isArray(tableData) && tableData.length > 0) {
          userProfiles = tableData;
        }
      } catch {}
    }

    // 3. Dynamic fallback using authenticated Supabase user metadata
    if (userProfiles.length === 0) {
      const meta = (session.user.user_metadata || {}) as Record<string, any>;
      const dynamicName = meta.full_name || meta.name || session.user.email?.split("@")[0] || "Profile 1";
      const dynamicAvatar = meta.avatar_url || meta.picture || null;
      userProfiles = [
        {
          profile_index: 1,
          name: dynamicName,
          avatar_color_hex: "#FB8C00",
          avatar_url: dynamicAvatar,
          uses_primary_addons: true,
          uses_primary_plugins: true,
        },
      ];
    }

    const sorted = userProfiles.sort((a, b) => a.profile_index - b.profile_index);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("nuvio_profiles_cache", JSON.stringify(sorted));
      } catch {}
    }
    return sorted;
  } catch (e) {
    console.error("pullProfiles failed", e);
    handleInvalidTokenError(e);
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("nuvio_profiles_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_FALLBACK_PROFILES;
  }
}

export async function pushProfiles(profiles: ProfilePushPayload[]): Promise<boolean> {
  // Always update local cache for instant UI responsiveness
  if (typeof window !== "undefined") {
    try {
      const localProfiles: NuvioProfile[] = profiles.map((p) => ({
        profile_index: p.profile_index,
        name: p.name,
        avatar_color_hex: p.avatar_color_hex,
        avatar_id: p.avatar_id,
        avatar_url: p.avatar_url,
        uses_primary_addons: p.uses_primary_addons,
        uses_primary_plugins: p.uses_primary_plugins,
      }));
      localStorage.setItem("nuvio_profiles_cache", JSON.stringify(localProfiles));
      window.dispatchEvent(new CustomEvent("nuvio:profile-changed", { detail: getActiveProfileId() }));
    } catch {}
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return true; // Local mode succeeded

    const { error } = await supabase.rpc("sync_push_profiles", {
      p_client_max_profiles: MAX_PROFILES,
      p_profiles: profiles,
    });
    if (error) {
      console.error("pushProfiles failed", error);
      handleInvalidTokenError(error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("pushProfiles failed", e);
    handleInvalidTokenError(e);
    return false;
  }
}

export async function createProfile(
  existing: NuvioProfile[],
  name: string,
  avatarColorHex: string,
  avatarId?: string | null,
  avatarUrl?: string | null,
): Promise<boolean> {
  const used = new Set(existing.map((p) => p.profile_index));
  let nextIndex = 0;
  for (let i = 1; i <= MAX_PROFILES; i++) {
    if (!used.has(i)) { nextIndex = i; break; }
  }
  if (nextIndex === 0) return false;

  const payloads: ProfilePushPayload[] = existing.map((p) => ({
    profile_index: p.profile_index,
    name: p.name,
    avatar_color_hex: p.avatar_color_hex,
    uses_primary_addons: p.uses_primary_addons,
    uses_primary_plugins: p.uses_primary_plugins,
    avatar_id: p.avatar_id,
    avatar_url: p.avatar_url,
  }));
  payloads.push({
    profile_index: nextIndex,
    name,
    avatar_color_hex: avatarColorHex,
    avatar_id: avatarId || null,
    avatar_url: avatarUrl || null,
  });
  return pushProfiles(payloads);
}

export async function updateProfile(
  existing: NuvioProfile[],
  profileIndex: number,
  name: string,
  avatarColorHex: string,
  avatarId?: string | null,
  avatarUrl?: string | null,
): Promise<boolean> {
  const payloads: ProfilePushPayload[] = existing.map((p) =>
    p.profile_index === profileIndex
      ? {
          profile_index: profileIndex,
          name,
          avatar_color_hex: avatarColorHex,
          uses_primary_addons: p.uses_primary_addons,
          uses_primary_plugins: p.uses_primary_plugins,
          avatar_id: avatarId !== undefined ? avatarId : p.avatar_id,
          avatar_url: avatarUrl !== undefined ? avatarUrl : p.avatar_url,
        }
      : {
          profile_index: p.profile_index,
          name: p.name,
          avatar_color_hex: p.avatar_color_hex,
          uses_primary_addons: p.uses_primary_addons,
          uses_primary_plugins: p.uses_primary_plugins,
          avatar_id: p.avatar_id,
          avatar_url: p.avatar_url,
        },
  );
  return pushProfiles(payloads);
}

export async function deleteProfile(profileIndex: number): Promise<boolean> {
  // Update local cache first
  if (typeof window !== "undefined") {
    try {
      const cached = localStorage.getItem("nuvio_profiles_cache");
      if (cached) {
        const list: NuvioProfile[] = JSON.parse(cached);
        const filtered = list.filter((p) => p.profile_index !== profileIndex);
        localStorage.setItem("nuvio_profiles_cache", JSON.stringify(filtered));
      }
    } catch {}
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { error } = await supabase.rpc("sync_delete_profile_data", { p_profile_id: profileIndex });
      if (error) {
        console.error("deleteProfile failed", error);
        return false;
      }
    }
    if (getActiveProfileId() === profileIndex) setActiveProfileId(1);
    return true;
  } catch (e) {
    console.error("deleteProfile failed", e);
    return false;
  }
}
