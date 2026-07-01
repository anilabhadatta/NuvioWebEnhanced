"use client";

import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
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

const ProfilesContext = createContext<ProfilesState | null>(null);

export function ProfilesProvider({ children }: { children: React.ReactNode }) {
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
  const value = { profiles, activeProfileId, activeProfile, loading, refresh, switchProfile };

  return React.createElement(ProfilesContext.Provider, { value }, children);
}

/**
 * Reactive profile state. Pulls profiles from Supabase and tracks the active
 * profile index (persisted in localStorage). Switching a profile broadcasts a
 * `nuvio:profile-changed` event so other parts of the app can re-pull
 * profile-scoped data (addons, plugins, collections, watch progress).
 */
export function useProfiles(): ProfilesState {
  const ctx = useContext(ProfilesContext);
  if (ctx) return ctx;

  // Fallback to local state if hook is used outside provider
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [profiles, setProfiles] = useState<NuvioProfile[]>([]);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [activeProfileId, setActiveProfileId] = useState<number>(1);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await pullProfiles();
    setProfiles(list);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
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

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const switchProfile = useCallback((index: number) => {
    persistActiveProfileId(index);
    setActiveProfileId(index);
  }, []);

  const activeProfile = profiles.find((p) => p.profile_index === activeProfileId) ?? null;

  return { profiles, activeProfileId, activeProfile, loading, refresh, switchProfile };
}
