import { Suspense } from "react";
import PlayerScreen from "@/components/PlayerScreen";

export default function PlayerPage() {
  return (
    <Suspense fallback={<div className="w-full h-screen bg-black" />}>
      <PlayerScreen />
    </Suspense>
  );
}
