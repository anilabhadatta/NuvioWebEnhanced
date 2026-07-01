"use client";

import React from "react";
import { AuthProvider } from "@/lib/useAuth";
import { ProfilesProvider } from "@/lib/useProfiles";

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <ProfilesProvider>
        {children}
      </ProfilesProvider>
    </AuthProvider>
  );
}
