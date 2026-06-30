"use client";

import React, { useState, useEffect } from "react";
import { TMDBMovie, fetchExternalIds, resolveStremioIdToMovie } from "@/lib/tmdb";
import { NuvioAddon, StreamItem, fetchUserAddons, fetchStreamsFromAddon } from "@/lib/addonService";

interface StreamPickerModalProps {
  tmdbId: number;
  type: string;
  season?: number;
  episode?: number;
  onClose: () => void;
  onPlayStream: (stream: StreamItem) => void;
}

export default function StreamPickerModal({ tmdbId, type: mediaType, season, episode, onClose, onPlayStream }: StreamPickerModalProps) {
  const [addons, setAddons] = useState<NuvioAddon[]>([]);
  const [streams, setStreams] = useState<StreamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAddonFilter, setSelectedAddonFilter] = useState<string>("All");
  const [movieData, setMovieData] = useState<TMDBMovie | null>(null);

  const isSeries = mediaType === "tv" || mediaType === "series" || !!season;
  
  // Format the ID for addons
  // Movies: ttXXXXXX

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setStreams([]);
    setError(null);

    async function loadStreams() {
      try {
        const type = isSeries ? "tv" : "movie";
        
        // Fetch metadata so we can display the title in the header
        resolveStremioIdToMovie(`tmdb:${tmdbId}`, type).then((meta) => {
          if (isMounted && meta) setMovieData(meta);
        }).catch(() => {});

        const addons = await fetchUserAddons();
        if (!addons || addons.length === 0) {
          if (isMounted) setError("No addons installed.");
          return;
        }

        // Fetch IMDB ID for proper addon compatibility (many addons only support ttXXXXXX)
        let imdbId = null;
        try {
          const externalIds = await fetchExternalIds(tmdbId, type);
          if (externalIds && externalIds.imdb_id) {
            imdbId = externalIds.imdb_id;
          }
        } catch (e) {
          console.error("Failed to fetch IMDB ID", e);
        }

        const baseId = imdbId ? imdbId : "tmdb:" + tmdbId;
        const videoId = isSeries ? `${baseId}:${season}:${episode}` : baseId;
        const addonMediaType = isSeries ? "series" : "movie";

        const promises = addons.map((addon) =>
          fetchStreamsFromAddon(addon, addonMediaType, videoId)
            .then((res) => {
              if (isMounted && res && res.length > 0) {
                setStreams((prev) => [...prev, ...res]);
              }
            })
            .catch(() => []) // Ignore failed addons
        );

        await Promise.all(promises);

        if (isMounted) {
          setLoading(false);
          setStreams((prev) => {
            if (prev.length === 0) setError("No streams found.");
            return prev;
          });
        }
      } catch (err: any) {
        if (isMounted) {
          setError("Error loading streams.");
          setLoading(false);
        }
      }
    }

    loadStreams();

    return () => { isMounted = false; };
  }, [tmdbId, isSeries, season, episode]);

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
            <h2 className="text-xl font-bold text-white line-clamp-1">{movieData ? movieData.title || movieData.name : "Select Stream"}</h2>
            <p className="text-[#888] text-sm mt-1">
              {movieData 
                ? (isSeries && season && episode ? `S${season} E${episode}` : (movieData.release_date || movieData.first_air_date || "").split("-")[0]) 
                : "Stream Selection" + (isSeries && season && episode ? ` - S${season} E${episode}` : "")}
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
            <div className="flex flex-col gap-4">
              {/* Filter Chips */}
              {streams.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  <button
                    onClick={() => setSelectedAddonFilter("All")}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      selectedAddonFilter === "All" ? "bg-white text-black" : "bg-white/10 text-[#aaa] hover:bg-white/20"
                    }`}
                  >
                    All
                  </button>
                  {Array.from(new Set(streams.map((s) => s.addonName))).filter(Boolean).map((addonName) => (
                    <button
                      key={addonName}
                      onClick={() => setSelectedAddonFilter(addonName as string)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                        selectedAddonFilter === addonName ? "bg-white text-black" : "bg-white/10 text-[#aaa] hover:bg-white/20"
                      }`}
                    >
                      {addonName}
                    </button>
                  ))}
                  {loading && (
                    <div className="ml-2 w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" title="Searching for more..." />
                  )}
                </div>
              )}

              {/* Streams List */}
              <div className="flex flex-col gap-3">
                {streams
                  .filter((s) => selectedAddonFilter === "All" || s.addonName === selectedAddonFilter)
                  .map((stream, idx) => (
                    <button
                      key={idx}
                      onClick={() => onPlayStream(stream)}
                      className="w-full bg-[#222] hover:bg-[#333] border border-white/5 rounded-xl p-4 text-left transition-colors group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-white font-semibold text-sm line-clamp-1">
                          {stream.title || stream.name || "Unknown Stream"}
                        </span>
                        <span className="text-xs bg-white/10 text-[#aaa] px-2 py-1 rounded whitespace-nowrap ml-2">
                          {stream.addonName}
                        </span>
                      </div>
                      {stream.description && (
                        <p className="text-[#888] text-xs line-clamp-2">{stream.description}</p>
                      )}
                    </button>
                  ))}
              </div>
              
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
