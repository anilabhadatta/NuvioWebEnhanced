"use client";

import React, { useEffect, useState } from "react";
import MoviPlayerScreen from "./MoviPlayerScreen";
import PlaysVideoPlayerScreen from "./PlaysVideoPlayerScreen";

export default function PlayerScreen() {
  const [engine, setEngine] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("nuvio.player_engine") || "movi-player";
    setEngine(saved);
  }, []);

  if (!engine) {
    return <div className="w-full h-screen bg-black" />;
  }

  if (engine === "PlaysVideo") {
    return <PlaysVideoPlayerScreen />;
  }

  return <MoviPlayerScreen />;
}
