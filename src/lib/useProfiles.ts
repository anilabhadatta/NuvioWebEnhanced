"use client";

import { useCallback, useEffect, useState } from "react";
import {
  NuvioProfile,
  getActiveProfileId,
  setActiveProfileId as persistActiveProfileId,
  pullProfiles,
} from "./profiles";

export interface ProfilesState {
  profiles: NuvioProfile[];
  activeProfileId: number;
  activeProfile: NuvioProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  switchProfile: (index: number) => void;
}

/**
 * Reactive profile state. Pulls profiles from Supabase and tracks the active
 * profile index (persisted in localStorage). Switching a profile broadcasts a
 * `nuvio:profile-changed` event so other parts of the app can re-pull
 * profile-scoped data (addons, plugins, collections, watch progress).
 */
export function useProfiles(): ProfilesState {
  const [profiles, setProfiles] = useState<NuvioProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await pullProfiles();
    setProfiles(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    setActiveProfileId(getActiveProfileId());
    refresh();

    const onChange = () => setActiveProfileId(getActiveProfileId());
    window.addEventListener("nuvio:profile-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("nuvio:profile-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [refresh]);

  const switchProfile = useCallback((index: number) => {
    persistActiveProfileId(index);
    setActiveProfileId(index);
  }, []);

  const activeProfile = profiles.find((p) => p.profile_index === activeProfileId) ?? null;

  return { profiles, activeProfileId, activeProfile, loading, refresh, switchProfile };
}
