"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getWatchProgress, WatchProgress } from "@/lib/watchProgress";
import { TMDB_IMAGE_W500, resolveStremioIdToMovie } from "@/lib/tmdb";
import StreamPickerModal from "./StreamPickerModal";
import { StreamItem } from "@/lib/addonService";

let isHydrated = false;
let cachedEnrichedItems: any[] = [];
const tmdbResolutionCache = new Map<string, any>();

function getInitialProgress(): WatchProgress[] {
  if (typeof window === "undefined") return [];
  try {
    // 1. Get local progress
    const local = getWatchProgress();

    // 2. Get cloud progress
    let cloudData: any[] = [];
    const cloudStr = localStorage.getItem("nuvio_cloud_progress");
    if (cloudStr) cloudData = JSON.parse(cloudStr);

    const cloudProgress: WatchProgress[] = cloudData.map((c: any) => ({
      id: c.content_id,
      type: c.content_type === "series" ? "tv" : c.content_type,
      title: "Stream",
      poster: "",
      season: c.season || undefined,
      episode: c.episode || undefined,
      currentTime: c.position / 1000,
      duration: c.duration / 1000,
      updatedAt: c.last_watched
    }));

    const allProgress = [...local, ...cloudProgress];

    const getWeight = (p: any) => {
      if (p.season !== undefined && p.episode !== undefined) {
        return p.season * 10000 + p.episode;
      }
      return p.updatedAt;
    };

    const uniqueMap = new Map<string, WatchProgress>();
    for (const p of allProgress) {
      const idStr = String(p.id);
      if (!uniqueMap.has(idStr)) {
        uniqueMap.set(idStr, p);
      } else {
        const existing = uniqueMap.get(idStr)!;
        if (getWeight(p) > getWeight(existing)) {
          uniqueMap.set(idStr, p);
        }
      }
    }

    const uniqueProgress = Array.from(uniqueMap.values());
    uniqueProgress.sort((a, b) => b.updatedAt - a.updatedAt);
    return uniqueProgress;
  } catch {
    return [];
  }
}

