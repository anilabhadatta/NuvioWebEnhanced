import { Suspense } from "react";
import PlayerScreen from "@/components/PlayerScreen";
import RequireAuth from "@/components/RequireAuth";

export default function PlayerPage() {
  return (
    <Suspense fallback={<div className="w-full h-screen bg-black" />}>
      <RequireAuth>
        <PlayerScreen />
      </RequireAuth>
    </Suspense>
  );
}
