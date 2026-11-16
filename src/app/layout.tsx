import type { Metadata, Viewport } from "next";
import Script from "next/script";
import AppProviders from "@/components/AppProviders";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://nuvio-web-enhanced.vercel.app"),
  title: "Nuvio — Stream Anything",
  description: "Your personal media hub. Browse catalogs, manage addons, and play in a powerful in-browser player.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "Nuvio — Stream Anything",
    description: "Your personal media hub. Stream anything, everywhere.",
    siteName: "Nuvio",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Nuvio — Stream Anything",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nuvio — Stream Anything",
    description: "Your personal media hub. Stream anything, everywhere.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
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
