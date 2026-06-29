import type { Metadata } from "next";
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
      <head>
        {/* coi-serviceworker injects COOP/COEP headers via a service worker for
            browsers that need SharedArrayBuffer (required by movi-player's WASM).
            On hosts where response headers are already set (Vercel /player route),
            it's a no-op. On mobile Safari where header support is inconsistent,
            this ensures the security context is established. */}
        <script src="/coi-serviceworker.js" defer></script>
      </head>
      <body className="min-h-full bg-[#111111] text-[#f5f5f5]">{children}</body>
    </html>
  );
}
