"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import { tmdb, TMDB_IMAGE_W500, TMDBMovie, TMDB_API_KEY } from "@/lib/tmdb";
import MovieModal from "@/components/MovieModal";
import { useRouter } from "next/navigation";

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TMDBMovie[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [failedPosters, setFailedPosters] = useState<Record<string, boolean>>({});

  // 1. Restore search state from sessionStorage if query was non-empty
  useEffect(() => {
    const q = sessionStorage.getItem("lastSearchQuery");
    const r = sessionStorage.getItem("lastSearchResults");
    const m = sessionStorage.getItem("lastOpenedMovie");
    if (q && q.trim()) {
      setQuery(q);
      if (r) {
        try {
          setResults(JSON.parse(r));
        } catch {}
      }
    } else {
      setQuery("");
      setResults([]);
      sessionStorage.removeItem("lastSearchQuery");
      sessionStorage.removeItem("lastSearchResults");
    }
    if (m) {
      try {
        setSelectedMovie(JSON.parse(m));
      } catch {}
    }
  }, []);

  // 2. Debounced search when query changes
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      sessionStorage.removeItem("lastSearchQuery");
      sessionStorage.removeItem("lastSearchResults");
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await tmdb.get(
          `/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(trimmed)}&language=en-US`
        );
        const filtered =
          res.data.results?.filter(
            (r: any) => r.media_type !== "person" && (r.title || r.name)
          ) || [];
        setResults(filtered);
        sessionStorage.setItem("lastSearchQuery", trimmed);
        sessionStorage.setItem("lastSearchResults", JSON.stringify(filtered));
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleClear = () => {
    setQuery("");
    setResults([]);
    sessionStorage.removeItem("lastSearchQuery");
    sessionStorage.removeItem("lastSearchResults");
  };

  const handleSelectMovie = (m: TMDBMovie | null) => {
    setSelectedMovie(m);
    if (m) {
      sessionStorage.setItem("lastOpenedMovie", JSON.stringify(m));
    } else {
      sessionStorage.removeItem("lastOpenedMovie");
    }
  };

  return (
    <div className="flex min-h-screen bg-[#111111]">
      <Sidebar />
      <main className="flex-1 min-w-0 ml-[220px] p-6 sm:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white tracking-tight">Search</h1>
            <p className="text-[#888] text-sm mt-1">
              Find movies, TV series, and anime across all TMDB catalogs.
            </p>
          </div>

          {/* Search Input Bar */}
          <div className="relative mb-8">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#777]"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, series, anime..."
              className="w-full bg-[#1a1a1a] border border-white/10 focus:border-white/30 rounded-2xl pl-12 pr-12 py-3.5 text-white placeholder-[#555] outline-none transition-colors text-base shadow-lg"
            />
            {loading ? (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : query.trim() ? (
              <button
                type="button"
                onClick={handleClear}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#888] hover:text-white p-1 rounded-full transition-colors cursor-pointer"
                title="Clear search"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>

          {/* Results Grid */}
          {query.trim() && results.length > 0 ? (
            <div>
              <div className="flex items-center justify-between text-xs text-[#888] mb-4 px-1">
                <span>
                  Found <strong className="text-white">{results.length}</strong> results for &ldquo;{query.trim()}&rdquo;
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                {results.map((movie, idx) => {
                  const title = movie.title || movie.name || "Untitled";
                  const rawPoster = movie.poster_path || movie.backdrop_path;
                  const imgSrc = rawPoster ? `${TMDB_IMAGE_W500}${rawPoster}` : null;
                  const rawDate = movie.release_date || movie.first_air_date || "";
                  const yearMatch = String(rawDate).match(/\b(19\d\d|20\d\d)\b/);
                  const year = yearMatch ? yearMatch[1] : String(rawDate).slice(0, 4);
                  const isTv = movie.media_type === "tv" || (!movie.title && !!movie.name);
                  const hasFailed = failedPosters[String(movie.id)];

                  return (
                    <div
                      key={`search-${movie.id}-${idx}`}
                      onClick={() => handleSelectMovie(movie)}
                      className="group relative bg-[#181818] border border-white/5 hover:border-white/20 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl flex flex-col"
                    >
                      {/* Poster image container */}
                      <div className="aspect-[2/3] w-full relative bg-[#222] overflow-hidden">
                        {imgSrc && !hasFailed ? (
                          <img
                            src={imgSrc}
                            alt={title}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                            onError={() =>
                              setFailedPosters((prev) => ({ ...prev, [String(movie.id)]: true }))
                            }
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-[#888] text-xs bg-gradient-to-br from-[#202020] to-[#121212]">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.5}
                              className="w-8 h-8 mb-2 opacity-50"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                              />
                            </svg>
                            <span className="font-semibold text-white/90 line-clamp-2">{title}</span>
                          </div>
                        )}

                        {/* Top Badges */}
                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border backdrop-blur-md bg-white/10 text-white/90 border-white/20">
                            {isTv ? "Series" : "Movie"}
                          </span>
                          {movie.vote_average && movie.vote_average > 0 ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-yellow-400 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10">
                              ★ {movie.vote_average.toFixed(1)}
                            </span>
                          ) : null}
                        </div>

                        {/* Play Hover Overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                          <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transition-transform hover:scale-110">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 translate-x-0.5">
                              <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Title & metadata bar */}
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <p className="text-white text-xs font-bold line-clamp-1 group-hover:text-orange-400 transition-colors">
                          {title}
                        </p>
                        <div className="flex items-center justify-between text-[11px] text-[#777] mt-1">
                          <span>{year || "—"}</span>
                          <span className="capitalize text-[#555]">· {isTv ? "Series" : "Movie"}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : query.trim() && !loading ? (
            /* No Results State */
            <div className="bg-[#181818] border border-white/5 rounded-3xl p-12 text-center max-w-md mx-auto my-12">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-[#888]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-lg mb-1">No matching titles</h3>
              <p className="text-[#888] text-xs leading-relaxed mb-6">
                We couldn&apos;t find any movies or TV series matching &ldquo;{query}&rdquo;.
              </p>
              <button
                onClick={handleClear}
                className="bg-white hover:bg-gray-200 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          ) : (
            /* Prompt State when search is empty */
            <div className="bg-[#181818] border border-white/5 rounded-3xl p-12 text-center max-w-lg mx-auto my-12">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-[#888]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-lg mb-1">Search Catalogs</h3>
              <p className="text-[#888] text-xs leading-relaxed max-w-sm mx-auto">
                Type any movie, TV show, or anime title to search across TMDB and stream directly.
              </p>
            </div>
          )}
        </div>
      </main>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => handleSelectMovie(null)}
          onPlay={(movie, stream, season, episode) => {
            const url = stream.url ? encodeURIComponent(stream.url) : "";
            const tmdbId = movie.id;
            const type = movie.media_type || (movie.title ? "movie" : "tv");
            let route = `/player?id=${tmdbId}&type=${type}&url=${url}`;
            if (stream.headers) {
              route += `&headers=${encodeURIComponent(JSON.stringify(stream.headers))}`;
            }
            if (season && episode) {
              route += `&s=${season}&e=${episode}`;
            }
            try {
              if (stream.addonUrl) sessionStorage.setItem("nuvio.currentAddonUrl", stream.addonUrl);
              else sessionStorage.removeItem("nuvio.currentAddonUrl");
            } catch {}
            window.location.href = route;
          }}
        />
      )}
    </div>
  );
}
