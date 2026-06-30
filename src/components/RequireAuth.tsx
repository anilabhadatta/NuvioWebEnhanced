"use client";

import React, { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/useAuth";

/**
 * Client-side route guard. Renders children only for authenticated users.
 * Anonymous/guest users and signed-out users are redirected to /login with a
 * `next` param so they return to the protected page after signing in.
 *
 * Used to protect /player and /settings. The dashboard remains public.
 */
export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      const next = encodeURIComponent(
        typeof window !== "undefined" ? window.location.pathname + window.location.search : pathname,
      );
      router.replace(`/login?next=${next}`);
    }
  }, [isAuthenticated, loading, router, pathname]);

  if (loading) {
    return (
      <div className="w-full h-screen bg-[#111111] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="w-full h-screen bg-[#111111] flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-white font-semibold text-lg">Sign in required</p>
        <p className="text-[#888] text-sm max-w-sm">You need to be signed in to access this page. Redirecting to sign in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
