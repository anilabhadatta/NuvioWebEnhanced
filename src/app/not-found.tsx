"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d0d0d 0%, #1a0a1a 50%, #0a0d1a 100%)" }}
    >
      {/* Decorative backdrop glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Logo */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 sm:px-10 py-5">
        <span className="text-2xl font-black tracking-tight text-white">Nuvio</span>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 flex flex-col items-center max-w-md">
        {/* Large Gradient Error Code */}
        <h1 className="text-8xl sm:text-9xl font-black tracking-tighter mb-4 animate-pulse select-none">
          <span className="bg-gradient-to-r from-orange-400 to-pink-500 bg-clip-text text-transparent">
            404
          </span>
        </h1>

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
          Page Not Found
        </h2>
        
        <p className="text-[#999] text-sm sm:text-base mb-8 leading-relaxed">
          We couldn&apos;t find the page you were looking for. It might have been moved or deleted.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <button
            onClick={() => router.back()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-black font-bold text-sm transition-all shadow-lg cursor-pointer"
          >
            Go Back
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-transparent border border-white/20 hover:border-white/40 hover:bg-white/5 text-white font-semibold text-sm transition-all text-center"
          >
            Return Home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 text-center text-[#555] text-xs">
        Powered by Nuvio · Tapframe &amp; friends
      </footer>
    </div>
  );
}
