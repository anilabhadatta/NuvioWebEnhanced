"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Sidebar from "./Sidebar";
import HeroBanner from "./HeroBanner";
import ContentRow from "./ContentRow";
import { TMDB_URLS } from "@/lib/tmdb";

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const anon = localStorage.getItem("nuvio_anon");
      if (!session && !anon) {
        router.replace("/");
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
          <ContentRow title="Trending Now" url={TMDB_URLS.trending} first />
          <ContentRow title="Trending Movies" url={TMDB_URLS.trendingMovies} />
          <ContentRow title="Trending Series" url={TMDB_URLS.trendingSeries} />
          <ContentRow title="Top Rated" url={TMDB_URLS.topRated} />
          <ContentRow title="Action" url={TMDB_URLS.action} />
          <ContentRow title="Science Fiction" url={TMDB_URLS.scifi} />
          <ContentRow title="Animated" url={TMDB_URLS.animated} />
          <ContentRow title="Comedy" url={TMDB_URLS.comedy} />
          <ContentRow title="Horror" url={TMDB_URLS.horror} />
          <ContentRow title="Upcoming" url={TMDB_URLS.upcoming} />
          <ContentRow title="Netflix Originals" url={TMDB_URLS.originals} large />
        </div>
      </main>
    </div>
  );
}
