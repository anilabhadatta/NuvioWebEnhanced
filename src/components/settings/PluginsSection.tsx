"use client";

import React, { useEffect, useState } from "react";
import {
  PluginRepository,
  fetchPlugins,
  addPluginRepo,
  removePluginRepo,
  togglePluginRepo,
  refreshPluginRepo,
} from "@/lib/plugins";

export default function PluginsSection() {
  const [repos, setRepos] = useState<PluginRepository[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchPlugins().then(setRepos);
  }, []);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    const res = await addPluginRepo(url, repos);
    if (res.ok) {
      setRepos((prev) => [...prev, res.repo!]);
      setUrl("");
    } else {
      setError(res.error || "Failed to add repository.");
    }
    setBusy(false);
  };

  const handleRemove = async (u: string) => setRepos(await removePluginRepo(u, repos));
  const handleToggle = async (u: string) => setRepos(await togglePluginRepo(u, repos));
  const handleRefresh = async (u: string) => setRepos(await refreshPluginRepo(u, repos));

  return (
    <div className="mt-8">
      <h3 className="text-lg font-bold text-white mb-2">Plugins</h3>
      <p className="text-xs text-[#888] mb-5">
        A Plugin is a repository of scrapers. Each repository can provide many scraper sources used
        during stream discovery. Plugin scrapers require a TMDB API key (set it under Integrations).
      </p>

      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Add Repository</p>
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-8 flex flex-col gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://repo.example/manifest.json"
          className="w-full bg-[#222] border border-white/5 rounded-xl px-4 py-3 text-white placeholder-[#666] outline-none text-sm focus:border-white/20 transition-colors"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !url.trim()}
          className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Installing…" : "Install Plugin Repository"}
        </button>
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
      </div>

      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Installed Repositories</p>
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
        {repos.length === 0 ? (
          <div className="p-6">
            <p className="text-white font-semibold text-sm">No plugin repositories installed.</p>
            <p className="text-[#888] text-xs mt-1">Add a repository manifest URL to install scraper plugins.</p>
          </div>
        ) : (
          repos.map((r, i) => (
            <div key={r.url} className={`px-5 py-4 ${i < repos.length - 1 ? "border-b border-white/5" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 overflow-hidden">
                  <p className="text-white font-bold text-base truncate">{r.name}</p>
                  {r.version && <p className="text-[#888] text-xs mt-0.5">Version {r.version}{r.author ? ` · ${r.author}` : ""}</p>}
                  <p className="text-[#555] text-xs mt-0.5 truncate">{r.url}</p>
                  {r.scraperCount > 0 && (
                    <span className="inline-block mt-2 text-xs font-semibold text-white/70 bg-white/10 px-3 py-1 rounded-full">
                      {r.scraperCount} scraper{r.scraperCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {r.errorMessage && <p className="text-red-400 text-xs mt-1">{r.errorMessage}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button onClick={() => handleToggle(r.url)} className={`w-11 h-6 rounded-full relative transition-colors ${r.enabled ? "bg-white" : "bg-white/15"}`} title={r.enabled ? "Enabled" : "Disabled"}>
                    <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${r.enabled ? "right-1 bg-black" : "left-1 bg-[#888]"}`} />
                  </button>
                  <button onClick={() => handleRefresh(r.url)} className="text-[#888] hover:text-white transition-colors" title="Refresh">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <button onClick={() => handleRemove(r.url)} className="text-red-400 hover:text-red-300 transition-colors" title="Uninstall">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {r.scrapers.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.scrapers.map((s) => (
                    <span key={s.id} className="text-[11px] text-[#aaa] bg-white/5 px-2.5 py-1 rounded-full">
                      {s.name}{s.version ? ` v${s.version}` : ""}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
