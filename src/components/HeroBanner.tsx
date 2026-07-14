"use client";

import React, { useState, useEffect } from "react";
import { TMDBMovie, resolveStremioIdToMovie } from "@/lib/tmdb";
import { fetchCollectionCatalog, CatalogMeta } from "@/lib/catalogs";
import { useRouter } from "next/navigation";
import MovieModal from "./MovieModal";
import { Info } from "lucide-react";

let isHydrated = false;

export default function HeroBanner() {
  const router = useRouter();

  const [movies, setMovies] = useState<CatalogMeta[]>(() => {
    if (typeof window !== "undefined" && isHydrated) {
      const cached = sessionStorage.getItem("nuvio_hero_banner");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) return parsed;
        } catch (e) { }
      }
    }
    return [];
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  const [loading, setLoading] = useState(() => {
    if (typeof window !== "undefined" && isHydrated) {
      const cached = sessionStorage.getItem("nuvio_hero_banner");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) return false;
        } catch (e) { }
      }
    }
    return true;
  });

  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    isHydrated = true;
    let cancelled = false;
    let hasCache = false;

    const cached = sessionStorage.getItem("nuvio_hero_banner");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.length > 0) {
          setMovies(parsed);
          setLoading(false);
          hasCache = true;
        }
      } catch (e) { }
    }

    // Use cinemeta-catalogs for Stremio fetching instead of TMDB directly
    fetchCollectionCatalog("https://cinemeta-catalogs.strem.io/top/manifest.json", "movie", "top")
      .then((items) => {
        if (cancelled) return;
        const sliced = items.filter(m => m.background).slice(0, 8); // Only use items with a backdrop
        if (sliced.length > 0) {
          try { sessionStorage.setItem("nuvio_hero_banner", JSON.stringify(sliced)); } catch (e) { }
        }
        setMovies(sliced);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled && !hasCache) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Auto-rotate hero every 8s
  useEffect(() => {
    if (movies.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % movies.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [movies.length]);

  if (loading) {
    return (
      <div className="relative h-[70vh] bg-[#1a1a1a] animate-pulse rounded-none">
        <div className="absolute bottom-24 left-6 space-y-3">
          <div className="h-12 w-80 bg-[#2a2a2a] rounded-xl" />
          <div className="h-4 w-96 bg-[#2a2a2a] rounded" />
          <div className="h-4 w-72 bg-[#2a2a2a] rounded" />
          <div className="flex gap-3 mt-4">
            <div className="h-10 w-28 bg-[#2a2a2a] rounded-xl" />
            <div className="h-10 w-28 bg-[#2a2a2a] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const movie = movies[currentIndex];
  if (!movie) return null;

  const title = movie.name || "";
  const genres = (movie as any).genres || [];

  const handlePlay = async () => {
    setResolvingId(movie.id);
    try {
      const tmdbResolved = await resolveStremioIdToMovie(movie.id, movie.type);
      if (tmdbResolved) setSelectedMovie(tmdbResolved);
    } catch { /* ignore */ }
    setResolvingId(null);
  };

  return (
    <>
      <div className="relative h-[70vh] overflow-hidden">
        {movie.background && (
          <img
            key={movie.id}
            src={movie.background}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 opacity-0"
            style={{ objectPosition: "center 20%" }}
            onLoad={(e) => (e.currentTarget.style.opacity = '1')}
            ref={(img) => { if (img?.complete) { img.style.transition = 'none'; img.style.opacity = '1'; } }}
          />
        )}

        {/* Gradient overlay - matching NuvioDesktop screenshot */}
        <div className="hero-gradient absolute inset-0" />

        {/* Sidebar gradient on left */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#111111] via-transparent to-transparent opacity-60" />

        {/* Content */}
        <div className="relative z-10 h-full flex flex-col justify-end pb-14 px-6">
          {/* Genre tags */}
          {genres.length > 0 && (
            <div className="flex gap-2 mb-3">
              {genres.map((g: string) => (
                <span key={g} className="text-xs text-[#bbb] font-medium">{g}</span>
              ))}
            </div>
          )}

          {/* Title */}
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3 max-w-2xl leading-tight drop-shadow-lg">
            {title}
          </h1>

          {/* Description */}
          {movie.description && (
            <p className="text-[#bbb] text-sm md:text-base max-w-xl line-clamp-3 mb-5 leading-relaxed">
              {movie.description}
            </p>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handlePlay}
              disabled={resolvingId === movie.id}
              className="flex items-center gap-2 bg-white hover:bg-gray-200 text-black font-bold px-7 py-3 rounded-xl transition-all text-sm shadow-lg disabled:opacity-50"
            >
              {resolvingId === movie.id ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black animate-spin rounded-full" />
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
              )}
              {resolvingId === movie.id ? "Loading..." : "Play"}
            </button>
            <button
              onClick={handlePlay}
              disabled={resolvingId === movie.id}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-7 py-3 rounded-xl transition-all text-sm backdrop-blur-sm disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              Details
            </button>
          </div>

          {/* Dot indicators */}
          <div className="flex gap-1.5 mt-6">
            {movies.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/30 hover:bg-white/50"
                  }`}
              />
            ))}
          </div>
        </div>
      </div>

      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onPlay={(movie, stream, season, episode) => {
            setSelectedMovie(null);
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
            if (stream.imdbId) route += `&imdb=${encodeURIComponent(stream.imdbId)}`;
            try {
              if (stream.addonUrl) sessionStorage.setItem("nuvio.currentAddonUrl", stream.addonUrl);
              else sessionStorage.removeItem("nuvio.currentAddonUrl");
            } catch { /* ok */ }
            window.location.href = route;
          }}
        />
      )}
    </>
  );
}
