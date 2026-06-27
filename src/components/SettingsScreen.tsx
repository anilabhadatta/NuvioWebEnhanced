"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "./Sidebar";

interface Plugin {
  id: string;
  name: string;
  url: string;
  installed: boolean;
}

const SETTINGS_CATEGORIES = [
  { id: "account", label: "Account" },
  { id: "general", label: "General" },
  { id: "player", label: "Player" },
  { id: "advanced", label: "Advanced" },
];

const GENERAL_ITEMS = [
  {
    id: "layout",
    icon: "🎨",
    title: "Layout",
    subtitle: "Home, streams, collections, and detail pages",
  },
  {
    id: "plugins",
    icon: "🧩",
    title: "Content & Discovery",
    subtitle: "Manage addons and discovery sources.",
  },
  {
    id: "downloads",
    icon: "⬇️",
    title: "Downloads",
    subtitle: "Manage your downloaded movies and episodes.",
  },
  {
    id: "playback",
    icon: "▶️",
    title: "Playback",
    subtitle: "Player, subtitles, and auto-play",
  },
  {
    id: "integrations",
    icon: "🔗",
    title: "Integrations",
    subtitle: "Manage available integrations",
  },
];

const INITIAL_PLUGINS: Plugin[] = [
  { id: "cinemeta-movie", name: "Cinemeta (Movies)", url: "https://v3-cinemeta.strem.io/manifest.json", installed: true },
  { id: "cinemeta-series", name: "Cinemeta (Series)", url: "https://v3-cinemeta.strem.io/manifest.json", installed: true },
  { id: "opensubtitles", name: "OpenSubtitles v3", url: "https://opensubtitles-v3.strem.io/manifest.json", installed: true },
];

