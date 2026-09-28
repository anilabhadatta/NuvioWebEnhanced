"use client";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function VercelTrackingInner() {
  const searchParams = useSearchParams();
  if (searchParams.get("test") === "1") return null;
  
  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}

export default function VercelTracking() {
  return (
    <Suspense fallback={null}>
      <VercelTrackingInner />
    </Suspense>
  );
}
