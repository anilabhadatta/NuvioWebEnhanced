"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import MoviPlayerScreen from "./MoviPlayerScreen";
import LocalPlayerScreen from "./LocalPlayerScreen";
import PlaysVideoPlayerScreen from "./PlaysVideoPlayerScreen";
import VlcPlayerScreen from "./VlcPlayerScreen";

export default function PlayerScreen() {
  const [engine, setEngine] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const isLocalTesting = searchParams.get("localTesting") === "true";

  useEffect(() => {
    const saved = localStorage.getItem("nuvio.player_engine") || "movi-player";
    setEngine(saved);
  }, []);

  if (isLocalTesting) {
    return <LocalPlayerScreen />;
  }

  if (!engine) {
    return <div className="w-full h-screen bg-black" />;
  }

  /*
  if (engine === "PlaysVideo") {
    return <PlaysVideoPlayerScreen />;
  }

  if (engine === "vlc.js") {
    return <VlcPlayerScreen />;
  }
  */

  return <MoviPlayerScreen />;
}
