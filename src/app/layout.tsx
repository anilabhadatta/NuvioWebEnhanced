import type { Metadata } from "next";
import Script from "next/script";
import AppProviders from "@/components/AppProviders";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nuvio — Stream Anything",
  description: "Your personal media streaming platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full bg-[#111111] text-[#f5f5f5]" suppressHydrationWarning>
        {/*
          Load the COI service worker on every page.
          The SW itself is smart: it only injects security headers on same-origin
          requests and lets cross-origin requests (TMDB images, etc.) pass through
          completely untouched. This is required for iPad/Safari SharedArrayBuffer.
        */}
        <Script src="/coi-serviceworker.js" strategy="afterInteractive" />
        <AppProviders>
          {children}
        </AppProviders>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
