"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { TMDB_IMAGE_BASE, TMDB_IMAGE_W500, TMDBMovie, getGenreNames } from "@/lib/tmdb";

interface MovieModalProps {
  movie: TMDBMovie;
  onClose: () => void;
  onPlay: (movie: TMDBMovie) => void;
}

export default function MovieModal({ movie, onClose, onPlay }: MovieModalProps) {
  const title = movie.title || movie.name || "";
  const date = movie.release_date || movie.first_air_date || "";
  const genres = getGenreNames(movie.genre_ids || []);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="slide-up relative bg-[#1a1a1a] rounded-2xl overflow-hidden w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Backdrop image */}
        <div className="relative h-72 w-full">
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-[#1a1a1a]/30 to-transparent" />

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20 rounded-full flex items-center justify-center text-white transition-all"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Play button overlaid on image */}
          <div className="absolute bottom-4 left-5 flex gap-3">
            <button
              onClick={() => onPlay(movie)}
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
        </div>

        {/* Details */}
        <div className="p-5">
          <h2 className="text-2xl font-bold text-white mb-1">{title}</h2>
          <div className="flex items-center gap-3 mb-4">
            {date && <span className="text-green-400 font-semibold text-sm">{date.slice(0, 4)}</span>}
            {movie.vote_average > 0 && (
              <span className="text-yellow-400 font-semibold text-sm flex items-center gap-1">
                ★ {movie.vote_average.toFixed(1)}
              </span>
            )}
            {movie.original_language && (
              <span className="text-[#888] text-sm uppercase border border-white/20 px-2 py-0.5 rounded">
                {movie.original_language}
              </span>
            )}
          </div>

          {genres.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {genres.map((g) => (
                <span key={g} className="text-xs text-white bg-white/10 px-2.5 py-1 rounded-full">
                  {g}
                </span>
              ))}
            </div>
          )}

          {movie.overview && (
            <p className="text-[#aaa] text-sm leading-relaxed">{movie.overview}</p>
          )}
        </div>
      </div>
    </div>
  );
}
