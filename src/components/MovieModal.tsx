"use client";

import React, { useState, useEffect, useCallback } from "react";
import { TMDB_IMAGE_BASE, TMDB_IMAGE_W500, TMDBMovie, getGenreNames, fetchTvDetails, fetchTvSeason, fetchExternalIds } from "@/lib/tmdb";
import StreamPickerModal from "./StreamPickerModal";
import { StreamItem } from "@/lib/addonService";
import { config } from "@/lib/config";

interface MovieModalProps {
  movie: TMDBMovie;
  onClose: () => void;
  onPlay: (movie: TMDBMovie, stream: StreamItem, season?: number, episode?: number) => void;
}

export default function MovieModal({ movie, onClose, onPlay }: MovieModalProps) {
  const [tvDetails, setTvDetails] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [episodesError, setEpisodesError] = useState(false);
  
  const [imdbRating, setImdbRating] = useState<string | null>(null);
  const [parentalGuide, setParentalGuide] = useState<string | null>(null);
  
  const [showStreamPicker, setShowStreamPicker] = useState(false);
  const [targetSeason, setTargetSeason] = useState<number | undefined>();
  const [targetEpisode, setTargetEpisode] = useState<number | undefined>();

  const title = movie.title || movie.name || "";
  const date = movie.release_date || movie.first_air_date || "";
  const genres = getGenreNames(movie.genre_ids || []);
  const isSeries = movie.media_type === "tv";

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
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget && !showStreamPicker) onClose(); }}
    >
      <div className={`slide-up relative bg-[#1a1a1a] rounded-2xl overflow-hidden w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl ${showStreamPicker ? 'hidden' : ''}`}>
        {/* Backdrop image */}
        <div className="relative h-80 w-full">
          {movie.backdrop_path ? (
            <img
              src={`${TMDB_IMAGE_BASE}${movie.backdrop_path}`}
              alt={title}
              className="w-full h-full object-cover"
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

          {/* Play button overlaid on image (for movies) */}
          {!isSeries && (
            <div className="absolute bottom-4 left-6 flex gap-3 z-10">
              <button
                onClick={() => handlePlayClick()}
                className="flex items-center gap-2 bg-white hover:bg-gray-200 text-black font-bold px-6 py-2.5 rounded-lg transition-all text-sm"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                </svg>
                Play
              </button>
              <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm backdrop-blur-sm">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                My List
              </button>
            </div>
          )}
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
                          <img src={`${TMDB_IMAGE_W500}${ep.still_path}`} alt={ep.name} className="w-full h-full object-cover" />
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
