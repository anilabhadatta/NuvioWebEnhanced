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
}

export default function ContentRow({ title, url, large, first }: RowProps) {
  const router = useRouter();
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    tmdb.get(url).then((res) => {
      setMovies(res.data.results || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [url]);

  const scrollLeft = () => rowRef.current?.scrollBy({ left: -600, behavior: "smooth" });
  const scrollRight = () => rowRef.current?.scrollBy({ left: 600, behavior: "smooth" });

  const handlePlay = (movie: TMDBMovie) => {
    setSelectedMovie(null);
    router.push(`/player?id=${movie.id}&type=${movie.media_type || (movie.title ? "movie" : "tv")}`);
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
            className="flex gap-3 overflow-x-auto hide-scrollbar pb-2"
          >
            {movies.map((movie) => {
              const imgSrc = large
                ? `${TMDB_IMAGE_W500}${movie.poster_path}`
                : `${TMDB_IMAGE_W500}${movie.backdrop_path || movie.poster_path}`;
              const title_ = movie.title || movie.name || "";

              return (
                <div
                  key={movie.id}
                  onClick={() => setSelectedMovie(movie)}
                  className={`row-card cursor-pointer rounded-xl overflow-hidden relative group/card shrink-0 ${
                    large ? "w-36" : "w-52"
                  }`}
                >
                  {imgSrc && (imgSrc.includes("/null") === false) ? (
                    <img
                      src={imgSrc}
                      alt={title_}
                      className={`w-full object-cover ${large ? "h-52" : "h-28"}`}
                      loading="lazy"
                    />
                  ) : (
                    <div className={`w-full bg-[#222] flex items-center justify-center text-[#555] text-xs ${large ? "h-52" : "h-28"}`}>
                      No Image
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/50 transition-all duration-200 flex flex-col justify-end p-2 opacity-0 group-hover/card:opacity-100">
                    <p className="text-white text-xs font-semibold line-clamp-2 drop-shadow">{title_}</p>
                    <div className="flex gap-1 mt-1.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePlay(movie); }}
                        className="flex items-center gap-1 bg-white text-black text-[10px] font-bold px-2 py-1 rounded-md"
                      >
                        ▶ Play
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSelectedMovie(movie); }}
                        className="flex items-center gap-1 bg-white/20 border border-white/30 text-white text-[10px] font-semibold px-2 py-1 rounded-md"
                      >
                        Info
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onPlay={handlePlay}
        />
      )}
    </>
  );
}
