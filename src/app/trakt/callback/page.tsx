"use client";

import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeTraktAuth } from "@/lib/trakt";

function TraktCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state");
    const error = params.get("error");
    if (error || !code) {
      setStatus("error");
      return;
    }
    completeTraktAuth(code, state).then((ok) => {
      setStatus(ok ? "ok" : "error");
      if (ok) setTimeout(() => router.replace("/settings"), 1200);
    });
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center gap-4 text-center px-6">
      {status === "working" && (
        <>
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white font-semibold">Connecting your Trakt account…</p>
        </>
      )}
      {status === "ok" && (
        <>
          <p className="text-2xl">✅</p>
          <p className="text-white font-semibold">Trakt connected. Redirecting…</p>
        </>
      )}
      {status === "error" && (
        <>
          <p className="text-2xl">⚠️</p>
          <p className="text-white font-semibold">Could not connect Trakt.</p>
          <button
            onClick={() => router.replace("/settings")}
            className="mt-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-sm"
          >
            Back to Settings
          </button>
        </>
      )}
    </div>
  );
}

export default function TraktCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d0d0d]" />}>
      <TraktCallbackInner />
    </Suspense>
  );
}
