"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { usePathname } from "next/navigation";

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
 * Checks if an error object or HTTP response represents an invalid,
 * expired, malformed, or revoked authentication token.
 */
export function isInvalidTokenError(error: any): boolean {
  if (!error) return false;
  const status = error.status || error.statusCode || error.code;
  const message = (error.message || error.error_description || error.details || "").toString().toLowerCase();
  const errCode = (error.code || "").toString().toLowerCase();

  // 401 Unauthorized or PostgREST 301 (JWT expired or invalid)
  if (status === 401 || errCode === "pgrst301" || status === "pgrst301" || status === "401") {
    return true;
  }

  const invalidKeywords = [
    "invalid token",
    "token is expired",
    "jwt expired",
    "invalid jwt",
    "jwt malformed",
    "invalid_grant",
    "user_not_found",
    "session_not_found",
    "user from sub claim in jwt does not exist",
    "claim in jwt does not exist",
    "bad_jwt",
    "unauthorized",
  ];

  return invalidKeywords.some((kw) => message.includes(kw) || errCode.includes(kw));
}

let isLoggingOut = false;

/**
 * Performs auto logout by clearing all authentication caches and signing out from Supabase.
 */
export async function performAutoLogout() {
  if (isLoggingOut) return;
  isLoggingOut = true;
  try {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("nuvio_is_authenticated_cache");
        localStorage.removeItem("nuvio_display_name_cache");
        localStorage.removeItem("nuvio_anon");
        localStorage.removeItem("nuvio_cloud_progress");
      } catch {}
    }
    try {
      await supabase.auth.signOut();
    } catch {}
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  } finally {
    isLoggingOut = false;
  }
}

/**
 * Checks if the error indicates an invalid token and automatically logs out if true.
 */
export function handleInvalidTokenError(error: any): boolean {
  if (isInvalidTokenError(error)) {
    performAutoLogout();
    return true;
  }
  return false;
}

const AuthContext = createContext<AuthInfo | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [cachedName, setCachedName] = useState<string>("Sign In");
  const [cachedAuth, setCachedAuth] = useState<boolean>(false);
  const pathname = usePathname();

  // Sync anonymous/guest mode marker from localStorage on navigation
  useEffect(() => {
    try {
      setIsAnonymous(!!localStorage.getItem("nuvio_anon"));
    } catch { /* ignore */ }
  }, [pathname]);

  useEffect(() => {
    let mounted = true;

    // Load from localStorage cache instantly on mount
    try {
      const name = localStorage.getItem("nuvio_display_name_cache");
      if (name) setCachedName(name);
      setCachedAuth(localStorage.getItem("nuvio_is_authenticated_cache") === "true");
    } catch {}

    const initSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error && isInvalidTokenError(error)) {
          await performAutoLogout();
          return;
        }

        if (data?.session) {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (!mounted) return;

          if (userError && isInvalidTokenError(userError)) {
            await performAutoLogout();
            return;
          }

          if (userData?.user) {
            setSession(data.session);
            const name = deriveDisplayName(userData.user, false);
            setCachedName(name);
            setCachedAuth(true);
            try {
              localStorage.setItem("nuvio_is_authenticated_cache", "true");
              localStorage.setItem("nuvio_display_name_cache", name);
            } catch {}
          } else {
            await performAutoLogout();
            return;
          }
        } else {
          setSession(null);
          setCachedName(isAnonymous ? "Guest" : "Sign In");
          setCachedAuth(false);
          try {
            localStorage.removeItem("nuvio_is_authenticated_cache");
            localStorage.removeItem("nuvio_display_name_cache");
          } catch {}
        }
      } catch (err) {
        if (isInvalidTokenError(err)) {
          await performAutoLogout();
          return;
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initSession();

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
        setCachedName(isAnonymous ? "Guest" : "Sign In");
        setCachedAuth(false);
        try {
          localStorage.removeItem("nuvio_is_authenticated_cache");
          localStorage.removeItem("nuvio_display_name_cache");
        } catch {}
        return;
      }

      if (newSession) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!mounted) return;

        if (userError && isInvalidTokenError(userError)) {
          await performAutoLogout();
          return;
        }

        setSession(newSession);
        setLoading(false);
        const name = deriveDisplayName(userData?.user || newSession.user, false);
        setCachedName(name);
        setCachedAuth(true);
        try {
          localStorage.setItem("nuvio_is_authenticated_cache", "true");
          localStorage.setItem("nuvio_display_name_cache", name);
        } catch {}
      } else {
        setSession(null);
        setLoading(false);
        setCachedName(isAnonymous ? "Guest" : "Sign In");
        setCachedAuth(false);
        try {
          localStorage.removeItem("nuvio_is_authenticated_cache");
          localStorage.removeItem("nuvio_display_name_cache");
        } catch {}
      }
    });

    const handleInvalidTokenEvent = () => {
      performAutoLogout();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("nuvio:invalid-token", handleInvalidTokenEvent);
    }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      if (typeof window !== "undefined") {
        window.removeEventListener("nuvio:invalid-token", handleInvalidTokenEvent);
      }
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

export function useAuth(): AuthInfo {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;

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
  const pathname = usePathname();

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    try {
      setIsAnonymous(!!localStorage.getItem("nuvio_anon"));
    } catch { /* ignore */ }
  }, [pathname]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    let mounted = true;

    try {
      const name = localStorage.getItem("nuvio_display_name_cache");
      if (name) setCachedName(name);
      setCachedAuth(localStorage.getItem("nuvio_is_authenticated_cache") === "true");
    } catch {}

    const initFallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error && isInvalidTokenError(error)) {
          await performAutoLogout();
          return;
        }

        if (data?.session) {
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (!mounted) return;

          if (userError && isInvalidTokenError(userError)) {
            await performAutoLogout();
            return;
          }

          if (userData?.user) {
            setSession(data.session);
            const name = deriveDisplayName(userData.user, false);
            setCachedName(name);
            setCachedAuth(true);
          } else {
            await performAutoLogout();
            return;
          }
        } else {
          setSession(null);
          setCachedName(isAnonymous ? "Guest" : "Sign In");
          setCachedAuth(false);
        }
      } catch (err) {
        if (isInvalidTokenError(err)) {
          await performAutoLogout();
          return;
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initFallback();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      if (newSession) {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!mounted) return;

        if (userError && isInvalidTokenError(userError)) {
          await performAutoLogout();
          return;
        }

        setSession(newSession);
        setLoading(false);
        const name = deriveDisplayName(userData?.user || newSession.user, false);
        setCachedName(name);
        setCachedAuth(true);
      } else {
        setSession(null);
        setLoading(false);
        setCachedName(isAnonymous ? "Guest" : "Sign In");
        setCachedAuth(false);
      }
    });

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