export default function ContinueWatchingRow({ first }: { first?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<WatchProgress[]>(() => {
    if (typeof window !== "undefined" && isHydrated) {
      return getInitialProgress();
    }
    return [];
  });
  const [enrichedItems, setEnrichedItems] = useState<any[]>(() => {
    if (typeof window !== "undefined" && isHydrated) {
      return cachedEnrichedItems;
    }
    return [];
  });
  const [picker, setPicker] = useState<WatchProgress | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isHydrated = true;
    // 1. Get local progress
    const local = getWatchProgress();

    // 2. Get cloud progress
    let cloudData: any[] = [];
    try {
      const cloudStr = localStorage.getItem("nuvio_cloud_progress");
      if (cloudStr) cloudData = JSON.parse(cloudStr);
    } catch (e) { }

    const cloudProgress: WatchProgress[] = cloudData.map((c: any) => ({
      id: c.content_id,
      type: c.content_type === "series" ? "tv" : c.content_type,
      title: "Stream",
      poster: "",
      season: c.season || undefined,
      episode: c.episode || undefined,
      currentTime: c.position / 1000,
      duration: c.duration / 1000,
      updatedAt: c.last_watched
    }));

    // Merge and sort by most recently watched (default fallback)
    const allProgress = [...local, ...cloudProgress];

    // Helper to get sort weight for an item (prefers higher season/episode)
    const getWeight = (p: any) => {
      if (p.season !== undefined && p.episode !== undefined) {
        return p.season * 10000 + p.episode;
      }
      return p.updatedAt; // For movies, fallback to timestamp
    };

    // First pass deduplication: group by raw ID and pick the one with max weight
    const uniqueMap = new Map<string, WatchProgress>();
    for (const p of allProgress) {
      const idStr = String(p.id);
      if (!uniqueMap.has(idStr)) {
        uniqueMap.set(idStr, p);
      } else {
        const existing = uniqueMap.get(idStr)!;
        if (getWeight(p) > getWeight(existing)) {
          uniqueMap.set(idStr, p);
        }
      }
    }

    const uniqueProgress = Array.from(uniqueMap.values());
    // Sort unique progress by updatedAt so recently watched shows remain at the front of the row
    uniqueProgress.sort((a, b) => b.updatedAt - a.updatedAt);

    if (uniqueProgress.length > 0) {
      setItems(uniqueProgress);

      // Fetch details from TMDB to get images
      Promise.all(uniqueProgress.map(async (p) => {
        const cacheKey = `${p.id}:${p.type}`;
        if (tmdbResolutionCache.has(cacheKey)) {
          const cachedData = tmdbResolutionCache.get(cacheKey);
          return { ...p, ...cachedData };
        }

        try {
          if (String(p.id).startsWith("torbox_")) {
            const parts = String(p.id).split("_");
            const torrentId = parseInt(parts[1]);

            // Dynamically import to avoid breaking components that don't need torbox.ts
            const { getTorboxApiKey, getTorboxTorrent } = await import("@/lib/torbox");
            const key = getTorboxApiKey();
            if (key) {
              const tboxItem = await getTorboxTorrent(key, torrentId);
              if (tboxItem && tboxItem.name) {
                const name = tboxItem.name;
                let cleanTitle = "";
                let year = "";
                let isTv = false;

                // Try parsing TV show format (e.g. S01E01)
                const tvMatch = name.match(/^(.+?)(?:\b[sS]\d{1,2}[eE]\d{1,2}\b)/i);
                if (tvMatch) {
                  cleanTitle = tvMatch[1].replace(/[\.\_]/g, " ").trim();
                  isTv = true;
                } else {
                  // Fallback to movie format with Year
                  const movieMatch = name.match(/^(.+?)(?:\b(19\d{2}|20\d{2})\b)/i);
                  if (movieMatch) {
                    cleanTitle = movieMatch[1].replace(/[\.\_]/g, " ").trim();
                    year = movieMatch[2];
                  }
                }

                let tmdbData = null;
                if (cleanTitle) {
                  const { searchTmdb } = await import("@/lib/tmdb");
                  tmdbData = await searchTmdb(cleanTitle, year || undefined, isTv ? "tv" : "movie");
                }

                const resVal = { tmdbData, title: tmdbData ? (tmdbData.title || tmdbData.name) : tboxItem.name };
                tmdbResolutionCache.set(cacheKey, resVal);
                return { ...p, ...resVal };
              }
            }
            const resVal = { tmdbData: null };
            tmdbResolutionCache.set(cacheKey, resVal);
            return { ...p, ...resVal };
          }

          const tmdbType = p.type === "series" ? "tv" : p.type;
          const rawId = String(p.id).startsWith("tt") ? String(p.id) : `tmdb:${p.id}`;
          const movie = await resolveStremioIdToMovie(rawId, tmdbType);
          const resVal = { tmdbData: movie, tmdbId: movie?.id };
          tmdbResolutionCache.set(cacheKey, resVal);
          return { ...p, ...resVal };
        } catch (e) {
          return { ...p, tmdbData: null };
        }
      })).then((enriched) => {
        // Second pass deduplication: cloud uses IMDb IDs, local uses TMDB IDs.
        // Group by resolved TMDB ID and again pick max weight.
        const finalMap = new Map<string, any>();

        for (const item of enriched) {
          const resolvedId = String(item.tmdbData?.id || item.id);
          if (!finalMap.has(resolvedId)) {
            finalMap.set(resolvedId, item);
          } else {
            const existing = finalMap.get(resolvedId)!;
            if (getWeight(item) > getWeight(existing)) {
              finalMap.set(resolvedId, item);
            }
          }
        }

        const finalItems = Array.from(finalMap.values());
        finalItems.sort((a, b) => b.updatedAt - a.updatedAt);
        cachedEnrichedItems = finalItems;
        setEnrichedItems(finalItems);
      });
    } else {
      setItems([]);
      setEnrichedItems([]);
      cachedEnrichedItems = [];
    }
  }, []);

  if (items.length === 0) return null;

  const scrollLeft = () => rowRef.current?.scrollBy({ left: -600, behavior: "smooth" });
  const scrollRight = () => rowRef.current?.scrollBy({ left: 600, behavior: "smooth" });

  const handlePlay = async (item: WatchProgress) => {
    if (String(item.id).startsWith("torbox_")) {
      const parts = String(item.id).split("_");
      if (parts.length >= 3) {
        const torrentId = parseInt(parts[1]);
        const fileId = parseInt(parts[2]);

        import("@/lib/torbox").then(async ({ getTorboxApiKey, requestTorboxLink }) => {
          const key = getTorboxApiKey();
          if (key) {
            const link = await requestTorboxLink(key, torrentId, fileId);
            if (link) {
              window.location.href = `/player?id=${item.id}&type=${item.type}&url=${encodeURIComponent(link)}`;
              return;
            }
          }
          alert("Could not resolve TorBox stream. Ensure your API key is configured.");
        });
        return;
      }
    }
    setPicker(item);
  };

  const handleStreamSelected = (stream: StreamItem) => {
    if (!picker) return;
    const url = stream.url ? encodeURIComponent(stream.url) : "";
    let route = `/player?id=${picker.id}&type=${picker.type}&url=${url}`;
    if (picker.season && picker.episode) route += `&s=${picker.season}&e=${picker.episode}`;
    if (stream.addonUrl) {
      try { sessionStorage.setItem("nuvio.currentAddonUrl", stream.addonUrl); } catch { /* ignore */ }
    }
    setPicker(null);
    window.location.href = route;
  };

  return (
    <>
      <div className="mb-8 relative group">
        <h2 className="text-white font-semibold text-[17px] mb-3 ml-1">Continue Watching</h2>

        <div className="relative">
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          <div
            ref={rowRef}
            className="flex gap-4 overflow-x-auto hide-scrollbar pb-6 pt-2 px-1"
          >
            {enrichedItems.map((item) => {
              const data = item.tmdbData;
              const imgSrc = data?.backdrop_path || data?.poster_path
                ? `${TMDB_IMAGE_W500}${data.backdrop_path || data.poster_path}`
                : null;

              const isTorbox = String(item.id).startsWith("torbox_");
              // If it's TorBox, use the dynamically fetched name (item.title) or fallback to TorBox Media
              const title_ = isTorbox
                ? (item.title !== "Stream" ? item.title : "TorBox Media")
                : (data?.title || data?.name || item.title || "Unknown");
              const percent = item.duration > 0 ? (item.currentTime / item.duration) * 100 : 0;

              return (
                <div
                  key={`${item.id}-${item.season}-${item.episode}`}
                  onClick={() => handlePlay(item)}
                  className="row-card cursor-pointer rounded-xl relative group/card shrink-0 transition-transform duration-300 hover:scale-105 hover:z-10 shadow-md w-64 h-[144px]"
                >
                  <div className="w-full h-full rounded-xl overflow-hidden relative">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={title_}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        crossOrigin="anonymous"
                      />
                    ) : isTorbox ? (
                      <div className="w-full h-full bg-gradient-to-br from-[#0f172a] to-[#020617] flex flex-col items-center justify-center text-white border border-white/5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-8 h-8 text-blue-500 mb-2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        <span className="font-bold text-sm tracking-wide text-blue-100">TorBox</span>
                        <span className="text-[10px] text-blue-400/80">Cloud Storage</span>
                      </div>
                    ) : (
                      <div className="w-full h-full bg-[#222] flex items-center justify-center text-[#555] text-xs">
                        No Image
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/30 group-hover/card:bg-black/50 transition-all duration-200 flex flex-col justify-end p-3">
                      <p className="text-white text-xs font-semibold line-clamp-1 drop-shadow mb-1">{title_}</p>
                      {item.season && item.episode && (
                        <p className="text-white/80 text-[10px] drop-shadow mb-2">S{item.season} E{item.episode}</p>
                      )}

                      <div className="w-full bg-white/30 h-1 rounded-full overflow-hidden mt-1">
                        <div className="bg-red-600 h-full" style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity">
                      <div className="w-10 h-10 bg-black/60 rounded-full flex items-center justify-center border border-white/30">
                        <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 ml-1">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {picker && (
        <StreamPickerModal
          tmdbId={parseInt(String(picker.id))}
          type={picker.type}
          season={picker.season}
          episode={picker.episode}
          onClose={() => setPicker(null)}
          onPlayStream={handleStreamSelected}
        />
      )}
    </>
  );
}
