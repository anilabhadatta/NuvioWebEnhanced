"use client";

import React, { useEffect, useState } from "react";
import {
  ManagedAddon,
  fetchAddons,
  addAddon,
  removeAddon,
  toggleAddon,
  refreshAllAddons,
  pushAddons,
} from "@/lib/addons";

function prettyName(name: string): string {
  if (name.startsWith("http")) {
    try {
      return new URL(name).hostname.replace("www.", "");
    } catch { /* ignore */ }
  }
  return name;
}

export default function AddonsSection() {
  const [addons, setAddons] = useState<ManagedAddon[]>([]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAddons().then(setAddons);
  }, []);

  const handleAdd = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError("");
    const res = await addAddon(url, addons);
    if (res.ok) {
      setAddons((prev) => [...prev, res.addon!]);
      setUrl("");
    } else {
      setError(res.error || "Failed to add addon.");
    }
    setBusy(false);
  };

  const handleRemove = async (u: string) => {
    setAddons(await removeAddon(u, addons));
  };

  const handleToggle = async (u: string) => {
    setAddons(await toggleAddon(u, addons));
  };

  const handleRefreshAll = async () => {
    setRefreshing(true);
    const refreshed = await refreshAllAddons(addons);
    setAddons(refreshed);
    await pushAddons(refreshed);
    setRefreshing(false);
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white">Addons</h3>
        <button
          onClick={handleRefreshAll}
          disabled={refreshing}
          className="flex items-center gap-2 text-sm font-semibold text-[#aaa] hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? "Syncing…" : "Refresh all"}
        </button>
      </div>

      <p className="text-xs text-[#888] mb-5">
        An Addon is a single Stremio addon (catalogs, streams, subtitles). For repositories of
        scrapers, use the Plugins section instead.
      </p>

      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Add Addon</p>
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-5 mb-8 flex flex-col gap-3">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://addon.example/manifest.json"
          className="w-full bg-[#222] border border-white/5 rounded-xl px-4 py-3 text-white placeholder-[#666] outline-none text-sm focus:border-white/20 transition-colors"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={busy || !url.trim()}
          className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? "Installing…" : "Install Addon"}
        </button>
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
      </div>

      <p className="text-xs font-bold text-[#666] uppercase tracking-widest mb-3">Installed Addons</p>
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
        {addons.length === 0 ? (
          <div className="p-6">
            <p className="text-white font-semibold text-sm">No addons installed.</p>
            <p className="text-[#888] text-xs mt-1">Add a manifest URL above to install your first addon.</p>
          </div>
        ) : (
          addons.map((a, i) => (
            <div key={a.url} className={`flex items-center gap-4 px-5 py-4 ${i < addons.length - 1 ? "border-b border-white/5" : ""}`}>
              <div className="flex-1 overflow-hidden">
                <p className="text-white font-semibold text-sm truncate">{prettyName(a.name)}</p>
                <p className="text-[#555] text-xs mt-0.5 truncate">{a.url}</p>
                {a.errorMessage && <p className="text-red-400 text-xs mt-0.5">{a.errorMessage}</p>}
              </div>
              <button
                onClick={() => handleToggle(a.url)}
                className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${a.enabled ? "bg-white" : "bg-white/15"}`}
                title={a.enabled ? "Enabled" : "Disabled"}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${a.enabled ? "right-1 bg-black" : "left-1 bg-[#888]"}`} />
              </button>
              <button onClick={() => handleRemove(a.url)} className="text-red-400 hover:text-red-300 transition-colors shrink-0" title="Remove">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
