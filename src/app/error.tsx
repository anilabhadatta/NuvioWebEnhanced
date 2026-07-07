"use client";

import React, { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to console or error tracking service
    console.error("Application runtime error boundary caught:", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0d0d0d 0%, #1a0a1a 50%, #0a0d1a 100%)" }}
    >
      {/* Decorative backdrop glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Logo */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 sm:px-10 py-5">
        <span className="text-2xl font-black tracking-tight text-white">Nuvio</span>
      </header>

      {/* Main Content Card */}
      <main className="relative z-10 flex flex-col items-center max-w-md">
        {/* Large Gradient Error Code */}
        <h1 className="text-8xl sm:text-9xl font-black tracking-tighter mb-4 animate-pulse select-none">
          <span className="bg-gradient-to-r from-red-400 to-pink-500 bg-clip-text text-transparent">
            500
          </span>
        </h1>

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
          Something went wrong
        </h2>
        
        <p className="text-[#999] text-sm sm:text-base mb-8 leading-relaxed">
          An unexpected application error occurred. You can attempt to retry the action or return to the home screen.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center mb-8">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white hover:bg-gray-100 text-black font-bold text-sm transition-all shadow-lg cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-transparent border border-white/20 hover:border-white/40 hover:bg-white/5 text-white font-semibold text-sm transition-all text-center"
          >
            Return Home
          </Link>
        </div>

        {/* Developer Diagnostics Info */}
        {error.message && (
          <details className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-left max-w-sm cursor-pointer select-none">
            <summary className="text-[#aaa] text-xs font-semibold hover:text-white transition-colors">
              Show Diagnostic Details
            </summary>
            <div className="mt-2.5 pt-2.5 border-t border-white/5 overflow-x-auto max-h-40 scrollbar-hide text-[11px] font-mono text-red-300 leading-normal select-text">
              <p className="font-bold break-all mb-1">{error.name}: {error.message}</p>
              {error.digest && <p className="text-gray-500 mt-1">Digest: {error.digest}</p>}
              {error.stack && (
                <pre className="mt-2 text-gray-500 break-words whitespace-pre-wrap font-mono">
                  {error.stack}
                </pre>
              )}
            </div>
          </details>
        )}
      </main>

      {/* Footer */}
      <footer className="absolute bottom-6 text-center text-[#555] text-xs">
        Powered by Nuvio · Tapframe &amp; friends
      </footer>
    </div>
  );
}
