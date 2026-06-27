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
      <body className="min-h-full bg-[#111111] text-[#f5f5f5]">{children}</body>
    </html>
  );
}
