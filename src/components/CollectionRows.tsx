"use client";

import React, { useEffect, useRef, useState } from "react";
import { Collection, CollectionFolder, pullCollections, loadLocalCollections, normalizeGithubUrl } from "@/lib/collections";
import { TMDBMovie } from "@/lib/tmdb";
import { fetchAddons, fetchAddonManifest } from "@/lib/addons";
import { fetchCollectionCatalog, CatalogMeta } from "@/lib/catalogs";
import { fetchTmdbCollectionSource, resolveStremioIdToMovie } from "@/lib/tmdb";
import { useRouter } from "next/navigation";

let isHydrated = false;

export default function CollectionRows({ onSelectMovie }: { onSelectMovie: (m: TMDBMovie) => void }) {
  const [collections, setCollections] = useState<Collection[]>(() => {
    if (typeof window !== "undefined" && isHydrated) {
      const local = loadLocalCollections();
      if (local.length > 0) {
        return [...local].sort((a, b) => Number(b.pinToTop) - Number(a.pinToTop));
      }
    }
    return [];
  });
  const router = useRouter();

  useEffect(() => {
    isHydrated = true;
    let cancelled = false;

    // 1. Instantly load local collections after hydration
    const local = loadLocalCollections();
    if (local.length > 0) {
      setCollections([...local].sort((a, b) => Number(b.pinToTop) - Number(a.pinToTop)));
    }

    // 2. Fetch fresh collections from server in background
    (async () => {
      const data = await pullCollections();
      if (!cancelled && data && data.length > 0) {
        // Pinned collections first, preserving order otherwise.
        const ordered = [...data].sort((a, b) => Number(b.pinToTop) - Number(a.pinToTop));
        setCollections(ordered);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (collections.length === 0) return null;

  const handleFolderClick = (folder: CollectionFolder) => {
    router.push(`/collection/${encodeURIComponent(folder.id)}`);
  };

  return (
    <>
      {collections.map((col) => {
        // If viewMode is ROWS, we render each folder of this collection as a horizontal row of movies.
        if (col.viewMode === "ROWS") {
          return (
            <div key={col.id} className="mb-4">
              {col.folders?.map((folder) => (
                <FolderAsMovieRow
                  key={`${col.id}:${folder.id}`}
                  folder={folder}
                  onSelectMovie={onSelectMovie}
                />
              ))}
            </div>
          );
        }

        // Otherwise (TABBED_GRID, FOLLOW_LAYOUT, or default), we render a row of Folder Cards.
        return (
          <CollectionRow
            key={col.id}
            collection={col}
            onSelectFolder={handleFolderClick}
          />
        );
      })}
    </>
  );
}

/**
 * Renders a folder as a horizontal row of folder cards.
 */
function CollectionRow({
  collection,
  onSelectFolder,
}: {
  collection: Collection;
  onSelectFolder: (f: CollectionFolder) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => rowRef.current?.scrollBy({ left: -600, behavior: "smooth" });
  const scrollRight = () => rowRef.current?.scrollBy({ left: 600, behavior: "smooth" });

  const folders = collection.folders || [];
  if (folders.length === 0) return null;

  return (
    <div className="mb-8 relative group">
      <div className="flex items-center gap-2 mb-3 ml-1">
        <h2 className="text-white font-bold text-lg tracking-wide">{collection.title}</h2>
        <span className="text-[11px] bg-white/10 text-gray-300 font-semibold px-2 py-0.5 rounded-full border border-white/5">
          {folders.length}
        </span>
      </div>

      <div className="relative">
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <div ref={rowRef} className="flex gap-4 overflow-x-auto hide-scrollbar pb-6 pt-2 px-1">
          {folders.map((folder) => {
            const shape = folder.tileShape || "landscape";

            // Layout size classes based on tileShape
            let sizeClass = "w-60 h-[135px]"; // Default landscape
            if (shape === "wide") sizeClass = "w-80 h-[135px]";
            else if (shape === "square") sizeClass = "w-40 h-[160px]";
            else if (shape === "poster") sizeClass = "w-40 h-[240px]";

            // Count of sources in this folder
            const sourceCount = (folder.sources?.length || folder.catalogSources?.length || 0);

            return (
              <div
                key={folder.id}
                onClick={() => onSelectFolder(folder)}
                className={`row-card cursor-pointer rounded-xl relative group/card shrink-0 transition-all duration-300 hover:scale-105 hover:z-10 shadow-lg border border-white/5 hover:border-white/20 overflow-hidden ${sizeClass}`}
              >
                {/* Source count badge at top-left */}
                {sourceCount > 0 && (
                  <div className="absolute top-2 left-2 z-20 bg-black/70 backdrop-blur-md text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full border border-white/10">
                    {sourceCount}
                  </div>
                )}

                <div className="w-full h-full relative bg-gradient-to-br from-[#202020] to-[#151515] flex flex-col items-center justify-center p-3 text-center">
                  {folder.coverImageUrl ? (
                    <img
                      src={normalizeGithubUrl(folder.coverImageUrl)}
                      alt={folder.title}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      crossOrigin="anonymous"
                    />
                  ) : null}

                  {/* Gradient overlay for cover image cards */}
                  {folder.coverImageUrl && !folder.hideTitle && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent z-[1]" />
                  )}

                  {/* Render content layout */}
                  {folder.coverImageUrl ? (
                    // With Background Image: Place title at bottom left
                    !folder.hideTitle && (
                      <div className="absolute bottom-3 left-3 right-3 z-10 text-left">
                        <span className="text-white font-extrabold text-[14px] tracking-wide uppercase line-clamp-2 drop-shadow-md">
                          {folder.title}
                        </span>
                      </div>
                    )
                  ) : (
                    // Without Background Image: Centered large title
                    <div className="relative z-10 flex flex-col items-center gap-1.5 w-full justify-center h-full">
                      {folder.coverEmoji && (
                        <span className="text-3xl mb-1 filter drop-shadow-sm">{folder.coverEmoji}</span>
                      )}
                      {!folder.hideTitle && (
                        <span className="text-white font-black text-base tracking-widest uppercase line-clamp-2 px-2">
                          {folder.title}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a folder as a horizontal row of movies/shows directly on the page.
 * Used when a collection is configured with viewMode = "ROWS".
 */
function FolderAsMovieRow({
  folder,
  onSelectMovie,
}: {
  folder: CollectionFolder;
  onSelectMovie: (m: TMDBMovie) => void;
}) {
  const [metas, setMetas] = useState<CatalogMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    const loadData = async () => {
      try {
        const idToUrl = new Map<string, string>();
        const sources = (folder.sources && folder.sources.length > 0)
          ? folder.sources
          : (folder.catalogSources || []).map((c) => ({ provider: "addon", ...c }));

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
        const unique = metaLists.flat().filter((m) => {
          if (!m.id || seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        setMetas(unique);
      } catch (err) {
        console.error("Failed to load movie row", err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadData();
    return () => { active = false; };
  }, [folder]);

  const handleMovieClick = async (meta: CatalogMeta) => {
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

  const scrollLeft = () => rowRef.current?.scrollBy({ left: -600, behavior: "smooth" });
  const scrollRight = () => rowRef.current?.scrollBy({ left: 600, behavior: "smooth" });

  if (!loading && metas.length === 0) return null;

  const shape = folder.tileShape || "poster";
  const landscape = shape === "landscape" || shape === "wide";

  return (
    <div className="mb-8 relative group">
      <h2 className="text-white font-semibold text-[17px] mb-3 ml-1">{folder.title}</h2>
      <div className="relative">
        <button
          onClick={scrollLeft}
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>
        <button
          onClick={scrollRight}
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        <div ref={rowRef} className="flex gap-4 overflow-x-auto hide-scrollbar pb-6 pt-2 px-1">
          {loading ? (
            // Spinner skeleton
            <div className="flex gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`animate-pulse rounded-xl bg-white/5 shrink-0 ${landscape ? "w-60 h-[135px]" : "w-40 h-[240px]"
                    }`}
                />
              ))}
            </div>
          ) : (
            metas.map((meta) => (
              <div
                key={meta.id}
                onClick={() => handleMovieClick(meta)}
                className={`row-card cursor-pointer rounded-xl relative group/card shrink-0 transition-transform duration-300 hover:scale-105 hover:z-10 shadow-md ${landscape ? "w-60 h-[135px]" : "w-40 h-[240px]"
                  }`}
              >
                <div className="w-full h-full rounded-xl overflow-hidden relative bg-[#222]">
                  {meta.poster ? (
                    <img
                      src={normalizeGithubUrl(meta.poster)}
                      alt={meta.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      crossOrigin="anonymous"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#555] text-xs px-2 text-center">
                      {meta.name}
                    </div>
                  )}
                  {resolvingId === meta.id && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
