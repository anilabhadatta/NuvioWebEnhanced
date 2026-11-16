"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  LibraryItem,
  LibraryCategory,
  getLibraryItems,
  removeFromLibrary,
  updateLibraryCategory,
  addToLibrary,
  isInLibrary,
} from "@/lib/library";
import { TMDBMovie, TMDB_IMAGE_W500, tmdb, TMDB_API_KEY } from "@/lib/tmdb";
import MovieModal from "./MovieModal";
import TorboxLibrary from "./TorboxLibrary";

export default function LibraryView() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [activeTab, setActiveTab] = useState<"all" | LibraryCategory | "cloud">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "title" | "rating" | "year">("recent");

  // Selected movie for MovieModal playback
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);

  // "+ Add to Library" search modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [addSearchResults, setAddSearchResults] = useState<TMDBMovie[]>([]);
  const [addSearching, setAddSearching] = useState(false);

  // Load items and subscribe to updates
  useEffect(() => {
    const load = () => {
      setItems(getLibraryItems());
    };
    load();
    const handleUpdate = () => load();
    window.addEventListener("nuvio:library-updated", handleUpdate);
    window.addEventListener("nuvio:profile-changed", handleUpdate);
    return () => {
      window.removeEventListener("nuvio:library-updated", handleUpdate);
      window.removeEventListener("nuvio:profile-changed", handleUpdate);
    };
  }, []);

  // Counts
  const counts = useMemo(() => {
    return {
      all: items.length,
      movie: items.filter((i) => i.category === "movie").length,
      series: items.filter((i) => i.category === "series").length,
      anime: items.filter((i) => i.category === "anime").length,
    };
  }, [items]);

  // Filtered and sorted items
  const displayedItems = useMemo(() => {
    let list = items;
    if (activeTab !== "all" && activeTab !== "cloud") {
      list = list.filter((i) => i.category === activeTab);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((i) => i.title.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortBy === "recent") return b.addedAt - a.addedAt;
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "rating") return (b.rating || 0) - (a.rating || 0);
      if (sortBy === "year") {
        const yA = a.releaseDate ? parseInt(a.releaseDate.slice(0, 4)) : 0;
        const yB = b.releaseDate ? parseInt(b.releaseDate.slice(0, 4)) : 0;
        return yB - yA;
      }
      return 0;
    });
  }, [items, activeTab, searchQuery, sortBy]);

  // Search TMDB for "+ Add to Library"
  useEffect(() => {
    if (!addSearchQuery.trim()) {
      setAddSearchResults([]);
      setAddSearching(false);
      return;
    }
    setAddSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await tmdb.get(
          `/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(addSearchQuery)}&language=en-US`
        );
        const filtered = (res.data.results || []).filter((r: any) => r.media_type !== "person");
        setAddSearchResults(filtered);
      } catch (e) {
        console.error("Add search failed", e);
      } finally {
        setAddSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [addSearchQuery]);

  const handleCardClick = (item: LibraryItem) => {
    // Construct TMDBMovie compatible object to pass to MovieModal
    const movieObj: TMDBMovie = {
      id: typeof item.id === "string" && !isNaN(Number(item.id)) ? Number(item.id) : (item.id as any),
      title: item.title,
      name: item.title,
      overview: item.overview || "",
      poster_path: item.posterPath || "",
      backdrop_path: item.backdropPath || "",
      media_type: item.type === "tv" || item.type === "series" ? "tv" : "movie",
      release_date: item.releaseDate,
      first_air_date: item.releaseDate,
      vote_average: item.rating || 0,
      genre_ids: [],
      original_language: item.originalLanguage || "en",
    };
    setSelectedMovie(movieObj);
  };

  const handleRemove = (e: React.MouseEvent, id: string | number) => {
    e.stopPropagation();
    removeFromLibrary(id);
  };

  const handleChangeCategory = (e: React.MouseEvent, id: string | number, cat: LibraryCategory) => {
    e.stopPropagation();
    updateLibraryCategory(id, cat);
  };

  const handleQuickAdd = (m: TMDBMovie, cat: LibraryCategory) => {
    addToLibrary(m, cat);
  };

  const getCategoryBadge = (cat: LibraryCategory) => {
    switch (cat) {
      case "anime":
        return { label: "Anime", bg: "bg-pink-500/15 text-pink-400 border-pink-500/30" };
      case "series":
        return { label: "Series", bg: "bg-purple-500/15 text-purple-400 border-purple-500/30" };
      case "movie":
      default:
        return { label: "Movie", bg: "bg-blue-500/15 text-blue-400 border-blue-500/30" };
    }
  };

  return (
    <div className="w-full">
      {/* Header controls & stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Library</h1>
          <p className="text-[#888] text-sm">
            Saved movies, series, anime, and connected cloud storage.
          </p>
        </div>

        <button
          onClick={() => {
            setAddSearchQuery("");
            setAddSearchResults([]);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer self-start sm:self-auto"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add to Library
        </button>
      </div>

      {/* Navigation tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4 mb-6">
        {[
          { id: "all", label: "All Items", count: counts.all },
          { id: "movie", label: "Movies", count: counts.movie },
          { id: "series", label: "TV Series", count: counts.series },
          { id: "anime", label: "Anime", count: counts.anime },
          { id: "cloud", label: "TorBox Cloud", count: null },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                isActive
                  ? "bg-white text-black shadow-md"
                  : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                    isActive ? "bg-black/10 text-black" : "bg-white/10 text-white/60"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Cloud tab display */}
      {activeTab === "cloud" ? (
        <div className="mt-4">
          <TorboxLibrary />
        </div>
      ) : (
        <>
          {/* Search & Sort Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="relative flex-1 max-w-md">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className="w-4 h-4 text-[#777] absolute left-3.5 top-1/2 -translate-y-1/2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab === "all" ? "library" : activeTab}...`}
                className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-[#555] outline-none focus:border-white/30 transition-colors"
              />
            </div>

            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span className="text-xs text-[#777] font-semibold">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#1a1a1a] border border-white/10 text-white text-xs font-semibold rounded-xl px-3 py-2 outline-none cursor-pointer focus:border-white/30"
              >
                <option value="recent">Recently Added</option>
                <option value="title">Title (A-Z)</option>
                <option value="rating">Rating (Highest)</option>
                <option value="year">Release Year (Newest)</option>
              </select>
            </div>
          </div>

          {/* Library Cards Grid */}
          {displayedItems.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {displayedItems.map((item) => {
                const badge = getCategoryBadge(item.category);
                const imgSrc = item.posterPath
                  ? `${TMDB_IMAGE_W500}${item.posterPath}`
                  : item.backdropPath
                  ? `${TMDB_IMAGE_W500}${item.backdropPath}`
                  : null;
                const year = item.releaseDate ? item.releaseDate.slice(0, 4) : "";

                return (
                  <div
                    key={item.id}
                    onClick={() => handleCardClick(item)}
                    className="group relative bg-[#181818] border border-white/5 hover:border-white/20 rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl flex flex-col"
                  >
                    {/* Poster container */}
                    <div className="aspect-[2/3] w-full relative bg-[#222] overflow-hidden">
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          crossOrigin="anonymous"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center text-[#555] text-xs">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 mb-2 opacity-50">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                          </svg>
                          <span>{item.title}</span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between z-10 pointer-events-none">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border backdrop-blur-md ${badge.bg}`}>
                          {badge.label}
                        </span>

                        {item.rating && item.rating > 0 && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-yellow-400 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-white/10">
                            ★ {item.rating.toFixed(1)}
                          </span>
                        )}
                      </div>

                      {/* Hover Overlay with Play Button & Remove */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-3 z-20">
                        <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center shadow-2xl transition-transform hover:scale-110 mb-3">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 translate-x-0.5">
                            <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                          </svg>
                        </div>

                        {/* Quick category changer & delete */}
                        <div className="flex items-center gap-1 bg-black/80 backdrop-blur-md p-1 rounded-xl border border-white/20">
                          <button
                            onClick={(e) => handleChangeCategory(e, item.id, "movie")}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                              item.category === "movie" ? "bg-blue-500 text-white" : "text-[#aaa] hover:text-white"
                            }`}
                            title="Set as Movie"
                          >
                            Movie
                          </button>
                          <button
                            onClick={(e) => handleChangeCategory(e, item.id, "series")}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                              item.category === "series" ? "bg-purple-500 text-white" : "text-[#aaa] hover:text-white"
                            }`}
                            title="Set as TV Series"
                          >
                            Series
                          </button>
                          <button
                            onClick={(e) => handleChangeCategory(e, item.id, "anime")}
                            className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors ${
                              item.category === "anime" ? "bg-pink-500 text-white" : "text-[#aaa] hover:text-white"
                            }`}
                            title="Set as Anime"
                          >
                            Anime
                          </button>
                          <button
                            onClick={(e) => handleRemove(e, item.id)}
                            className="text-[#aaa] hover:text-red-400 p-1 transition-colors"
                            title="Remove from library"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Metadata text */}
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <p className="text-white text-xs font-bold line-clamp-1 group-hover:text-orange-400 transition-colors">
                        {item.title}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-[#777] mt-1">
                        <span>{year || "—"}</span>
                        <span className="capitalize">{item.type}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Empty state */
            <div className="bg-[#181818] border border-white/5 rounded-3xl p-12 text-center max-w-lg mx-auto my-12">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-[#888]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </div>
              <h3 className="text-white font-bold text-lg mb-1">
                {searchQuery ? "No matching titles found" : "Your library is empty"}
              </h3>
              <p className="text-[#888] text-xs max-w-sm mx-auto mb-6">
                {searchQuery
                  ? "Try searching for a different movie, series, or anime."
                  : "Save your favorite movies, TV shows, and anime to keep track of what you want to watch."}
              </p>
              <button
                onClick={() => {
                  setAddSearchQuery("");
                  setShowAddModal(true);
                }}
                className="bg-white hover:bg-gray-200 text-black font-bold text-xs px-5 py-2.5 rounded-xl transition-all shadow-lg cursor-pointer"
              >
                + Add Media to Library
              </button>
            </div>
          )}
        </>
      )}

      {/* "+ Add to Library" search modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="bg-[#1a1a1a] border border-white/15 rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-white font-bold text-lg">Add to Library</h3>
                <p className="text-[#888] text-xs">Search TMDB to add movies, TV shows, or anime.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4 border-b border-white/5">
              <div className="relative">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="w-4 h-4 text-[#777] absolute left-3.5 top-1/2 -translate-y-1/2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  autoFocus
                  type="text"
                  value={addSearchQuery}
                  onChange={(e) => setAddSearchQuery(e.target.value)}
                  placeholder="Type a title (e.g., Inception, Attack on Titan, Breaking Bad)..."
                  className="w-full bg-[#111] border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-[#555] outline-none focus:border-white/30"
                />
                {addSearching && (
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                )}
              </div>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {addSearchResults.length > 0 ? (
                addSearchResults.map((m) => {
                  const title = m.title || m.name || "Untitled";
                  const year = (m.release_date || m.first_air_date || "").slice(0, 4);
                  const isSaved = isInLibrary(m.id);
                  const imgSrc = m.poster_path ? `${TMDB_IMAGE_W500}${m.poster_path}` : null;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/[0.08] border border-white/5 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {imgSrc ? (
                          <img
                            src={imgSrc}
                            alt={title}
                            className="w-10 h-14 object-cover rounded-lg flex-shrink-0 bg-[#222]"
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div className="w-10 h-14 rounded-lg bg-[#222] flex-shrink-0 flex items-center justify-center text-[10px] text-[#666]">
                            No img
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-white font-bold text-sm truncate">{title}</p>
                          <div className="flex items-center gap-2 text-xs text-[#888] mt-0.5">
                            <span>{year || "—"}</span>
                            <span>•</span>
                            <span className="capitalize">{m.media_type || "media"}</span>
                            {m.vote_average ? (
                              <>
                                <span>•</span>
                                <span className="text-yellow-400">★ {m.vote_average.toFixed(1)}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Add Buttons */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {isSaved ? (
                          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            Saved
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => handleQuickAdd(m, "movie")}
                              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 transition-colors cursor-pointer"
                              title="Add as Movie"
                            >
                              + Movie
                            </button>
                            <button
                              onClick={() => handleQuickAdd(m, "series")}
                              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/30 transition-colors cursor-pointer"
                              title="Add as Series"
                            >
                              + Series
                            </button>
                            <button
                              onClick={() => handleQuickAdd(m, "anime")}
                              className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/30 transition-colors cursor-pointer"
                              title="Add as Anime"
                            >
                              + Anime
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : addSearchQuery.trim() && !addSearching ? (
                <p className="text-[#888] text-xs text-center py-8">No results found on TMDB.</p>
              ) : (
                <p className="text-[#666] text-xs text-center py-8">Type in the search bar above to find media.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MovieModal for playback when any item is clicked */}
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => setSelectedMovie(null)}
          onPlay={(movie, stream, season, episode) => {
            const url = stream.url ? encodeURIComponent(stream.url) : "";
            const tmdbId = movie.id;
            const type = movie.media_type || (movie.title ? "movie" : "tv");
            let route = `/player?id=${tmdbId}&type=${type}&url=${url}`;
            if (stream.infoHash) route += `&hash=${stream.infoHash}`;
            if (stream.headers) {
              route += `&headers=${encodeURIComponent(JSON.stringify(stream.headers))}`;
            }
            if (season && episode) route += `&s=${season}&e=${episode}`;
            if (stream.addonUrl) {
              try {
                sessionStorage.setItem("nuvio.currentAddonUrl", stream.addonUrl);
              } catch {
                /* ignore */
              }
            }
            window.location.href = route;
          }}
        />
      )}
    </div>
  );
}
