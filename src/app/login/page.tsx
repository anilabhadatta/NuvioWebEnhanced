import { Suspense } from "react";
import AuthScreen from "@/components/AuthScreen";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d0d0d]" />}>
      <AuthScreen />
    </Suspense>
  );
}
