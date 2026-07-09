import { Suspense } from "react";
import SettingsScreen from "@/components/SettingsScreen";
import RequireAuth from "@/components/RequireAuth";

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="w-full h-screen bg-[#111111]" />}>
      <RequireAuth>
        <SettingsScreen />
      </RequireAuth>
    </Suspense>
  );
}
