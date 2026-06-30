"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading, displayName } = useAuth();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    try { localStorage.removeItem("nuvio_anon"); } catch { /* ignore */ }
    router.refresh();
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(135deg, #0d0d0d 0%, #1a0a1a 50%, #0a0d1a 100%)" }}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-5">
        <span className="text-2xl font-black tracking-tight text-white">Nuvio</span>
        <div className="flex items-center gap-3">
          {!loading && isAuthenticated ? (
            <>
              <span className="hidden sm:inline text-sm text-[#aaa]">
                Signed in as <span className="text-white font-semibold">{displayName}</span>
              </span>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
              >
                Logout
              </button>
            </>
          ) : !loading ? (
            <>
              <Link
                href="/login"
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
              >
                Login
              </Link>
              <Link
                href="/login?mode=signup"
                className="px-4 py-2 rounded-xl bg-white hover:bg-gray-100 text-black text-sm font-bold transition-colors"
              >
                Sign Up
              </Link>
            </>
          ) : null}
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <h1 className="text-5xl sm:text-7xl font-black tracking-tight text-white mb-4">
          Stream anything.
          <br />
          <span className="bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
            Everywhere.
          </span>
        </h1>
        <p className="text-[#999] text-base sm:text-lg max-w-xl mb-10">
          Your personal media hub. Browse catalogs, manage addons, and play in a powerful in-browser player — no downloads required.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <Link
            href="/dashboard"
            className="px-8 py-3.5 rounded-xl bg-white hover:bg-gray-100 text-black font-bold text-base transition-all shadow-lg"
          >
            Launch Dashboard
          </Link>
          {!loading && !isAuthenticated && (
            <Link
              href="/login"
              className="px-8 py-3.5 rounded-xl bg-transparent border border-white/20 hover:border-white/40 hover:bg-white/5 text-white font-semibold text-base transition-all"
            >
              Login / Sign Up
            </Link>
          )}
        </div>

        <p className="text-[#555] text-xs mt-8 max-w-md">
          Browsing is open to everyone. Sign in to play, manage settings, and sync your library across devices.
        </p>
      </main>

      <footer className="text-center text-[#555] text-xs py-6">
        Powered by Nuvio · Tapframe &amp; friends
      </footer>
    </div>
  );
}
