"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export interface AuthInfo {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  /** True when the user chose "continue without account" (local guest). */
  isAnonymous: boolean;
  /** Friendly display name derived from the user metadata/email. */
  displayName: string;
}

function deriveDisplayName(user: User | null, isAnonymous: boolean): string {
  if (user) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = (meta.full_name || meta.name) as string | undefined;
    if (fullName && fullName.trim()) return fullName.trim();
    if (user.email) return user.email.split("@")[0];
    return "Account";
  }
  return isAnonymous ? "Guest" : "Sign In";
}

const AuthContext = createContext<AuthInfo | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [cachedName, setCachedName] = useState<string>("Sign In");
  const [cachedAuth, setCachedAuth] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    // Load from localStorage cache instantly on mount
    try {
      const name = localStorage.getItem("nuvio_display_name_cache");
      if (name) setCachedName(name);
      setCachedAuth(localStorage.getItem("nuvio_is_authenticated_cache") === "true");
    } catch {}

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session) {
        const name = deriveDisplayName(data.session.user, false);
        setCachedName(name);
        setCachedAuth(true);
        localStorage.setItem("nuvio_is_authenticated_cache", "true");
        localStorage.setItem("nuvio_display_name_cache", name);
      } else {
        setCachedName(isAnonymous ? "Guest" : "Sign In");
        setCachedAuth(false);
        localStorage.removeItem("nuvio_is_authenticated_cache");
        localStorage.removeItem("nuvio_display_name_cache");
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
      if (newSession) {
        const name = deriveDisplayName(newSession.user, false);
        setCachedName(name);
        setCachedAuth(true);
        localStorage.setItem("nuvio_is_authenticated_cache", "true");
        localStorage.setItem("nuvio_display_name_cache", name);
      } else {
        setCachedName(isAnonymous ? "Guest" : "Sign In");
        setCachedAuth(false);
        localStorage.removeItem("nuvio_is_authenticated_cache");
        localStorage.removeItem("nuvio_display_name_cache");
      }
    });

    try {
      setIsAnonymous(!!localStorage.getItem("nuvio_anon"));
    } catch { /* ignore */ }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [isAnonymous]);

  const user = session?.user ?? null;
  const value = {
    session,
    user,
    loading,
    isAuthenticated: !!session || cachedAuth,
    isAnonymous,
    displayName: session ? deriveDisplayName(user, isAnonymous) : cachedName,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

/**
 * Reactive auth state backed by the Supabase session (persisted in cookies by
 * @supabase/ssr, so the user stays signed in across reloads/sessions).
 */
export function useAuth(): AuthInfo {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;

  // Fallback to local state if hook is used outside provider
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [session, setSession] = useState<Session | null>(null);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [isAnonymous, setIsAnonymous] = useState(false);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [cachedName, setCachedName] = useState<string>("Sign In");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [cachedAuth, setCachedAuth] = useState<boolean>(false);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    let mounted = true;

    try {
      const name = localStorage.getItem("nuvio_display_name_cache");
      if (name) setCachedName(name);
      setCachedAuth(localStorage.getItem("nuvio_is_authenticated_cache") === "true");
    } catch {}

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
      if (data.session) {
        const name = deriveDisplayName(data.session.user, false);
        setCachedName(name);
        setCachedAuth(true);
        localStorage.setItem("nuvio_is_authenticated_cache", "true");
        localStorage.setItem("nuvio_display_name_cache", name);
      } else {
        setCachedName(isAnonymous ? "Guest" : "Sign In");
        setCachedAuth(false);
        localStorage.removeItem("nuvio_is_authenticated_cache");
        localStorage.removeItem("nuvio_display_name_cache");
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
      if (newSession) {
        const name = deriveDisplayName(newSession.user, false);
        setCachedName(name);
        setCachedAuth(true);
        localStorage.setItem("nuvio_is_authenticated_cache", "true");
        localStorage.setItem("nuvio_display_name_cache", name);
      } else {
        setCachedName(isAnonymous ? "Guest" : "Sign In");
        setCachedAuth(false);
        localStorage.removeItem("nuvio_is_authenticated_cache");
        localStorage.removeItem("nuvio_display_name_cache");
      }
    });

    try {
      setIsAnonymous(!!localStorage.getItem("nuvio_anon"));
    } catch { /* ignore */ }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [isAnonymous]);

  const user = session?.user ?? null;
  return {
    session,
    user,
    loading,
    isAuthenticated: !!session || cachedAuth,
    isAnonymous,
    displayName: session ? deriveDisplayName(user, isAnonymous) : cachedName,
  };
}
