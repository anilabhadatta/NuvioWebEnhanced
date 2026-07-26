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
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

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

  const handleCopyUrl = async (addonUrl: string) => {
    try {
      await navigator.clipboard.writeText(addonUrl);
      setCopiedUrl(addonUrl);
      setTimeout(() => {
        setCopiedUrl((prev) => (prev === addonUrl ? null : prev));
      }, 1500);
    } catch {
      setError("Failed to copy URL.");
    }
  };

  const handleOpenAddon = (addonUrl: string) => {
    window.open(addonUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h3 className="text-lg font-bold text-white">Addons</h3>
        <button
          onClick={handleRefreshAll}
          disabled={refreshing}
          className="w-full sm:w-auto flex items-center justify-center gap-2 text-sm font-semibold text-[#aaa] hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
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
            <div key={a.url} className={`px-5 py-4 ${i < addons.length - 1 ? "border-b border-white/5" : ""}`}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex-1 min-w-0 overflow-hidden">
                <p className="text-white font-semibold text-sm truncate">{prettyName(a.name)}</p>
                <p className="text-[#555] text-xs mt-0.5 break-all sm:truncate">{a.url}</p>
                {a.errorMessage && <p className="text-red-400 text-xs mt-0.5">{a.errorMessage}</p>}
                </div>
                <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => handleCopyUrl(a.url)}
                    className="w-9 h-9 flex items-center justify-center text-[#aaa] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    title="Copy URL"
                    aria-label="Copy URL"
                  >
                    {copiedUrl === a.url ? (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4 text-emerald-300">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenAddon(a.url)}
                    className="w-9 h-9 flex items-center justify-center text-[#aaa] hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                    title="Open addon URL"
                    aria-label="Open addon URL"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5A3.5 3.5 0 1115.5 12" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1 .6 1.65 1.65 0 01-2 0 1.65 1.65 0 00-1-.6 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-.6-1 1.65 1.65 0 010-2 1.65 1.65 0 00.6-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-.6 1.65 1.65 0 012 0 1.65 1.65 0 001 .6 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.24.31.43.65.55 1" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 4v6m0 0h-6m6 0l-8 8" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleToggle(a.url)}
                    className={`w-11 h-6 rounded-full relative transition-colors ${a.enabled ? "bg-white" : "bg-white/15"}`}
                    title={a.enabled ? "Enabled" : "Disabled"}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full transition-all ${a.enabled ? "right-1 bg-black" : "left-1 bg-[#888]"}`} />
                  </button>
                  <button onClick={() => handleRemove(a.url)} className="text-red-400 hover:text-red-300 transition-colors" title="Remove">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
