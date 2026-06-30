import SettingsScreen from "@/components/SettingsScreen";
import RequireAuth from "@/components/RequireAuth";

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsScreen />
    </RequireAuth>
  );
}
