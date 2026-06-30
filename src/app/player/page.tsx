import { Suspense } from "react";
import Script from "next/script";
import PlayerScreen from "@/components/PlayerScreen";
import RequireAuth from "@/components/RequireAuth";

export default function PlayerPage() {
  return (
    <RequireAuth>
      {/* Load COI service worker specifically for the player (Safari requires this for SharedArrayBuffer) */}
      <Script src="/coi-serviceworker.js" strategy="afterInteractive" />
      <Suspense fallback={<div className="w-full h-screen bg-black" />}>
        <PlayerScreen />
      </Suspense>
    </RequireAuth>
  );
}
