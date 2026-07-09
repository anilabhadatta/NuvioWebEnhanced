"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

/**
 * Client-side route guard. Renders children only for authenticated users.
 * Anonymous/guest users and signed-out users are redirected to /login with a
 * `next` param so they return to the protected page after signing in.
 *
 * Exception: Guest/anonymous users are permitted to access /player for local testing.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isAnonymous, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLocalTesting = searchParams.get("localTesting") === "true";

  const isAllowed = isAuthenticated || (isAnonymous && isLocalTesting);

  useEffect(() => {
    if (loading) return;
    if (!isAllowed) {
      const next = encodeURIComponent(
        typeof window !== "undefined" ? window.location.pathname + window.location.search : pathname,
      );
      router.replace(`/login?next=${next}`);
    }
  }, [isAllowed, loading, router, pathname]);

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#111111] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAllowed) {
    return (
      <div className="w-full h-screen bg-[#111111] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-white font-semibold text-lg">Sign in required</p>
        <p className="text-[#888] text-sm max-w-sm">You need to be signed in to access this page. Redirecting to sign in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
