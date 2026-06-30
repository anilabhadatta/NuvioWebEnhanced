"use client";

import React, { useEffect, useRef, useState } from "react";
import { Collection, pullCollections } from "@/lib/collections";
import { fetchAddons, fetchAddonManifest } from "@/lib/addons";
import { fetchCollectionCatalog, CatalogMeta } from "@/lib/catalogs";
import { resolveStremioIdToMovie, TMDBMovie } from "@/lib/tmdb";

interface FolderRow {
  key: string;
  title: string;
  tileShape: string;
  metas: CatalogMeta[];
}

/**
 * Renders the active profile's UI Collections as home rows. Each collection
 * folder becomes a row, populated from its addon catalog sources. TMDB/Trakt
 * sources are skipped here (addon catalogs cover the common case).
 *
 * Clicking a card resolves the Stremio meta id to TMDB and opens it through the
 * shared MovieModal flow via onSelectMovie.
 */
export default function CollectionRows({ onSelectMovie }: { onSelectMovie: (m: TMDBMovie) => void }) {
  const [rows, setRows] = useState<FolderRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const collections: Collection[] = await pullCollections();
      if (collections.length === 0) return;

      // Pre-scan collections: do we actually have ANY addon sources?
      // If not, we completely skip fetching addons and manifests to prevent network spam.
      const hasAddonSources = collections.some((c) =>
        (c.folders || []).some((f) => {
          const sources = (f.sources && f.sources.length > 0)
            ? f.sources.filter((s) => !s.provider || s.provider === "addon")
            : (f.catalogSources || []);
          return sources.length > 0;
        })
      );

      const idToUrl = new Map<string, string>();
      if (hasAddonSources) {
        // Build a manifest-id → addon URL map so collection sources (which use the
        // manifest id) can be resolved to a fetchable catalog URL.
        const addons = await fetchAddons();
        await Promise.all(
          addons.map(async (a) => {
            const manifest = a.manifest || (await fetchAddonManifest(a.url));
            if (manifest?.id) idToUrl.set(manifest.id, a.url);
          }),
        );
      }

      // Pinned collections first, preserving order otherwise.
      const ordered = [...collections].sort((a, b) => Number(b.pinToTop) - Number(a.pinToTop));

      const built: FolderRow[] = [];
      for (const collection of ordered) {
        for (const folder of collection.folders || []) {
          const sources = (folder.sources && folder.sources.length > 0)
            ? folder.sources.filter((s) => !s.provider || s.provider === "addon")
            : (folder.catalogSources || []).map((c) => ({ provider: "addon", ...c }));

          const metaLists = await Promise.all(
            sources.map((s) => {
              const url = s.addonId ? idToUrl.get(s.addonId) : undefined;
              if (!url || !s.type || !s.catalogId) return Promise.resolve([] as CatalogMeta[]);
              return fetchCollectionCatalog(url, s.type, s.catalogId, (s as any).genre);
            }),
          );

          const seen = new Set<string>();
          const metas = metaLists.flat().filter((m) => {
            if (!m.id || seen.has(m.id)) return false;
            seen.add(m.id);
            return true;
          });

          if (metas.length > 0) {
            built.push({
              key: `${collection.id}:${folder.id}`,
              title: folder.title,
              tileShape: folder.tileShape || "poster",
              metas,
            });
          }
        }
      }

      if (!cancelled) setRows(built);
    })();

    return () => { cancelled = true; };
  }, []);

  if (rows.length === 0) return null;

  return (
    <>
      {rows.map((row) => (
        <CollectionRow key={row.key} row={row} onSelectMovie={onSelectMovie} />
      ))}
    </>
  );
}

function CollectionRow({ row, onSelectMovie }: { row: FolderRow; onSelectMovie: (m: TMDBMovie) => void }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const landscape = row.tileShape === "landscape" || row.tileShape === "wide";

  const handleClick = async (meta: CatalogMeta) => {
    setResolving(meta.id);
    const movie = await resolveStremioIdToMovie(meta.id, meta.type);
    setResolving(null);
    if (movie) onSelectMovie(movie);
  };

  const scrollLeft = () => rowRef.current?.scrollBy({ left: -600, behavior: "smooth" });
  const scrollRight = () => rowRef.current?.scrollBy({ left: 600, behavior: "smooth" });

  return (
    <div className="mb-8 relative group">
      <h2 className="text-white font-semibold text-[17px] mb-3 ml-1">{row.title}</h2>
      <div className="relative">
        <button onClick={scrollLeft} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        </button>
        <button onClick={scrollRight} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 border border-white/20 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
        </button>

        <div ref={rowRef} className="flex gap-4 overflow-x-auto hide-scrollbar pb-6 pt-2 px-1">
          {row.metas.map((meta) => (
            <div
              key={meta.id}
              onClick={() => handleClick(meta)}
              className={`row-card cursor-pointer rounded-xl relative group/card shrink-0 transition-transform duration-300 hover:scale-105 hover:z-10 shadow-md ${landscape ? "w-60 h-[135px]" : "w-40 h-[240px]"}`}
            >
              <div className="w-full h-full rounded-xl overflow-hidden relative bg-[#222]">
                {meta.poster ? (
                  <img src={meta.poster} alt={meta.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#555] text-xs px-2 text-center">{meta.name}</div>
                )}
                {resolving === meta.id && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
