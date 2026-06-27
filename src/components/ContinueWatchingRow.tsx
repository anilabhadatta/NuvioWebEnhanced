"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { getWatchProgress, WatchProgress } from "@/lib/watchProgress";
import { tmdb, TMDB_IMAGE_W500 } from "@/lib/tmdb";

export default function ContinueWatchingRow({ first }: { first?: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState<WatchProgress[]>([]);
  const [enrichedItems, setEnrichedItems] = useState<any[]>([]);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const progress = getWatchProgress();
    if (progress.length > 0) {
      setItems(progress);
      
      // Fetch details from TMDB to get images
      Promise.all(progress.map(async (p) => {
        try {
          const res = await tmdb.get(`/${p.type}/${p.id}`);
          return { ...p, tmdbData: res.data };
        } catch (e) {
          return { ...p, tmdbData: null };
        }
      })).then(setEnrichedItems);
    }
  }, []);

  if (items.length === 0) return null;

  const scrollLeft = () => rowRef.current?.scrollBy({ left: -600, behavior: "smooth" });
  const scrollRight = () => rowRef.current?.scrollBy({ left: 600, behavior: "smooth" });

  const handlePlay = (item: any) => {
    let route = `/player?id=${item.id}&type=${item.type}&url=`;
    if (item.season && item.episode) {
      route += `&s=${item.season}&e=${item.episode}`;
    }
    router.push(route);
  };

  return (
    <div className="mb-8 relative group" style={{ marginTop: first ? "-6rem" : "" }}>
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
            const title_ = data?.title || data?.name || item.title || "Unknown";
            const percent = item.duration > 0 ? (item.currentTime / item.duration) * 100 : 0;

            return (
              <div
                key={`${item.id}-${item.season}-${item.episode}`}
                onClick={() => handlePlay(item)}
                className="row-card cursor-pointer rounded-xl relative group/card shrink-0 transition-transform duration-300 hover:scale-105 hover:z-10 shadow-md w-64 h-[144px]"
              >
                <div className="w-full h-full rounded-xl overflow-hidden relative">
                  {imgSrc ? (
                    <img src={imgSrc} alt={title_} className="w-full h-full object-cover" loading="lazy" />
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
  );
}
