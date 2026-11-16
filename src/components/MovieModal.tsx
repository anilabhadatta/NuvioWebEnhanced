"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { TMDB_IMAGE_BASE, TMDB_IMAGE_W500, TMDBMovie, getGenreNames, fetchTvDetails, fetchTvSeason, fetchExternalIds } from "@/lib/tmdb";
import StreamPickerModal from "./StreamPickerModal";
import { StreamItem } from "@/lib/addonService";
import { config } from "@/lib/config";
import { fetchExternalRatings, ExternalRating } from "@/lib/mdblist";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import {
  LibraryCategory,
  isInLibrary,
  addToLibrary,
  removeFromLibrary,
  getLibraryItem,
  autoDetectCategory,
} from "@/lib/library";

interface MovieModalProps {
  movie: TMDBMovie;
  onClose: () => void;
  onPlay: (movie: TMDBMovie, stream: StreamItem, season?: number, episode?: number) => void;
}

export default function MovieModal({ movie, onClose, onPlay }: MovieModalProps) {
  // Prevent background scrolling when MovieModal is active
  useLockBodyScroll(true);
  const backdropRef = useRef<HTMLDivElement>(null);

  const [tvDetails, setTvDetails] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodesError, setEpisodesError] = useState(false);
  
  const [imdbRating, setImdbRating] = useState<string | null>(null);
  const [parentalGuide, setParentalGuide] = useState<string | null>(null);
  const [externalRatings, setExternalRatings] = useState<ExternalRating[]>([]);
  
  const [showStreamPicker, setShowStreamPicker] = useState(false);
  const [targetSeason, setTargetSeason] = useState<number | undefined>();
  const [targetEpisode, setTargetEpisode] = useState<number | undefined>();

  // Library state
  const [inLibrary, setInLibrary] = useState(false);
  const [libraryCat, setLibraryCat] = useState<LibraryCategory>("movie");
  const [showCategoryMenu, setShowCategoryMenu] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [libraryBusy, setLibraryBusy] = useState(false);

  useEffect(() => {
    const checkLib = () => {
      const item = getLibraryItem(movie.id);
      if (item) {
        setInLibrary(true);
        setLibraryCat(item.category);
      } else {
        setInLibrary(false);
        setLibraryCat(autoDetectCategory(movie));
      }
    };
    checkLib();
    const handleUpdate = () => checkLib();
    window.addEventListener("nuvio:library-updated", handleUpdate);
    return () => window.removeEventListener("nuvio:library-updated", handleUpdate);
  }, [movie]);

  const handleToggleLibrary = async (preferredCat?: LibraryCategory) => {
    const targetCat = preferredCat || libraryCat || autoDetectCategory(movie);
    setShowCategoryMenu(false);
    setLibraryBusy(true);
    try {
      if (inLibrary && !preferredCat) {
        setInLibrary(false);
        await removeFromLibrary(movie.id);
      } else {
        setInLibrary(true);
        setLibraryCat(targetCat);
        await addToLibrary(movie, targetCat);
      }
    } finally {
      setLibraryBusy(false);
    }
  };

  const title = movie.title || movie.name || "";
  const date = movie.release_date || movie.first_air_date || "";
  const genres = getGenreNames(movie.genre_ids || []);
  const isSeries = movie.media_type === "tv" || movie.media_type === "series" || (!movie.media_type && !movie.title && !!movie.name);

  useEffect(() => {
    if (isSeries) {
      fetchTvDetails(movie.id)
        .then(details => {
          setTvDetails(details);
          if (details.seasons && details.seasons.length > 0) {
            const lastSeasonId = sessionStorage.getItem("lastOpenedMovieId");
            const lastSeasonStr = sessionStorage.getItem("lastOpenedSeason");
            const lastSeason = (lastSeasonId === String(movie.id) && lastSeasonStr) ? parseInt(lastSeasonStr) : null;

            if (lastSeason) {
              setSelectedSeason(lastSeason);
            } else {
              const s1 = details.seasons.find((s: any) => s.season_number > 0);
              setSelectedSeason(s1 ? s1.season_number : details.seasons[0].season_number);
            }
          }
        })
        .catch(err => {
          console.error("Failed to fetch TV details", err);
          setEpisodesError(true);
        });
    }

    // Fetch external ID for IMDB specific APIs
    const type = isSeries ? "tv" : "movie";
    fetchExternalIds(movie.id, type).then(externalIds => {
      const imdbId = externalIds?.imdb_id;
      if (!imdbId) return;
      (movie as any).imdb_id = imdbId;

      // MDBList external ratings (IMDb, TMDB, Rotten Tomatoes, Metacritic).
      fetchExternalRatings(imdbId, type === "tv" ? "tv" : "movie")
        .then((ratings) => { if (ratings.length > 0) setExternalRatings(ratings); })
        .catch(() => {});

      if (config.imdbRatingsApiBaseUrl) {
        fetch(`${config.imdbRatingsApiBaseUrl}rating?id=${imdbId}`)
          .then(res => res.json())
          .then(data => {
            if (data?.rating) setImdbRating(data.rating);
          })
          .catch(() => {});
      }

      if (config.parentalGuideApiUrl) {
        fetch(`${config.parentalGuideApiUrl}title/${imdbId}`)
          .then(res => res.json())
          .then(data => {
            if (data?.contentRating) setParentalGuide(data.contentRating);
          })
          .catch(() => {});
      }
    }).catch(() => {});
  }, [movie.id, isSeries]);

  const loadSeason = useCallback((seasonNum: number) => {
    setLoadingEpisodes(true);
    setEpisodesError(false);
    fetchTvSeason(movie.id, seasonNum)
      .then(seasonData => {
        setEpisodes(seasonData.episodes || []);
        setLoadingEpisodes(false);
      })
      .catch(err => {
        console.error("Failed to fetch TV season", err);
        setEpisodes([]);
        setEpisodesError(true);
        setLoadingEpisodes(false);
      });
  }, [movie.id]);

  useEffect(() => {
    if (isSeries && selectedSeason !== undefined) {
      sessionStorage.setItem("lastOpenedMovieId", String(movie.id));
      sessionStorage.setItem("lastOpenedSeason", String(selectedSeason));
      loadSeason(selectedSeason);
    }
  }, [isSeries, selectedSeason, loadSeason, movie.id]);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { 
      if (e.key === "Escape") {
        if (showStreamPicker) setShowStreamPicker(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, showStreamPicker]);

  // Prevent wheel and touch scrolling on backdrop from propagating to underlying page
  useEffect(() => {
    const backdrop = backdropRef.current;
    if (!backdrop) return;
    const preventScroll = (e: WheelEvent | TouchEvent) => {
      if (e.target === backdrop) {
        e.preventDefault();
      }
    };
    backdrop.addEventListener("wheel", preventScroll, { passive: false });
    backdrop.addEventListener("touchmove", preventScroll, { passive: false });
    return () => {
      backdrop.removeEventListener("wheel", preventScroll);
      backdrop.removeEventListener("touchmove", preventScroll);
    };
  }, []);

  const handlePlayClick = (s?: number, e?: number) => {
    setTargetSeason(s);
    setTargetEpisode(e);
    setShowStreamPicker(true);
  };

  const handleStreamSelected = (stream: StreamItem) => {
    setShowStreamPicker(false);
    onPlay(movie, stream, targetSeason, targetEpisode);
  };

  return (
    <div
      ref={backdropRef}
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4 overscroll-contain"
      style={{ background: "rgba(0,0,0,0.75)", overscrollBehavior: "contain" }}
      onClick={(e) => { if (e.target === e.currentTarget && !showStreamPicker) onClose(); }}
    >
      <div
        className={`slide-up relative bg-[#1a1a1a] rounded-2xl overflow-hidden w-full max-w-3xl max-h-[90vh] overflow-y-auto overscroll-contain shadow-2xl ${showStreamPicker ? 'hidden' : ''}`}
        style={{ overscrollBehavior: "contain" }}
      >
        {/* Backdrop image */}
        <div className="relative h-80 w-full">
          {movie.backdrop_path ? (
            <img
              src={`${TMDB_IMAGE_BASE}${movie.backdrop_path}`}
              alt={title}
              className="w-full h-full object-cover"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-full h-full bg-[#222]" />
          )}
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/40 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center text-white transition-all z-10"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Action buttons overlaid on image */}
          <div className="absolute bottom-4 left-6 flex flex-wrap items-center gap-3 z-10">
            <button
              onClick={() => handlePlayClick(isSeries ? selectedSeason : undefined, isSeries ? (episodes[0]?.episode_number || 1) : undefined)}
              className="flex items-center gap-2 bg-white hover:bg-gray-200 text-black font-bold px-6 py-2.5 rounded-lg transition-all text-sm cursor-pointer shadow-lg"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
              </svg>
              {isSeries ? "Play S" + selectedSeason + " E" + (episodes[0]?.episode_number || 1) : "Play"}
            </button>

            {/* Library button with category selection & two-step remove confirmation */}
            <div className="relative inline-flex items-center">
              {/* Two-step remove confirmation popover */}
              {showRemoveConfirm && (
                <div
                  className="absolute bottom-full mb-2 left-0 bg-[#1a1a1a] border border-red-500/40 rounded-2xl p-3.5 shadow-2xl z-30 w-64 backdrop-blur-md animate-fade-in"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2 mb-1.5 text-red-400 font-bold text-xs">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    <span>Remove from Library?</span>
                  </div>
                  <p className="text-[#888] text-[11px] leading-relaxed mb-3">
                    This will remove &apos;{title}&apos; from your web library and mobile devices.
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setShowRemoveConfirm(false)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#aaa] hover:text-white bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setShowRemoveConfirm(false);
                        handleToggleLibrary();
                      }}
                      className="px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-red-600 hover:bg-red-500 shadow-md shadow-red-600/30 transition-colors cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <div
                className={`inline-flex items-stretch h-10 rounded-xl overflow-hidden backdrop-blur-md transition-all shadow-md ${
                  inLibrary
                    ? "bg-gradient-to-r from-orange-500/25 to-pink-500/25 border border-orange-500/50 shadow-orange-500/10"
                    : "bg-white/10 hover:bg-white/15 border border-white/15 hover:border-white/25"
                }`}
              >
                <button
                  onClick={() => {
                    if (inLibrary) {
                      setShowRemoveConfirm(!showRemoveConfirm);
                    } else {
                      handleToggleLibrary();
                    }
                  }}
                  disabled={libraryBusy}
                  className="flex items-center gap-2 px-4 h-full text-sm font-semibold transition-colors cursor-pointer text-white disabled:opacity-75"
                >
                  {libraryBusy ? (
                    <>
                      <svg className="animate-spin w-4 h-4 text-orange-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <span>Saving...</span>
                    </>
                  ) : inLibrary ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-orange-400 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      <span className="text-white font-semibold">In Library</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/15 text-orange-300">
                        {libraryCat}
                      </span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4 text-white shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span className="text-white font-semibold">Add to Library</span>
                    </>
                  )}
                </button>

                {/* Vertical Divider */}
                <div className={`w-[1px] my-1 ${inLibrary ? "bg-orange-500/30" : "bg-white/15"}`} />

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCategoryMenu(!showCategoryMenu);
                  }}
                  className="px-2.5 h-full flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Choose Category"
                  aria-label="Choose Category"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`w-3.5 h-3.5 transition-transform ${showCategoryMenu ? "rotate-180" : ""}`}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>

              {/* Category dropdown menu */}
              {showCategoryMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-[#1f1f1f] border border-white/15 rounded-xl shadow-2xl py-1 z-30 backdrop-blur-md">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-[#888] tracking-wider border-b border-white/5">
                    Categorize As
                  </div>
                  {[
                    { id: "movie", label: "Movie", desc: "Feature film" },
                    { id: "series", label: "TV Series", desc: "Episodic show" },
                    { id: "anime", label: "Anime", desc: "Japanese animation" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleToggleLibrary(c.id as LibraryCategory)}
                      className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${
                        inLibrary && libraryCat === c.id
                          ? "bg-orange-500/15 text-orange-400 font-bold"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <div>
                        <p className="text-xs font-semibold">{c.label}</p>
                        <p className="text-[10px] text-[#777]">{c.desc}</p>
                      </div>
                      {inLibrary && libraryCat === c.id && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5 text-orange-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-6">
          <h2 className="text-3xl font-bold text-white mb-2">{title}</h2>
          <div className="flex items-center gap-3 mb-4">
            {date && <span className="text-green-400 font-semibold text-sm">{date.slice(0, 4)}</span>}
            {movie.vote_average > 0 && !imdbRating && (
              <span className="text-yellow-400 font-semibold text-sm flex items-center gap-1">
                ★ {movie.vote_average.toFixed(1)}
              </span>
            )}
            {imdbRating && (
              <span className="text-[#f5c518] font-bold text-sm flex items-center gap-1">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                {imdbRating}
              </span>
            )}
            {parentalGuide && (
              <span className="text-[#888] text-xs font-bold border border-white/20 px-1.5 py-0.5 rounded">
                {parentalGuide}
              </span>
            )}
            {movie.original_language && (
              <span className="text-[#888] text-sm uppercase border border-white/20 px-2 py-0.5 rounded">
                {movie.original_language}
              </span>
            )}
            {isSeries && tvDetails?.number_of_seasons && (
              <span className="text-[#aaa] text-sm">
                {tvDetails.number_of_seasons} Season{tvDetails.number_of_seasons > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {genres.map((g) => (
                <span key={g} className="text-xs text-white bg-white/10 px-2.5 py-1 rounded-full border border-white/5">
                  {g}
                </span>
              ))}
            </div>
          )}

          {externalRatings.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 mb-5">
              {externalRatings.map((r) => (
                <div key={r.source} className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-[#888] font-bold">{r.source}</span>
                  <span className="text-white font-semibold text-sm">{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {movie.overview && (
            <p className="text-[#aaa] text-sm leading-relaxed mb-6 max-w-2xl">{movie.overview}</p>
          )}

          {/* Series Episode Selector */}
          {isSeries && tvDetails && (
            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-white">Episodes</h3>
                
                {/* Season Dropdown */}
                <select 
                  value={selectedSeason}
                  onChange={(e) => setSelectedSeason(Number(e.target.value))}
                  className="bg-[#222] text-white border border-white/20 rounded-lg px-3 py-1.5 text-sm outline-none"
                >
                  {tvDetails.seasons?.map((s: any) => (
                    <option key={s.id} value={s.season_number}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {loadingEpisodes ? (
                <div className="flex justify-center py-10">
                  <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                </div>
              ) : episodesError ? (
                <div className="text-center py-10">
                  <p className="text-red-400 font-semibold mb-2">Failed to load episodes.</p>
                  <button onClick={() => loadSeason(selectedSeason)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors">
                    Retry
                  </button>
                </div>
              ) : episodes.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-[#888]">No episodes available for this season.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {episodes.map((ep: any) => (
                    <div 
                      key={ep.id} 
                      onClick={() => handlePlayClick(selectedSeason, ep.episode_number)}
                      className="flex gap-4 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors group"
                    >
                      <div className="w-32 h-20 shrink-0 bg-[#222] rounded-lg overflow-hidden relative">
                        {ep.still_path ? (
                          <img
                            src={`${TMDB_IMAGE_W500}${ep.still_path}`}
                            alt={ep.name}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[#555]">No Image</div>
                        )}
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-white">
                            <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                          </svg>
                        </div>
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="text-white font-semibold text-sm">
                            {ep.episode_number}. {ep.name}
                          </h4>
                          <span className="text-[#666] text-xs whitespace-nowrap ml-2">
                            {ep.runtime ? `${ep.runtime}m` : ''}
                          </span>
                        </div>
                        <p className="text-[#888] text-xs line-clamp-2">{ep.overview}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showStreamPicker && (
        <StreamPickerModal
          tmdbId={movie.id}
          type={movie.media_type || (movie.title ? "movie" : "tv")}
          season={targetSeason}
          episode={targetEpisode}
          onClose={() => setShowStreamPicker(false)}
          onPlayStream={handleStreamSelected}
        />
      )}
    </div>
  );
}
