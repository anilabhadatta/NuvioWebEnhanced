import { Suspense } from "react";
import PlayerScreen from "@/components/PlayerScreen";
import RequireAuth from "@/components/RequireAuth";

export default function PlayerPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<div className="w-full h-screen bg-black" />}>
        <PlayerScreen />
      </Suspense>
    </RequireAuth>
  );
}
