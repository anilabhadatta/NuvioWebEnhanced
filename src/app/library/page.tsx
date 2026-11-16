"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";
import LibraryView from "@/components/LibraryView";

export default function LibraryPage() {
  return (
    <div className="flex min-h-screen bg-[#111111]">
      <Sidebar />
      <main className="flex-1 min-w-0 ml-[220px] p-8 max-w-7xl">
        <LibraryView />
      </main>
    </div>
  );
}
