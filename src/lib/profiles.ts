import { supabase } from "./supabase";

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
    if (!session) return [];
    const { data, error } = await supabase.rpc("sync_pull_profiles");
    if (error || !data) return [];
    return (data as NuvioProfile[]).sort((a, b) => a.profile_index - b.profile_index);
  } catch (e) {
    console.error("pullProfiles failed", e);
    return [];
  }
}

export async function pushProfiles(profiles: ProfilePushPayload[]): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("sync_push_profiles", {
      p_client_max_profiles: MAX_PROFILES,
      p_profiles: profiles,
    });
    if (error) {
      console.error("pushProfiles failed", error);
      return false;
    }
    return true;
  } catch (e) {
    console.error("pushProfiles failed", e);
    return false;
  }
}

export async function createProfile(
  existing: NuvioProfile[],
  name: string,
  avatarColorHex: string,
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
  payloads.push({ profile_index: nextIndex, name, avatar_color_hex: avatarColorHex });
  return pushProfiles(payloads);
}

export async function updateProfile(
  existing: NuvioProfile[],
  profileIndex: number,
  name: string,
  avatarColorHex: string,
): Promise<boolean> {
  const payloads: ProfilePushPayload[] = existing.map((p) =>
    p.profile_index === profileIndex
      ? { profile_index: profileIndex, name, avatar_color_hex: avatarColorHex,
          uses_primary_addons: p.uses_primary_addons, uses_primary_plugins: p.uses_primary_plugins,
          avatar_id: p.avatar_id, avatar_url: p.avatar_url }
      : { profile_index: p.profile_index, name: p.name, avatar_color_hex: p.avatar_color_hex,
          uses_primary_addons: p.uses_primary_addons, uses_primary_plugins: p.uses_primary_plugins,
          avatar_id: p.avatar_id, avatar_url: p.avatar_url },
  );
  return pushProfiles(payloads);
}

export async function deleteProfile(profileIndex: number): Promise<boolean> {
  try {
    const { error } = await supabase.rpc("sync_delete_profile_data", { p_profile_id: profileIndex });
    if (error) {
      console.error("deleteProfile failed", error);
      return false;
    }
    if (getActiveProfileId() === profileIndex) setActiveProfileId(1);
    return true;
  } catch (e) {
    console.error("deleteProfile failed", e);
    return false;
  }
}
