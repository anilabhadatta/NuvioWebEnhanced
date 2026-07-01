"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "./Sidebar";
import HeroBanner from "./HeroBanner";
import ContentRow from "./ContentRow";
import ContinueWatchingRow from "./ContinueWatchingRow";
import CollectionRows from "./CollectionRows";
import { TMDB_URLS, TMDBMovie } from "@/lib/tmdb";
import MovieModal from "./MovieModal";
import { syncWatchProgressFromCloud } from "@/lib/watchProgress";

import { useAuth } from "@/lib/useAuth";
import { useProfiles } from "@/lib/useProfiles";

export default function Dashboard() {
  const router = useRouter();
  const { isAuthenticated, isAnonymous, loading: authLoading } = useAuth();
  const { loading: profilesLoading } = useProfiles();
  const [selectedMovie, setSelectedMovie] = React.useState<TMDBMovie | null>(null);
  const [mounted, setMounted] = React.useState(false);

  useEffect(() => {
    const last = sessionStorage.getItem("lastOpenedMovie");
    if (last) {
      try {
        setSelectedMovie(JSON.parse(last));
      } catch(e) {}
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

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated && !isAnonymous) {
        router.replace("/");
      } else if (isAuthenticated) {
        syncWatchProgressFromCloud();
      }
      // Give a tiny frame delay to ensure browser layout is stable before fading in
      requestAnimationFrame(() => setMounted(true));
    }
  }, [isAuthenticated, isAnonymous, authLoading, router]);

  // While checking auth status or active profile database info, show a clean background with spinner
  if (authLoading || (isAuthenticated && profilesLoading)) {
    return (
      <div className="w-full h-screen bg-[#111111] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated && !isAnonymous) {
    return null;
  }

  return (
    <div
      className="flex min-h-screen bg-[#111111]"
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <Sidebar />

      {/* Main content offset by sidebar width */}
      <main className="flex-1 ml-[220px] overflow-y-auto">
        {/* Hero */}
        <HeroBanner />

        {/* Content rows - exactly like Netflix clone structure */}
        <div className="px-6 pb-12 -mt-2">
          <ContinueWatchingRow first />
          <CollectionRows onSelectMovie={handleSelectMovie} />
          <ContentRow title="Trending Now" url={TMDB_URLS.trending} onSelectMovie={handleSelectMovie} />
          <ContentRow title="Trending Movies" url={TMDB_URLS.trendingMovies} onSelectMovie={handleSelectMovie} />
          <ContentRow title="Trending Series" url={TMDB_URLS.trendingSeries} onSelectMovie={handleSelectMovie} />
          <ContentRow title="Top Rated" url={TMDB_URLS.topRated} onSelectMovie={handleSelectMovie} />
          <ContentRow title="Action" url={TMDB_URLS.action} onSelectMovie={handleSelectMovie} />
          <ContentRow title="Science Fiction" url={TMDB_URLS.scifi} onSelectMovie={handleSelectMovie} />
          <ContentRow title="Animated" url={TMDB_URLS.animated} onSelectMovie={handleSelectMovie} />
          <ContentRow title="Comedy" url={TMDB_URLS.comedy} onSelectMovie={handleSelectMovie} />
          <ContentRow title="Horror" url={TMDB_URLS.horror} onSelectMovie={handleSelectMovie} />
          <ContentRow title="Upcoming" url={TMDB_URLS.upcoming} onSelectMovie={handleSelectMovie} />
          <ContentRow title="Netflix Originals" url={TMDB_URLS.originals} large onSelectMovie={handleSelectMovie} />
        </div>

        {selectedMovie && (
          <MovieModal
            movie={selectedMovie}
            onClose={() => handleSelectMovie(null)}
            onPlay={(movie, stream, season, episode) => {
              const url = stream.url ? encodeURIComponent(stream.url) : "";
              const tmdbId = movie.id;
              const type = movie.media_type || (movie.title ? "movie" : "tv");
              let route = `/player?id=${tmdbId}&type=${type}&url=${url}`;
              if (stream.infoHash) route += `&hash=${stream.infoHash}`;
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
      </main>
    </div>
  );
}
