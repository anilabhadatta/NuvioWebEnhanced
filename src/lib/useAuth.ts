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

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    try {
      setIsAnonymous(!!localStorage.getItem("nuvio_anon"));
    } catch { /* ignore */ }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  const value = {
    session,
    user,
    loading,
    isAuthenticated: !!session,
    isAnonymous,
    displayName: deriveDisplayName(user, isAnonymous),
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
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    try {
      setIsAnonymous(!!localStorage.getItem("nuvio_anon"));
    } catch { /* ignore */ }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;
  return {
    session,
    user,
    loading,
    isAuthenticated: !!session,
    isAnonymous,
    displayName: deriveDisplayName(user, isAnonymous),
  };
}
