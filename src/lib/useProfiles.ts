"use client";

import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import {
  NuvioProfile,
  getActiveProfileId,
  setActiveProfileId as persistActiveProfileId,
  pullProfiles,
} from "./profiles";
import { supabase } from "./supabase";

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
  const [profiles, setProfiles] = useState<NuvioProfile[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("nuvio_profiles_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [];
  });
  const [activeProfileId, setActiveProfileId] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return getActiveProfileId();
    }
    return 1;
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await pullProfiles();
    if (list && list.length > 0) {
      setProfiles(list);
      try {
        localStorage.setItem("nuvio_profiles_cache", JSON.stringify(list));
      } catch {}
    } else {
      // Retain existing cached profiles if network/auth hasn't finished hydrating
      try {
        const cached = localStorage.getItem("nuvio_profiles_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setProfiles(parsed);
        }
      } catch {}
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    try {
      const cached = localStorage.getItem("nuvio_profiles_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setProfiles(parsed);
      }
    } catch {}

    setActiveProfileId(getActiveProfileId());
    refresh();

    const onChange = () => {
      setActiveProfileId(getActiveProfileId());
      try {
        const cached = localStorage.getItem("nuvio_profiles_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setProfiles(parsed);
        }
      } catch {}
    };
    window.addEventListener("nuvio:profile-changed", onChange);
    window.addEventListener("storage", onChange);

    // Auto-refresh when user signs in or session hydrates on localhost!
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        refresh();
      } else if (event === "SIGNED_OUT") {
        setProfiles([]);
        try {
          localStorage.removeItem("nuvio_profiles_cache");
        } catch {}
      }
    });

    return () => {
      window.removeEventListener("nuvio:profile-changed", onChange);
      window.removeEventListener("storage", onChange);
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  const switchProfile = useCallback((index: number) => {
    persistActiveProfileId(index);
    setActiveProfileId(index);
  }, []);

  const activeProfile = profiles.find((p) => p.profile_index === activeProfileId) || profiles[0] || null;
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
  const [profiles, setProfiles] = useState<NuvioProfile[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("nuvio_profiles_cache");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return [];
  });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [activeProfileId, setActiveProfileId] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return getActiveProfileId();
    }
    return 1;
  });
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await pullProfiles();
    if (list && list.length > 0) {
      setProfiles(list);
      try {
        localStorage.setItem("nuvio_profiles_cache", JSON.stringify(list));
      } catch {}
    } else {
      try {
        const cached = localStorage.getItem("nuvio_profiles_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setProfiles(parsed);
        }
      } catch {}
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    try {
      const cached = localStorage.getItem("nuvio_profiles_cache");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) setProfiles(parsed);
      }
    } catch {}

    setActiveProfileId(getActiveProfileId());
    refresh();

    const onChange = () => {
      setActiveProfileId(getActiveProfileId());
      try {
        const cached = localStorage.getItem("nuvio_profiles_cache");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) setProfiles(parsed);
        }
      } catch {}
    };
    window.addEventListener("nuvio:profile-changed", onChange);
    window.addEventListener("storage", onChange);

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        refresh();
      } else if (event === "SIGNED_OUT") {
        setProfiles([]);
        try {
          localStorage.removeItem("nuvio_profiles_cache");
        } catch {}
      }
    });

    return () => {
      window.removeEventListener("nuvio:profile-changed", onChange);
      window.removeEventListener("storage", onChange);
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const switchProfile = useCallback((index: number) => {
    persistActiveProfileId(index);
    setActiveProfileId(index);
  }, []);

  const activeProfile = profiles.find((p) => p.profile_index === activeProfileId) || profiles[0] || null;

  return { profiles, activeProfileId, activeProfile, loading, refresh, switchProfile };
}
