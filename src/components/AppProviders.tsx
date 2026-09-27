"use client";

import React, { useEffect } from "react";
import { AuthProvider } from "@/lib/useAuth";
import { ProfilesProvider } from "@/lib/useProfiles";
import { precacheMoviPlayer } from "@/lib/moviPlayer";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    precacheMoviPlayer();
  }, []);

  return (
    <AuthProvider>
      <ProfilesProvider>
        {children}
      </ProfilesProvider>
    </AuthProvider>
  );
}