export default function SettingsScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("general");
  const [activeItem, setActiveItem] = useState("plugins");
  const [plugins, setPlugins] = useState<Plugin[]>(INITIAL_PLUGINS);
  const [newPluginUrl, setNewPluginUrl] = useState("");
  const [addingPlugin, setAddingPlugin] = useState(false);
  const [addError, setAddError] = useState("");

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("nuvio_anon");
    router.push("/");
  };

  const handleAddPlugin = async () => {
    if (!newPluginUrl.trim()) return;
    setAddingPlugin(true);
    setAddError("");
    try {
      const res = await fetch(newPluginUrl.trim());
      if (!res.ok) throw new Error("Cannot reach manifest URL");
      const manifest = await res.json();
      const newPlugin: Plugin = {
        id: manifest.id || Date.now().toString(),
        name: manifest.name || newPluginUrl,
        url: newPluginUrl.trim(),
        installed: true,
      };
      setPlugins((prev) => [...prev, newPlugin]);
      setNewPluginUrl("");
    } catch (e: any) {
      setAddError("Failed to fetch manifest. Check the URL.");
    } finally {
      setAddingPlugin(false);
    }
  };

  const handleUninstall = (id: string) => {
    setPlugins((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="flex min-h-screen bg-[#111111]">
      <Sidebar />

      {/* Settings content - matches NuvioDesktop screenshot layout */}
      <main className="flex-1 ml-[220px] flex">
        {/* Category sidebar */}
        <div className="w-52 border-r border-white/5 pt-10 px-4 shrink-0">
          <h1 className="text-2xl font-bold text-white mb-6 px-2">Settings</h1>
          <nav className="flex flex-col gap-1">
            {SETTINGS_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  activeCategory === cat.id
                    ? "bg-white/10 text-white"
                    : "text-[#888] hover:text-white hover:bg-white/5"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Detail panel */}
        <div className="flex-1 pt-10 px-8 max-w-4xl">
          {activeCategory === "general" && (
            <>
              <h2 className="text-2xl font-bold text-white mb-2">General</h2>
              <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-5">General</p>

              {/* Settings items list - exactly like NuvioDesktop screenshot */}
              <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-white/5">
                {GENERAL_ITEMS.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveItem(item.id)}
                    className={`flex items-center gap-4 w-full px-5 py-4 text-left transition-colors ${
                      i < GENERAL_ITEMS.length - 1 ? "border-b border-white/5" : ""
                    } ${activeItem === item.id ? "bg-white/5" : "hover:bg-white/5"}`}
                  >
                    <span className="text-2xl w-10 h-10 flex items-center justify-center bg-[#222] rounded-xl shrink-0">
                      {item.icon}
                    </span>
                    <div>
                      <p className="text-white font-semibold text-sm">{item.title}</p>
                      <p className="text-[#888] text-xs mt-0.5">{item.subtitle}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Plugins section appears when Content & Discovery is active */}
              {activeItem === "plugins" && (
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-white mb-4">Plugins & Addons</h3>

                  {/* Add plugin */}
                  <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-4">
                    <p className="text-sm font-semibold text-[#aaa] mb-3">Add via Manifest URL</p>
                    <div className="flex gap-3">
                      <input
                        type="url"
                        value={newPluginUrl}
                        onChange={(e) => setNewPluginUrl(e.target.value)}
                        placeholder="https://your-addon.com/manifest.json"
                        className="flex-1 bg-[#111] border border-white/10 focus:border-white/30 rounded-xl px-4 py-2.5 text-white placeholder-[#555] outline-none text-sm transition-colors"
                        onKeyDown={(e) => e.key === "Enter" && handleAddPlugin()}
                      />
                      <button
                        onClick={handleAddPlugin}
                        disabled={addingPlugin || !newPluginUrl.trim()}
                        className="bg-white hover:bg-gray-200 text-black font-bold px-5 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 flex items-center gap-2"
                      >
                        {addingPlugin ? (
                          <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                        ) : (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        )}
                        Install
                      </button>
                    </div>
                    {addError && (
                      <p className="text-red-400 text-xs mt-2">{addError}</p>
                    )}
                  </div>

                  {/* Installed plugins */}
                  <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
                    {plugins.length === 0 ? (
                      <p className="text-[#666] text-sm text-center py-10">No plugins installed</p>
                    ) : (
                      plugins.map((plugin, i) => (
                        <div
                          key={plugin.id}
                          className={`flex items-center justify-between px-5 py-4 ${
                            i < plugins.length - 1 ? "border-b border-white/5" : ""
                          }`}
                        >
                          <div>
                            <p className="text-white font-semibold text-sm">{plugin.name}</p>
                            <p className="text-[#555] text-xs mt-0.5 truncate max-w-sm">{plugin.url}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-green-400 font-semibold bg-green-400/10 px-2 py-1 rounded-full">
                              Active
                            </span>
                            <button
                              onClick={() => handleUninstall(plugin.id)}
                              className="text-xs text-red-400 hover:text-red-300 font-semibold bg-red-400/10 hover:bg-red-400/20 px-3 py-1 rounded-full transition-colors"
                            >
                              Uninstall
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Footer - matches NuvioDesktop screenshot */}
              <div className="mt-16 text-center text-[#555] text-xs pb-12">
                <p>Made with ❤️ by Tapframe and friends</p>
                <p className="mt-1">Version 1.0.0 (web)</p>
                <p>Based on Nuvio 0.2.12</p>
              </div>
            </>
          )}

          {activeCategory === "account" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-8">Account</h2>
              <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                    A
                  </div>
                  <div>
                    <p className="text-white font-semibold">Anilabha</p>
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

          {activeCategory === "player" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-8">Player</h2>
              <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
                {[
                  { label: "Preferred Audio Language", value: "English", desc: "Select default audio track" },
                  { label: "Subtitle Language", value: "Off", desc: "Select default subtitle track" },
                  { label: "Auto-play Next Episode", value: "On", desc: "Automatically plays next episode after countdown" },
                  { label: "Skip Intro", value: "On", desc: "Show skip intro button when detected" },
                  { label: "Video Quality", value: "Auto", desc: "Preferred stream quality" },
                ].map((item, i, arr) => (
                  <div key={item.label} className={`flex items-center justify-between px-5 py-4 ${i < arr.length - 1 ? "border-b border-white/5" : ""}`}>
                    <div>
                      <p className="text-white font-semibold text-sm">{item.label}</p>
                      <p className="text-[#666] text-xs mt-0.5">{item.desc}</p>
                    </div>
                    <span className="text-[#aaa] text-sm font-medium bg-white/5 px-3 py-1.5 rounded-lg">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeCategory === "advanced" && (
            <div>
              <h2 className="text-2xl font-bold text-white mb-8">Advanced</h2>
              <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
                {[
                  { label: "Cache Management", desc: "Clear cached data and thumbnails" },
                  { label: "Debug Logs", desc: "Enable verbose logging for troubleshooting" },
                  { label: "Reset Settings", desc: "Restore all settings to defaults" },
                ].map((item, i, arr) => (
                  <button key={item.label} className={`flex items-center justify-between px-5 py-4 w-full text-left hover:bg-white/5 transition-colors ${i < arr.length - 1 ? "border-b border-white/5" : ""}`}>
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
        </div>
      </main>
    </div>
  );
}
