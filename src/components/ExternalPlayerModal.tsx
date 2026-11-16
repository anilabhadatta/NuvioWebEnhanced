"use client";

import React, { useState, useEffect } from "react";
import {
  ExternalPlayerId,
  ExternalPlayerMediaMeta,
  EXTERNAL_PLAYER_OPTIONS,
  getClientOS,
  getDefaultExternalPlayer,
  setDefaultExternalPlayer,
  launchExternalPlayer,
  buildMpvCommandLine,
  downloadM3UPlaylist,
} from "@/lib/externalPlayer";

interface ExternalPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  meta: ExternalPlayerMediaMeta;
  onDefaultChanged?: (newDefault: ExternalPlayerId) => void;
}

export default function ExternalPlayerModal({
  isOpen,
  onClose,
  meta,
  onDefaultChanged,
}: ExternalPlayerModalProps) {
  const [defaultPlayer, setDefPlayer] = useState<ExternalPlayerId>("system");
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const clientOS = getClientOS();

  useEffect(() => {
    if (isOpen) {
      setDefPlayer(getDefaultExternalPlayer());
      setStatusMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLaunch = (id: ExternalPlayerId) => {
    const res = launchExternalPlayer(id, meta);
    if (res.success) {
      setStatusMsg(res.message);
      setTimeout(() => {
        onClose();
      }, 900);
    }
  };

  const handleSetDefault = (e: React.MouseEvent, id: ExternalPlayerId) => {
    e.stopPropagation();
    setDefaultExternalPlayer(id);
    setDefPlayer(id);
    if (onDefaultChanged) onDefaultChanged(id);
    setStatusMsg(`Default external player set to ${id === "system" ? "System Default" : id}`);
    setTimeout(() => setStatusMsg(null), 2500);
  };

  const handleCopyUrl = async () => {
    if (!meta.url) return;
    try {
      await navigator.clipboard.writeText(meta.url);
      setCopiedType("url");
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleCopyMpvCmd = async () => {
    if (!meta.url) return;
    try {
      const cmd = buildMpvCommandLine(meta);
      await navigator.clipboard.writeText(cmd);
      setCopiedType("cmd");
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      /* ignore */
    }
  };

  const handleDownloadM3U = () => {
    downloadM3UPlaylist(meta);
    setStatusMsg("Downloaded .m3u playlist file");
    setTimeout(() => setStatusMsg(null), 2500);
  };

  // Format time (e.g. 125 -> 02:05)
  const formatTime = (seconds?: number) => {
    if (!seconds || seconds <= 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const availablePlayers = EXTERNAL_PLAYER_OPTIONS.filter(
    (p) => p.id !== "chooser" && p.supportedOS.includes(clientOS)
  );

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">Open in External Player</h2>
              <p className="text-[#888] text-xs">
                Hand off video stream, timestamp &amp; subtitles to desktop app
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Media Details Summary Bar */}
        <div className="bg-white/[0.02] border-b border-white/5 px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 truncate max-w-[280px]">
            <span className="text-[#666] font-semibold uppercase text-[10px] tracking-wider">Stream:</span>
            <span className="text-white font-medium truncate">{meta.title || "Now Playing"}</span>
          </div>
          <div className="flex items-center gap-3 text-[#aaa]">
            {meta.currentTime && meta.currentTime > 0 ? (
              <span className="flex items-center gap-1 text-orange-400 font-mono">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
                Resume at {formatTime(meta.currentTime)}
              </span>
            ) : null}
            {meta.subtitleUrl ? (
              <span className="text-purple-400 font-medium">Subtitles active</span>
            ) : null}
          </div>
        </div>

        {/* Status Alert if any */}
        {statusMsg && (
          <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-5 py-2 text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            {statusMsg}
          </div>
        )}

        {/* Player Options List */}
        <div className="p-5 flex flex-col gap-2.5 max-h-[340px] overflow-y-auto">
          {availablePlayers.map((p) => {
            const isDefault = defaultPlayer === p.id;
            return (
              <div
                key={p.id}
                onClick={() => handleLaunch(p.id)}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer group ${
                  isDefault
                    ? "bg-white/10 border-orange-500/40 text-white"
                    : "bg-white/5 border-white/5 hover:bg-white/[0.08] text-[#ccc] hover:text-white"
                }`}
              >
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-white group-hover:text-orange-300 transition-colors">
                      {p.name}
                    </span>
                    {isDefault && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-black">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <span className="text-[#888] text-xs mt-0.5">{p.description}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => handleSetDefault(e, p.id)}
                    title={isDefault ? "Currently your default external player" : "Set as default player"}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      isDefault
                        ? "bg-white/10 text-orange-400 border border-orange-500/30"
                        : "bg-white/5 text-[#888] hover:text-white hover:bg-white/10 border border-transparent"
                    }`}
                  >
                    {isDefault ? "Default" : "Make Default"}
                  </button>

                  <div className="w-8 h-8 rounded-lg bg-white/5 group-hover:bg-white/10 flex items-center justify-center text-white/70 group-hover:text-white transition-colors">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Extra Hand-off Actions */}
        <div className="p-5 pt-3 bg-white/[0.02] border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyUrl}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-semibold text-[#ccc] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              {copiedType === "url" ? "Copied Stream URL!" : "Copy URL"}
            </button>

            <button
              onClick={handleCopyMpvCmd}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-semibold text-[#ccc] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Copy terminal command: mpv 'url' --start=... --title=..."
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              {copiedType === "cmd" ? "Copied MPV Command!" : "Copy mpv CLI"}
            </button>

            <button
              onClick={handleDownloadM3U}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-xs font-semibold text-[#ccc] hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Download standard .m3u playlist file"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Save .m3u
            </button>
          </div>

          <p className="text-[11px] text-[#666]">
            Supports Windows, Mac &amp; Linux
          </p>
        </div>
      </div>
    </div>
  );
}
