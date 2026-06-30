"use client";

import { useEffect, useState } from "react";
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

/**
 * Reactive auth state backed by the Supabase session (persisted in cookies by
 * @supabase/ssr, so the user stays signed in across reloads/sessions).
 */
export function useAuth(): AuthInfo {
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
  return {
    session,
    user,
    loading,
    isAuthenticated: !!session,
    isAnonymous,
    displayName: deriveDisplayName(user, isAnonymous),
  };
}
