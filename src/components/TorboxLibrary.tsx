"use client";

import React, { useEffect, useState } from "react";
import {
  TorboxItem,
  getTorboxApiKey,
  listTorboxTorrents,
  getTorboxTorrent,
  requestTorboxLink,
  isPlayableFile,
} from "@/lib/torbox";

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}

export default function TorboxLibrary() {
  const [apiKey, setApiKey] = useState("");
  const [items, setItems] = useState<TorboxItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [expandedItem, setExpandedItem] = useState<TorboxItem | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const load = async (key: string) => {
    setLoading(true);
    setError(null);
    try {
      const torrents = await listTorboxTorrents(key);
      setItems(torrents);
      if (torrents.length === 0) setError("No items found in your TorBox library.");
    } catch {
      setError("Could not reach TorBox. The browser may be blocking the request (CORS).");
    }
    setLoading(false);
  };

  useEffect(() => {
    const key = getTorboxApiKey();
    setApiKey(key);
    if (key) load(key);
  }, []);

  const openItem = async (item: TorboxItem) => {
    if (expanded === item.id) {
      setExpanded(null);
      setExpandedItem(null);
      return;
    }
    setExpanded(item.id);
    if (item.files.length > 0) {
      setExpandedItem(item);
    } else {
      const full = await getTorboxTorrent(apiKey, item.id);
      setExpandedItem(full || item);
    }
  };

  const playFile = async (item: TorboxItem, fileId: number) => {
    setResolving(`${item.id}:${fileId}`);
    const link = await requestTorboxLink(apiKey, item.id, fileId);
    setResolving(null);
    if (link) {
      window.location.href = `/player?id=torbox_${item.id}_${fileId}&type=movie&url=${encodeURIComponent(link)}`;
    } else {
      setError("Could not resolve a download link for this file.");
    }
  };

  if (!apiKey) {
    return (
      <div className="bg-[#1a1a1a] border border-white/5 rounded-2xl p-6">
        <p className="text-white font-semibold text-sm mb-1">TorBox not connected</p>
        <p className="text-[#888] text-xs">
          Add your TorBox API key under Settings → Integrations to browse your cloud library here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white">TorBox Library</h2>
        <button
          onClick={() => load(apiKey)}
          disabled={loading}
          className="flex items-center gap-2 text-sm font-semibold text-[#aaa] hover:text-white bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {error && <p className="text-[#888] text-sm mb-4">{error}</p>}

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={item.id} className="bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden">
            <button onClick={() => openItem(item)} className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/5 transition-colors">
              <div className="flex-1 overflow-hidden">
                <p className="text-white font-semibold text-sm truncate">{item.name}</p>
                <p className="text-[#888] text-xs mt-0.5">
                  {formatSize(item.size)}
                  {item.download_state ? ` · ${item.download_state}` : ""}
                  {item.cached ? " · cached" : ""}
                </p>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-4 h-4 text-[#555] transition-transform ${expanded === item.id ? "rotate-90" : ""}`}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>

            {expanded === item.id && expandedItem && (
              <div className="border-t border-white/5 divide-y divide-white/5">
                {expandedItem.files.filter((f) => isPlayableFile(f.name)).length === 0 ? (
                  <p className="px-5 py-3 text-[#888] text-xs">No playable files in this item.</p>
                ) : (
                  expandedItem.files.filter((f) => isPlayableFile(f.name)).map((file) => (
                    <button
                      key={file.id}
                      onClick={() => playFile(expandedItem, file.id)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-white/5 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-white/70 shrink-0"><path d="M8 5v14l11-7z" /></svg>
                      <span className="flex-1 text-[#ddd] text-xs truncate">{file.name}</span>
                      {resolving === `${expandedItem.id}:${file.id}` ? (
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <span className="text-[#666] text-xs">{formatSize(file.size)}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
