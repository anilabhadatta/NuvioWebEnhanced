"use client";

import React, { useEffect, useState, useRef } from "react";
import { tmdb, TMDB_IMAGE_BASE, TMDB_IMAGE_W500, TMDBMovie, getGenreNames } from "@/lib/tmdb";
import MovieModal from "./MovieModal";
import { useRouter } from "next/navigation";

interface RowProps {
  title: string;
  url: string;
  large?: boolean;   // poster-style cards
  first?: boolean;   // overlap hero
  onSelectMovie?: (m: TMDBMovie) => void;
}

let isHydrated = false;

export default function ContentRow({ title, url, large, first, onSelectMovie }: RowProps) {
  const router = useRouter();

  const [movies, setMovies] = useState<TMDBMovie[]>(() => {
    if (typeof window !== "undefined" && isHydrated) {
      const cached = sessionStorage.getItem(`nuvio_row_${url}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) return parsed;
        } catch(e) {}
      }
    }
    return [];
  });

  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined" && isHydrated) {
      const cached = sessionStorage.getItem(`nuvio_row_${url}`);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) return false;
        } catch(e) {}
      }
    }
    return true;
  });

  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isHydrated = true;
    let cancelled = false;
    let hasCache = false;

    // 1. Instantly load from session storage cache
    const cached = sessionStorage.getItem(`nuvio_row_${url}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setMovies(parsed);
          setLoading(false);
          hasCache = true;
        }
      } catch (e) {}
    }

    // 2. Fetch fresh in background
    tmdb.get(url).then((res) => {
      if (cancelled) return;
      const results = res.data.results || [];
      if (results.length > 0) {
        try { sessionStorage.setItem(`nuvio_row_${url}`, JSON.stringify(results)); } catch(e) {}
      }
      setMovies(results);
      setLoading(false);
    }).catch(() => {
      if (!cancelled && !hasCache) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [url]);

  const scrollLeft = () => rowRef.current?.scrollBy({ left: -600, behavior: "smooth" });
  const scrollRight = () => rowRef.current?.scrollBy({ left: 600, behavior: "smooth" });

  const handlePlay = (movie: TMDBMovie) => {
    onSelectMovie?.(movie);
  };

  if (loading) {
    return (
      <div className="mb-8" style={{ marginTop: first ? "-6rem" : "" }}>
        <div className="h-5 w-36 bg-[#222] rounded animate-pulse mb-3 ml-1" />
        <div className="flex gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className={`bg-[#222] rounded-xl animate-pulse shrink-0 ${large ? "w-36 h-52" : "w-52 h-28"}`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!movies.length) return null;

  return (
    <>
      <div className="mb-8 relative group" style={{ marginTop: first ? "-6rem" : "" }}>
        <h2 className="text-white font-semibold text-[17px] mb-3 ml-1">{title}</h2>

        <div className="relative">
          {/* Left scroll button */}
          <button
            onClick={scrollLeft}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>

          {/* Right scroll button */}
          <button
            onClick={scrollRight}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Scroll row */}
          <div
            ref={rowRef}
            className="flex gap-4 overflow-x-auto hide-scrollbar pb-6 pt-2 px-1"
          >
            {movies.map((movie) => {
              const imgSrc = large
                ? `${TMDB_IMAGE_W500}${movie.poster_path}`
                : `${TMDB_IMAGE_W500}${movie.backdrop_path || movie.poster_path}`;
              const title_ = movie.title || movie.name || "";

              return (
                <div
                  key={movie.id}
                  onClick={() => onSelectMovie?.(movie)}
                  className={`row-card cursor-pointer rounded-xl relative group/card shrink-0 transition-transform duration-300 hover:scale-105 hover:z-10 shadow-md ${
                    large ? "w-40 h-[240px]" : "w-60 h-[135px]"
                  }`}
                >
                  <div className="w-full h-full rounded-xl overflow-hidden relative">
                    {imgSrc && (imgSrc.includes("/null") === false) ? (
                      <img
                        src={imgSrc}
                        alt={title_}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#222] flex items-center justify-center text-[#555] text-xs">
                        No Image
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/50 transition-all duration-200 flex flex-col justify-end p-3 opacity-0 group-hover/card:opacity-100">
                      <p className="text-white text-xs font-semibold line-clamp-2 drop-shadow mb-2">{title_}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePlay(movie); }}
                          className="flex items-center justify-center gap-1 bg-white text-black text-xs font-bold px-3 py-1.5 rounded-lg flex-1"
                        >
                          ▶ Play
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onSelectMovie?.(movie); }}
                          className="flex items-center justify-center gap-1 bg-white/20 border border-white/30 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex-1 transition-colors"
                        >
                          Info
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
