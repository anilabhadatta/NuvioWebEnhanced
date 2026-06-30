"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import TorboxLibrary from "@/components/TorboxLibrary";

export default function LibraryPage() {
  return (
    <div className="flex min-h-screen bg-[#111111]">
      <Sidebar />
      <main className="flex-1 ml-[220px] p-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-2">Library</h1>
        <p className="text-[#666] text-sm mb-8">Your connected cloud storage and saved content.</p>

        <TorboxLibrary />
      </main>
    </div>
  );
}
