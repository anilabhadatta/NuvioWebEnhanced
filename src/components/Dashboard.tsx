"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "./Sidebar";
import HeroBanner from "./HeroBanner";
import ContentRow from "./ContentRow";
import ContinueWatchingRow from "./ContinueWatchingRow";
import { TMDB_URLS, TMDBMovie } from "@/lib/tmdb";
import MovieModal from "./MovieModal";
import { syncWatchProgressFromCloud } from "@/lib/watchProgress";

export default function Dashboard() {
  const router = useRouter();
  const [selectedMovie, setSelectedMovie] = React.useState<TMDBMovie | null>(null);

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
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const anon = localStorage.getItem("nuvio_anon");
      if (!session && !anon) {
        router.replace("/");
      } else {
        syncWatchProgressFromCloud();
      }
    };
    check();
  }, [router]);

  return (
    <div className="flex min-h-screen bg-[#111111]">
      <Sidebar />

      {/* Main content offset by sidebar width */}
      <main className="flex-1 ml-[220px] overflow-y-auto">
        {/* Hero */}
        <HeroBanner />

        {/* Content rows - exactly like Netflix clone structure */}
        <div className="px-6 pb-12 -mt-2">
          <ContinueWatchingRow first />
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
              router.push(route);
            }}
          />
        )}
      </main>
    </div>
  );
}
