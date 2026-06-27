"use client";

import React from "react";
import Sidebar from "@/components/Sidebar";

export default function LibraryPage() {
  return (
    <div className="flex min-h-screen bg-[#111111]">
      <Sidebar />
      <main className="flex-1 ml-[220px] p-8">
        <h1 className="text-3xl font-bold text-white mb-2">Library</h1>
        <p className="text-[#666] text-sm mb-8">Your saved and watched content will appear here.</p>

        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-6 border border-white/5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-10 h-10 text-[#444]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
          </div>
          <h2 className="text-white font-semibold text-lg mb-2">Your library is empty</h2>
          <p className="text-[#666] text-sm max-w-xs">Browse content on the Home page and add items to your library.</p>
        </div>
      </main>
    </div>
  );
}
