"use client";

import React, { useState, useEffect } from "react";
import { TMDBMovie } from "@/lib/tmdb";
import { NuvioAddon, StreamItem, fetchUserAddons, fetchStreamsFromAddon } from "@/lib/addonService";

interface StreamPickerModalProps {
  movie: TMDBMovie;
  season?: number;
  episode?: number;
  onClose: () => void;
  onPlayStream: (stream: StreamItem) => void;
}

export default function StreamPickerModal({ movie, season, episode, onClose, onPlayStream }: StreamPickerModalProps) {
  const [addons, setAddons] = useState<NuvioAddon[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);

  const title = movie.title || movie.name;
  const isSeries = movie.media_type === "tv" || !!season;
  
  // Format the ID for addons
  // Movies: ttXXXXXX
  // Series: ttXXXXXX:season:episode
  // TMDB API gives us TMDB ID, but many addons require IMDB ID.
  // For simplicity, we will pass the ID. We should ideally fetch the external IDs to get IMDB ID,
  // but let's assume we pass the tmdb prefix or imdb id if available.
  const tmdbPrefixId = `tmdb:${movie.id}`;
  const videoId = isSeries ? `${tmdbPrefixId}:${season}:${episode}` : tmdbPrefixId;
  const type = isSeries ? "series" : "movie";

  useEffect(() => {
    async function loadStreams() {
      setLoading(true);
      const userAddons = await fetchUserAddons();
      setAddons(userAddons);

      const allStreams: StreamItem[] = [];
      const fetchPromises = userAddons
        .filter(a => a.enabled)
        .map(async (addon) => {
          const addonStreams = await fetchStreamsFromAddon(addon, type, videoId);
          if (addonStreams.length > 0) {
            setStreams(prev => [...prev, ...addonStreams]);
          }
        });

      await Promise.all(fetchPromises);
      setLoading(false);
    }
    loadStreams();
  }, [videoId, type]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="slide-up relative bg-[#1a1a1a] rounded-2xl overflow-hidden w-full max-w-xl max-h-[80vh] flex flex-col shadow-2xl border border-white/10">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-white">Select Stream</h2>
            <p className="text-[#888] text-sm mt-1">
              {title} {isSeries && season && episode ? `- S${season} E${episode}` : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading && streams.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-[#888] text-sm">Searching addons for streams...</p>
            </div>
          ) : streams.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-white font-semibold mb-2">No streams found</p>
              <p className="text-[#888] text-sm">We couldn't find any streams for this content. Check your installed addons in Settings.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {streams.map((stream, idx) => (
                <button
                  key={idx}
                  onClick={() => onPlayStream(stream)}
                  className="w-full bg-[#222] hover:bg-[#333] border border-white/5 rounded-xl p-4 text-left transition-colors group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-white font-semibold text-sm line-clamp-1">{stream.title || stream.name || "Unknown Stream"}</span>
                    <span className="text-xs bg-white/10 text-[#aaa] px-2 py-1 rounded whitespace-nowrap ml-2">
                      {stream.addonName}
                    </span>
                  </div>
                  {stream.description && (
                    <p className="text-[#888] text-xs line-clamp-2">{stream.description}</p>
                  )}
                </button>
              ))}
              
              {loading && (
                <div className="py-4 text-center">
                  <span className="text-[#666] text-xs flex items-center justify-center gap-2">
                    <div className="w-3 h-3 border-2 border-[#666] border-t-[#ccc] rounded-full animate-spin" />
                    Still searching remaining addons...
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
