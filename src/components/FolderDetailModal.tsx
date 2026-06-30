"use client";

import React, { useEffect, useState } from "react";
import { CollectionFolder } from "@/lib/collections";
import { fetchAddons, fetchAddonManifest } from "@/lib/addons";
import { fetchCollectionCatalog, CatalogMeta } from "@/lib/catalogs";
import { fetchTmdbCollectionSource, TMDBMovie, resolveStremioIdToMovie } from "@/lib/tmdb";

interface FolderDetailModalProps {
  folder: CollectionFolder;
  onClose: () => void;
  onSelectMovie: (movie: TMDBMovie) => void;
}

export default function FolderDetailModal({ folder, onClose, onSelectMovie }: FolderDetailModalProps) {
  const [metas, setMetas] = useState<CatalogMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    const loadMetas = async () => {
      try {
        const idToUrl = new Map<string, string>();
        const sources = (folder.sources && folder.sources.length > 0)
          ? folder.sources
          : (folder.catalogSources || []).map((c) => ({ provider: "addon", ...c }));

        // Check if we need addon manifests
        const hasAddonSources = sources.some((s) => !s.provider || s.provider === "addon");
        if (hasAddonSources) {
          const addons = await fetchAddons();
          await Promise.all(
            addons.map(async (a) => {
              const manifest = a.manifest || (await fetchAddonManifest(a.url));
              if (manifest?.id) idToUrl.set(manifest.id, a.url);
            }),
          );
        }

        const metaLists = await Promise.all(
          sources.map(async (s: any) => {
            if (s.provider === "tmdb" || s.tmdbSourceType || (!s.provider && !s.addonId && !s.catalogId)) {
              return fetchTmdbCollectionSource(s);
            }
            const url = s.addonId ? idToUrl.get(s.addonId) : undefined;
            if (!url || !s.type || !s.catalogId) return [];
            return fetchCollectionCatalog(url, s.type, s.catalogId, s.genre);
          }),
        );

        if (!active) return;

        const seen = new Set<string>();
        const uniqueMetas = metaLists.flat().filter((m) => {
          if (!m.id || seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });

        setMetas(uniqueMetas);
      } catch (err) {
        console.error("Failed to load folder metas", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadMetas();
    return () => { active = false; };
  }, [folder]);

  const handleCardClick = async (meta: CatalogMeta) => {
    setResolvingId(meta.id);
    try {
      const movie = await resolveStremioIdToMovie(meta.id, meta.type);
      if (movie) onSelectMovie(movie);
    } catch (e) {
      console.error(e);
    } finally {
      setResolvingId(null);
    }
  };

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative bg-[#181818] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-white/10 bg-[#202020]">
          <div className="flex items-center gap-3">
            {folder.coverEmoji && <span className="text-2xl">{folder.coverEmoji}</span>}
            <h2 className="text-xl font-bold text-white">{folder.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mb-4" />
              <p className="text-gray-400 text-sm">Loading items...</p>
            </div>
          ) : metas.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-400 font-semibold mb-1">No content found in this folder.</p>
              <p className="text-gray-600 text-xs max-w-md">Verify that your TMDB API keys and configured addons are active and configured correctly.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {metas.map((meta) => (
                <div
                  key={meta.id}
                  onClick={() => handleCardClick(meta)}
                  className="cursor-pointer relative group flex flex-col rounded-xl overflow-hidden bg-[#222] transition-transform duration-300 hover:scale-105 hover:z-10 shadow-lg"
                >
                  {/* Poster image wrapper */}
                  <div className="aspect-[2/3] w-full relative bg-[#333]">
                    {meta.poster ? (
                      <img
                        src={meta.poster}
                        alt={meta.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-center p-3 text-xs text-gray-500 font-semibold">
                        {meta.name}
                      </div>
                    )}
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-end p-3 transition-opacity">
                      <p className="text-white text-xs font-semibold line-clamp-2">{meta.name}</p>
                    </div>

                    {resolvingId === meta.id && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
