"use client";

import React, { useState } from "react";
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

  const handleSearch = async (q: string) => {
    setQuery(q);
    sessionStorage.setItem("lastSearchQuery", q);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await tmdb.get(`/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}&language=en-US`);
      const filtered = res.data.results?.filter((r: any) => r.media_type !== "person") || [];
      setResults(filtered);
      sessionStorage.setItem("lastSearchResults", JSON.stringify(filtered));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    const q = sessionStorage.getItem("lastSearchQuery");
    const r = sessionStorage.getItem("lastSearchResults");
    const m = sessionStorage.getItem("lastOpenedMovie");
    if (q) setQuery(q);
    if (r) {
      try { setResults(JSON.parse(r)); } catch(e){}
    }
    if (m) {
      try { setSelectedMovie(JSON.parse(m)); } catch(e){}
    }
  }, []);

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
      <main className="flex-1 ml-[220px] p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-6">Search</h1>

          <div className="relative mb-8">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#666]">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search movies, series..."
              className="w-full bg-[#1a1a1a] border border-white/10 focus:border-white/30 rounded-2xl pl-12 pr-5 py-4 text-white placeholder-[#555] outline-none transition-colors text-base"
            />
            {loading && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
            )}
          </div>

          {results.length > 0 ? (
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {results.map((movie) => {
                const imgSrc = movie.poster_path
                  ? `${TMDB_IMAGE_W500}${movie.poster_path}`
                  : movie.backdrop_path
                  ? `${TMDB_IMAGE_W500}${movie.backdrop_path}`
                  : null;
                return (
                  <div
                    key={movie.id}
                    onClick={() => handleSelectMovie(movie)}
                    className="cursor-pointer group rounded-xl overflow-hidden bg-[#1a1a1a] hover:scale-105 transition-transform duration-200"
                  >
                    {imgSrc ? (
                      <img src={imgSrc} alt={movie.title || movie.name} className="w-full aspect-[2/3] object-cover" />
                    ) : (
                      <div className="w-full aspect-[2/3] bg-[#222] flex items-center justify-center text-[#555] text-xs text-center p-2">
                        {movie.title || movie.name}
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-white text-xs font-semibold line-clamp-1">{movie.title || movie.name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : query && !loading ? (
            <p className="text-[#666] text-center py-20">No results for &quot;{query}&quot;</p>
          ) : !query ? (
            <p className="text-[#555] text-center py-20 text-sm">Start typing to search for movies and series...</p>
          ) : null}
        </div>
      </main>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => handleSelectMovie(null)}
          onPlay={(movie, stream, season, episode) => {
            // Do not clear selectedMovie so it stays in sessionStorage for back button
            const url = stream.url ? encodeURIComponent(stream.url) : "";
            const tmdbId = movie.id;
            const type = movie.media_type || (movie.title ? "movie" : "tv");
            let route = `/player?id=${tmdbId}&type=${type}&url=${url}`;
            if (season && episode) {
              route += `&s=${season}&e=${episode}`;
            }
            try {
              if (stream.addonUrl) sessionStorage.setItem("nuvio.currentAddonUrl", stream.addonUrl);
              else sessionStorage.removeItem("nuvio.currentAddonUrl");
            } catch { /* ok */ }
            window.location.href = route;
          }}
        />
      )}
    </div>
  );
}
