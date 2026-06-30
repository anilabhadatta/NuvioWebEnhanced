"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "./Sidebar";
import { config } from "@/lib/config";
import { useAuth } from "@/lib/useAuth";
import AddonsSection from "./settings/AddonsSection";
import PluginsSection from "./settings/PluginsSection";
import ProfilesSection from "./settings/ProfilesSection";
import CollectionsSection from "./settings/CollectionsSection";
import IntegrationsSection from "./settings/IntegrationsSection";

const CATEGORIES = [
  { id: "account", label: "Account" },
  { id: "profiles", label: "Profiles" },
  { id: "addons", label: "Addons" },
  { id: "plugins", label: "Plugins" },
  { id: "collections", label: "Collections" },
  { id: "integrations", label: "Integrations" },
  { id: "playback", label: "Playback" },
  { id: "advanced", label: "Advanced" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { displayName } = useAuth();
  const [active, setActive] = useState("profiles");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("nuvio_anon");
    router.push("/");
  };

  return (
    <div className="flex min-h-screen bg-[#111111]">
      <Sidebar />

      <main className="flex-1 ml-[220px] flex">
        {/* Category sidebar */}
        <div className="w-52 border-r border-white/5 pt-10 px-4 shrink-0">
          <h1 className="text-2xl font-bold text-white mb-6 px-2">Settings</h1>
          <nav className="flex flex-col gap-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActive(cat.id)}
                className={`text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active === cat.id ? "bg-white/10 text-white" : "text-[#888] hover:text-white hover:bg-white/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Detail panel */}
        <div className="flex-1 pt-10 px-8 max-w-4xl pb-20">
          {active === "account" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-8">Account</h2>
              <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                    {(displayName?.trim()?.[0] || "A").toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{displayName}</p>
                    <p className="text-[#888] text-sm">Signed in</p>
                  </div>
                </div>
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 text-red-400 hover:text-red-300 font-semibold bg-red-400/10 hover:bg-red-400/20 px-4 py-2.5 rounded-xl text-sm transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {active === "profiles" && <ProfilesSection />}
          {active === "addons" && <AddonsSection />}
          {active === "plugins" && <PluginsSection />}
          {active === "collections" && <CollectionsSection />}
          {active === "integrations" && <IntegrationsSection />}

          {active === "playback" && (
            <div className="mt-2">
              <h2 className="text-2xl font-bold text-white mb-6">Playback</h2>
              <p className="text-[#888] text-sm mb-6">
                Subtitle and player preferences (size, offset, audio language) are available directly in
                the player&apos;s settings panel while watching.
              </p>
              <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5">
                <p className="text-white font-semibold text-sm">External player</p>
                <p className="text-[#888] text-xs mt-1">
                  When playing, use the &quot;Open externally&quot; option to copy the stream link or hand it off to a
                  desktop player (VLC, PotPlayer) via protocol links.
                </p>
              </div>
            </div>
          )}

          {active === "advanced" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-8">Advanced</h2>
              <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
                {[
                  { label: "Clear local cache", desc: "Remove cached addons, plugins, and progress", action: () => { ["nuvio_addons", "nuvio_plugin_repos", "nuvio_collections", "nuvio_cloud_progress"].forEach((k) => localStorage.removeItem(k)); location.reload(); } },
                ].map((item, i, arr) => (
                  <button key={item.label} onClick={item.action} className={`flex items-center justify-between px-5 py-4 w-full text-left hover:bg-white/5 transition-colors ${i < arr.length - 1 ? "border-b border-white/5" : ""}`}>
                    <div>
                      <p className="text-white font-semibold text-sm">{item.label}</p>
                      <p className="text-[#666] text-xs mt-0.5">{item.desc}</p>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-[#555]">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-16 text-center text-[#555] text-xs flex flex-col items-center gap-1">
            <p>Made with ❤️ by Tapframe and friends</p>
            <div className="flex items-center gap-3 mt-2">
              {config.contributionsUrl && (
                <a href={config.contributionsUrl} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Contributions</a>
              )}
              {config.donationsBaseUrl && (
                <a href={config.donationsBaseUrl} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Donate</a>
              )}
            </div>
            <p className="mt-4">Version 1.0.0 (web) · Based on Nuvio 0.2.12</p>
          </div>
        </div>
      </main>
    </div>
  );
}
