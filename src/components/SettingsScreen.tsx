"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "./Sidebar";
import { config } from "@/lib/config";

interface Plugin {
  id: string;
  name: string;
  url: string;
  installed: boolean;
  version?: string;
  providers?: any[];
}

const SETTINGS_CATEGORIES = [
  { id: "account", label: "Account" },
  { id: "general", label: "General" },
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

import { fetchUserAddons } from "@/lib/addonService";

export default function SettingsScreen() {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("general");
  const [activeItem, setActiveItem] = useState("plugins");
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [newPluginUrl, setNewPluginUrl] = useState("");
  const [addingPlugin, setAddingPlugin] = useState(false);
  const [addError, setAddError] = useState("");

  React.useEffect(() => {
    const cached = localStorage.getItem("nuvio_plugins");
    if (cached) {
      try {
        setPlugins(JSON.parse(cached));
        return;
      } catch (e) {}
    }
    
    fetchUserAddons().then((addons) => {
      setPlugins(addons.map(a => ({
        id: a.url,
        name: a.name || a.url,
        url: a.url,
        installed: true
      })));
    });
  }, []);

  React.useEffect(() => {
    if (plugins.length > 0) {
      localStorage.setItem("nuvio_plugins", JSON.stringify(plugins));
    }
  }, [plugins]);

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
        version: manifest.version,
        providers: manifest.providers || [],
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
    setPlugins((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      if (updated.length === 0) {
        localStorage.removeItem("nuvio_plugins");
      } else {
        localStorage.setItem("nuvio_plugins", JSON.stringify(updated));
      }
      return updated;
    });
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
                  <h3 className="text-lg font-bold text-white mb-6">Plugins</h3>

                  <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Overview</p>
                  <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-8">
                    <p className="text-xs text-red-400 mb-4">Plugin providers require a TMDB API key. Set it on the TMDB screen or plugin providers will not work correctly.</p>
                    
                    <div className="flex items-center justify-between py-2 border-b border-white/5">
                      <div>
                        <p className="text-white text-sm font-semibold">Enable plugin providers globally</p>
                        <p className="text-[#888] text-xs">Use plugin providers during stream discovery.</p>
                      </div>
                      <div className="w-10 h-6 bg-white/20 rounded-full relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between py-2 pt-4">
                      <div>
                        <p className="text-white text-sm font-semibold">Group plugin providers by repository</p>
                        <p className="text-[#888] text-xs">In Streams, show one provider per repository instead of one per source.</p>
                      </div>
                      <div className="w-10 h-6 bg-white/10 rounded-full relative cursor-pointer opacity-50">
                        <div className="absolute left-1 top-1 w-4 h-4 bg-[#666] rounded-full"></div>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Add Repository</p>
                  <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-8 flex flex-col gap-3">
                    <input
                      type="url"
                      value={newPluginUrl}
                      onChange={(e) => setNewPluginUrl(e.target.value)}
                      placeholder="Plugin manifest URL"
                      className="w-full bg-[#222] border border-white/5 rounded-xl px-4 py-3 text-white placeholder-[#666] outline-none text-sm focus:border-white/20 transition-colors"
                      onKeyDown={(e) => e.key === "Enter" && handleAddPlugin()}
                    />
                    <button
                      onClick={handleAddPlugin}
                      disabled={addingPlugin || !newPluginUrl.trim()}
                      className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {addingPlugin ? "Installing..." : "Install Plugin Repository"}
                    </button>
                    {addError && <p className="text-red-400 text-xs text-center mt-1">{addError}</p>}
                  </div>

                  <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Installed Repositories</p>
                  <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden mb-8">
                    {plugins.length === 0 ? (
                      <div className="p-6">
                        <p className="text-white font-semibold text-sm">No plugin repositories installed yet.</p>
                        <p className="text-[#888] text-xs mt-1">Add a repository URL to install provider plugins for stream discovery.</p>
                      </div>
                    ) : (
                      plugins.map((plugin, i) => {
                        let prettyName = plugin.name || plugin.url;
                        if (prettyName.startsWith("http")) {
                          try {
                            const urlObj = new URL(prettyName);
                            prettyName = urlObj.hostname.replace("www.", "");
                          } catch (e) {}
                        }
                        
                        return (
                          <div
                            key={plugin.id}
                            className={`flex flex-col px-5 py-4 ${
                              i < plugins.length - 1 ? "border-b border-white/5" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1 overflow-hidden pr-4">
                                <p className="text-white font-bold text-xl truncate">{prettyName}</p>
                                {plugin.version && <p className="text-[#888] text-sm mt-1">Version {plugin.version}</p>}
                                <p className="text-[#555] text-xs mt-1 truncate max-w-lg">{plugin.url}</p>
                                
                                {plugin.providers && plugin.providers.length > 0 && (
                                  <div className="mt-3">
                                    <span className="text-xs font-semibold text-white/70 bg-white/10 px-3 py-1.5 rounded-full">
                                      {plugin.providers.length} providers
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1">
                                <button
                                  className="text-[#888] hover:text-white transition-colors"
                                  title="Refresh"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleUninstall(plugin.id)}
                                  className="text-red-400 hover:text-red-300 transition-colors"
                                  title="Uninstall"
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {plugins.some(p => p.providers && p.providers.length > 0) && (
                    <>
                      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Providers</p>
                      <div className="flex flex-col gap-4 mb-8">
                        {plugins.map(plugin => {
                          if (!plugin.providers || plugin.providers.length === 0) return null;
                          return plugin.providers.map((provider, idx) => (
                            <div key={`${plugin.id}-${idx}`} className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex gap-4">
                                  <div className="mt-1 w-6 h-6 text-green-500 shrink-0">
                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M20.5 11h-3V8.5a1.5 1.5 0 00-3 0V11h-1.5V9.5a1.5 1.5 0 00-3 0V11H7a2 2 0 00-2 2v2.5h-1.5a1.5 1.5 0 000 3H5V21a2 2 0 002 2h3v-1.5a1.5 1.5 0 013 0V23h1.5v-1.5a1.5 1.5 0 013 0V23h3a2 2 0 002-2v-2.5h1.5a1.5 1.5 0 000-3H20.5V13z" />
                                    </svg>
                                  </div>
                                  <div>
                                    <p className="text-xs text-white/60 font-semibold mb-0.5">{plugin.name}</p>
                                    <p className="text-white font-bold text-lg">{provider.name}</p>
                                    <p className="text-[#888] text-sm mt-0.5">{provider.description || `${provider.name} direct links`}</p>
                                    <div className="flex items-center gap-2 mt-3">
                                      <span className="text-[10px] font-bold text-white/50 bg-white/5 px-2.5 py-1 rounded-full uppercase tracking-wider">{provider.types?.join(' | ') || 'movie | tv'}</span>
                                      {provider.version && <span className="text-[10px] font-bold text-white/50 bg-white/5 px-2.5 py-1 rounded-full tracking-wider">v{provider.version}</span>}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4">
                                  <button className="text-white/60 hover:text-white transition-colors">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                  </button>
                                  <div className="w-12 h-6 bg-white text-black flex justify-end items-center px-1 rounded-full cursor-pointer">
                                    <div className="w-4 h-4 bg-black rounded-full" />
                                  </div>
                                </div>
                              </div>
                              <button className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[#888] hover:text-white font-semibold transition-colors text-sm">
                                Test Provider
                              </button>
                            </div>
                          ));
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Playback settings section */}
              {activeItem === "playback" && (
                <div className="mt-8">
                  <h3 className="text-lg font-bold text-white mb-6">Playback</h3>
                  
                  <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden mb-8">
                    {[
                      { label: "Preferred Audio Language", value: "Device language", desc: "" },
                      { label: "Secondary Audio Language", value: "None", desc: "" },
                      { label: "Preferred Language", value: "None", desc: "" },
                      { label: "Secondary Preferred Language", value: "None", desc: "" },
                      { label: "Use Forced Subtitles", toggle: true, desc: "Prefer forced subtitles when matching your subtitle language settings." },
                      { label: "Show Only Preferred Languages", toggle: true, desc: "Only show subtitles matching your preferred subtitle languages." },
                      { label: "Addon Subtitle Startup", value: "All subtitles", desc: "" },
                    ].map((item, i, arr) => (
                      <div key={item.label} className={`flex items-center justify-between px-5 py-4 ${i < arr.length - 1 ? "border-b border-white/5" : ""}`}>
                        <div>
                          <p className="text-white font-semibold text-sm">{item.label}</p>
                          {item.value && item.desc === "" && <p className="text-[#666] text-xs mt-0.5">{item.value}</p>}
                          {item.desc && <p className="text-[#666] text-xs mt-0.5">{item.desc}</p>}
                        </div>
                        {item.toggle && (
                          <div className="w-10 h-6 bg-white/10 rounded-full relative cursor-pointer">
                            <div className="absolute left-1 top-1 w-4 h-4 bg-[#666] rounded-full"></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Subtitle Rendering</p>
                  <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
                    
                    <div className="px-5 py-4 border-b border-white/5">
                      <div className="flex justify-between mb-2">
                        <p className="text-white font-semibold text-sm">Subtitle Size</p>
                        <p className="text-white font-bold text-sm">18sp</p>
                      </div>
                      <input type="range" min="10" max="30" defaultValue="18" className="w-full accent-white" />
                    </div>

                    <div className="px-5 py-4 border-b border-white/5">
                      <div className="flex justify-between mb-2">
                        <p className="text-white font-semibold text-sm">Vertical Offset</p>
                        <p className="text-white font-bold text-sm">20</p>
                      </div>
                      <input type="range" min="0" max="100" defaultValue="20" className="w-full accent-white" />
                    </div>

                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                      <div>
                        <p className="text-white font-semibold text-sm">Bold</p>
                        <p className="text-[#666] text-xs mt-0.5">Use a heavier subtitle font weight.</p>
                      </div>
                      <div className="w-10 h-6 bg-white/10 rounded-full relative cursor-pointer">
                        <div className="absolute left-1 top-1 w-4 h-4 bg-[#666] rounded-full"></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                      <div>
                        <p className="text-white font-semibold text-sm">Text Color</p>
                        <p className="text-[#666] text-xs mt-0.5">#FFFFD700</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                      <div>
                        <p className="text-white font-semibold text-sm">Background Color</p>
                        <p className="text-[#666] text-xs mt-0.5">Transparent</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                      <div>
                        <p className="text-white font-semibold text-sm">Outline</p>
                        <p className="text-[#666] text-xs mt-0.5">Draw a border around subtitle text.</p>
                      </div>
                      <div className="w-10 h-6 bg-white/10 rounded-full relative cursor-pointer">
                        <div className="absolute left-1 top-1 w-4 h-4 bg-[#666] rounded-full"></div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                      <div>
                        <p className="text-white font-semibold text-sm">Shadow</p>
                        <p className="text-[#666] text-xs mt-0.5">Draw a drop shadow behind subtitle text.</p>
                      </div>
                      <div className="w-10 h-6 bg-white/20 rounded-full relative cursor-pointer">
                        <div className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Footer - matches NuvioDesktop screenshot */}
              <div className="mt-16 text-center text-[#555] text-xs pb-12 flex flex-col items-center gap-1">
                <p>Made with ❤️ by Tapframe and friends</p>
                <div className="flex items-center gap-3 mt-2">
                  {config.contributionsUrl && (
                    <a href={config.contributionsUrl} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Contributions</a>
                  )}
                  {config.donationsBaseUrl && (
                    <a href={config.donationsBaseUrl} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">Donate</a>
                  )}
                </div>
                <p className="mt-4">Version 1.0.0 (web)</p>
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
