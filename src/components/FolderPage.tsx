"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { pullCollections, loadLocalCollections, Collection, CollectionFolder, CollectionSource } from "@/lib/collections";
import { fetchTmdbCollectionSourcePage, fetchTmdbCollectionSource, resolveStremioIdToMovie, TMDBMovie, sanitizeImageUrl } from "@/lib/tmdb";
import { fetchAddons, fetchAddonManifest } from "@/lib/addons";
import { fetchCollectionCatalog, CatalogMeta } from "@/lib/catalogs";
import MovieModal from "@/components/MovieModal";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TabState {
  metas: CatalogMeta[];
  page: number;
  totalPages: number;
  loading: boolean;
  loadingMore: boolean;
  loaded: boolean;
}

const INITIAL_TAB: TabState = {
  metas: [],
  page: 0,
  totalPages: 1,
  loading: false,
  loadingMore: false,
  loaded: false,
};

// Special index for the "All" tab
const ALL_TAB = -1;

// ─── Source resolver ──────────────────────────────────────────────────────────

/** Returns whether a source is TMDB-backed (supports pagination) or addon-backed (one-shot). */
function isTmdbSource(source: any): boolean {
  const provider = (source.provider || "tmdb").toLowerCase();
  return provider === "tmdb" || !!source.tmdbSourceType;
}

async function resolveSourcePage(
  source: CollectionSource & Record<string, any>,
  idToUrl: Map<string, string>,
  page: number,
): Promise<{ items: CatalogMeta[]; totalPages: number }> {
  const provider = (source.provider || "tmdb").toLowerCase();
  if (provider === "trakt") return { items: [], totalPages: 0 };

  if (isTmdbSource(source)) {
    const { items, totalPages } = await fetchTmdbCollectionSourcePage(source, page);
    return { items, totalPages };
  }

  // Addon-backed: one-shot, no pagination
  const url = source.addonId ? idToUrl.get(source.addonId) : undefined;
  if (!url || !source.type || !source.catalogId) return { items: [], totalPages: 0 };
  const items = await fetchCollectionCatalog(url, source.type, source.catalogId, (source as any).genre);
  return { items, totalPages: 1 };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FolderPage() {
  const params = useParams();
  const router = useRouter();
  const folderId = params?.folderId as string;

  const [folder, setFolder] = useState<CollectionFolder | null>(null);
  const [collectionTitle, setCollectionTitle] = useState<string>("");
  const [activeTabIdx, setActiveTabIdx] = useState<number>(ALL_TAB);
  const [tabStates, setTabStates] = useState<Record<number, TabState>>({});
  const [idToUrl, setIdToUrl] = useState<Map<string, string>>(new Map());
  const [addonsResolved, setAddonsResolved] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  const tabContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchedTabsRef = useRef<Set<number>>(new Set());

  // Restore scroll and movie on mount
  useEffect(() => {
    const lastMovie = sessionStorage.getItem("lastOpenedMovie");
    if (lastMovie) {
      try { setSelectedMovie(JSON.parse(lastMovie)); } catch(e) {}
    }
    
    requestAnimationFrame(() => setMounted(true));
    
    // Restore scroll position slightly after mount to ensure DOM is ready
    setTimeout(() => {
      const savedScroll = sessionStorage.getItem(`nuvio_folder_scroll_${folderId}`);
      if (savedScroll) {
        window.scrollTo({ top: parseInt(savedScroll, 10), behavior: "instant" });
        sessionStorage.removeItem(`nuvio_folder_scroll_${folderId}`); // Clean up
      }
    }, 100);
  }, [folderId]);

  const handleSelectMovie = useCallback((m: TMDBMovie | null) => {
    setSelectedMovie(m);
    if (m) {
      sessionStorage.setItem("lastOpenedMovie", JSON.stringify(m));
    } else {
      sessionStorage.removeItem("lastOpenedMovie");
    }
  }, []);

  // ── Find the folder ──────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    const findFolder = async () => {
      const processCollections = async (collections: Collection[]) => {
        for (const col of collections) {
          for (const f of col.folders || []) {
            if (f.id === folderId) {
              if (!active) return true;
              setFolder(f);
              setCollectionTitle(col.title);
  
              const needsAddon = (f.sources || []).some(
                (s) => !s.provider || (s.provider as string) === "addon",
              );
              if (needsAddon && idToUrl.size === 0) {
                const addons = await fetchAddons();
                const map = new Map<string, string>();
                await Promise.all(
                  addons.map(async (a) => {
                    const manifest = a.manifest || (await fetchAddonManifest(a.url));
                    if (manifest?.id) map.set(manifest.id, a.url);
                  }),
                );
                if (active) {
                  setIdToUrl(map);
                  setAddonsResolved(true);
                }
              } else if (active) {
                setAddonsResolved(true);
              }
  
              // Restore tab state from session storage
              const savedTabs = sessionStorage.getItem(`nuvio_folder_tabs_${folderId}`);
              if (savedTabs) {
                try { 
                  const parsed = JSON.parse(savedTabs);
                  // Sanitize: clear stuck loading states from previous crashed sessions
                  Object.keys(parsed).forEach(k => {
                    parsed[k].loading = false;
                    parsed[k].loadingMore = false;
                  });
                  setTabStates((prev) => Object.keys(prev).length > 0 ? prev : parsed); 
                } catch(e) {}
              }
              const savedActiveTab = sessionStorage.getItem(`nuvio_folder_activeTab_${folderId}`);
              if (savedActiveTab) {
                setActiveTabIdx(parseInt(savedActiveTab, 10));
              }
              return true;
            }
          }
        }
        return false;
      };

      const localCollections = loadLocalCollections();
      if (localCollections.length > 0) {
        await processCollections(localCollections);
      }

      // Fetch fresh in background
      const freshCollections = await pullCollections();
      if (active) {
        await processCollections(freshCollections);
      }
    };
    findFolder();
    return () => { active = false; };
  }, [folderId]);

  const sources = (folder?.sources || []).filter(
    (s) => (s.provider as string) !== "trakt",
  );

  // ── Tab state helpers ────────────────────────────────────────────────────
  const setTabState = useCallback((idx: number, patch: Partial<TabState>) => {
    setTabStates((prev) => {
      const next = {
        ...prev,
        [idx]: { ...(prev[idx] || INITIAL_TAB), ...patch },
      };
      // Persist to session storage
      sessionStorage.setItem(`nuvio_folder_tabs_${folderId}`, JSON.stringify(next));
      return next;
    });
  }, [folderId]);

  // ── Load a specific source tab (paginated) ────────────────────────────────
  const loadSourceTab = useCallback(
    async (idx: number, reset = false) => {
      if (idx < 0 || idx >= sources.length) return;
      const current = tabStates[idx] || INITIAL_TAB;

      if (!reset && current.loaded && current.page >= current.totalPages) return;
      if (!reset && (current.loading || current.loadingMore)) return;

      const nextPage = reset ? 1 : current.page + 1;
      const isFirstLoad = reset || !current.loaded;

      setTabState(idx, isFirstLoad ? { loading: true } : { loadingMore: true });

      try {
        const { items, totalPages } = await resolveSourcePage(sources[idx] as any, idToUrl, nextPage);

        setTabStates((prev) => {
          const existing = prev[idx] || INITIAL_TAB;
          const existingIds = new Set(existing.metas.map((m) => m.id));
          const newItems = items.filter((m) => !existingIds.has(m.id));
          return {
            ...prev,
            [idx]: {
              metas: isFirstLoad ? items : [...existing.metas, ...newItems],
              page: nextPage,
              totalPages: totalPages || 1,
              loading: false,
              loadingMore: false,
              loaded: true,
            },
          };
        });
      } catch {
        setTabState(idx, { loading: false, loadingMore: false });
      }
    },
    [sources, idToUrl, tabStates, setTabState],
  );

  // ── Load "All" tab — fetches sources one by one in a circular manner ──────
  const loadAllTab = useCallback(
    async (reset = false) => {
      const current = tabStates[ALL_TAB] || INITIAL_TAB;
      if (!reset && current.loaded && current.page >= current.totalPages) return;
      if (!reset && (current.loading || current.loadingMore)) return;

      const nextPage = reset ? 1 : current.page + 1;
      const isFirstLoad = reset || !current.loaded;

      setTabState(ALL_TAB, isFirstLoad ? { loading: true } : { loadingMore: true });
      try {
        // Circular logic: nextPage = 1 -> source 0 page 1. nextPage = 2 -> source 1 page 1.
        const sourceIndex = (nextPage - 1) % sources.length;
        const sourcePage = Math.floor((nextPage - 1) / sources.length) + 1;
        const source = sources[sourceIndex];

        // Fetch just this ONE source's page to keep it extremely fast
        const res = await resolveSourcePage(source as any, idToUrl, sourcePage);
        
        // Virtually infinite scrolling (e.g. 50 pages deep per source max)
        const maxTotalPages = sources.length * 50;

        setTabStates((prev) => {
          const existing = prev[ALL_TAB] || INITIAL_TAB;
          const existingIds = new Set(existing.metas.map((m) => m.id));
          const newItems = res.items.filter((m) => !existingIds.has(m.id));
          
          return {
            ...prev,
            [ALL_TAB]: {
              metas: isFirstLoad ? newItems : [...existing.metas, ...newItems],
              page: nextPage,
              totalPages: maxTotalPages,
              loading: false,
              loadingMore: false,
              loaded: true,
            },
          };
        });
      } catch {
        setTabState(ALL_TAB, { loading: false, loadingMore: false });
      }
    },
    [sources, idToUrl, tabStates, setTabState],
  );

  // ── Bootstrap: set initial active tab when folder is ready ───────────────
  useEffect(() => {
    if (sources.length > 0 && folder && Object.keys(tabStates).length === 0) {
      setActiveTabIdx(ALL_TAB);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, sources.length]);

  // ── Load active tab content ──────────────────────────────────────────────
  useEffect(() => {
    if (!folder || sources.length === 0) return;

    const needsAddon = sources.some(
      (s: any) => !s.provider || (s.provider as string) === "addon"
    );
    if (needsAddon && !addonsResolved) {
      return; // Wait for addon URLs to resolve before fetching
    }

    // If we've already initiated a fetch for this tab in this session, skip.
    if (fetchedTabsRef.current.has(activeTabIdx)) {
      return;
    }

    const currentTabState = tabStates[activeTabIdx];
    // Only skip fetching if we legitimately have cached data. If it was stuck loading and empty, force a re-fetch.
    if (currentTabState?.loaded && currentTabState.metas.length > 0) {
      fetchedTabsRef.current.add(activeTabIdx);
      return;
    }

    fetchedTabsRef.current.add(activeTabIdx);

    if (activeTabIdx === ALL_TAB) {
      loadAllTab(true);
    } else {
      loadSourceTab(activeTabIdx, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabIdx, folder, idToUrl, loadAllTab, loadSourceTab, sources.length, addonsResolved]);

  // ── IntersectionObserver for infinite scroll ─────────────────────────────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        const tab = tabStates[activeTabIdx] || INITIAL_TAB;
        if (!tab.loading && !tab.loadingMore && tab.loaded && tab.page < tab.totalPages) {
          if (activeTabIdx === ALL_TAB) {
            loadAllTab();
          } else {
            loadSourceTab(activeTabIdx);
          }
        }
      },
      { rootMargin: "1200px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [activeTabIdx, tabStates, loadAllTab, loadSourceTab]);

  // ── Tab click handler ────────────────────────────────────────────────────
  const handleTabClick = useCallback(
    (idx: number) => {
      setActiveTabIdx(idx);
      sessionStorage.setItem(`nuvio_folder_activeTab_${folderId}`, String(idx));
      // Scroll tab into view
      setTimeout(() => {
        const el = tabContainerRef.current?.querySelector(
          `[data-tab="${idx}"]`,
        ) as HTMLElement | null;
        el?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }, 50);

      if (idx === ALL_TAB) {
        loadAllTab();
      } else {
        const tab = tabStates[idx] || INITIAL_TAB;
        if (!tab.loaded) loadSourceTab(idx, true);
      }
    },
    [tabStates, loadAllTab, loadSourceTab],
  );

  // ── Card click ───────────────────────────────────────────────────────────
  const handleCardClick = async (meta: CatalogMeta) => {
    setResolvingId(meta.id);
    const movie = await resolveStremioIdToMovie(meta.id, meta.type);
    setResolvingId(null);
    if (movie) handleSelectMovie(movie);
  };

  // ── Derived display state ────────────────────────────────────────────────
  const currentTabState = tabStates[activeTabIdx] || INITIAL_TAB;
  const currentMetas = currentTabState.metas;
  const currentLoading = currentTabState.loading;
  const currentLoadingMore = currentTabState.loadingMore;
  const hasMore =
    currentTabState.loaded &&
    currentTabState.page < currentTabState.totalPages;

  // ── Render ───────────────────────────────────────────────────────────────
  if (!folder) {
    return (
      <div className="min-h-screen bg-[#111] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white/10 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#111] text-white flex flex-col"
      style={{
        opacity: mounted ? 1 : 0,
        transition: "opacity 0.35s ease",
      }}
    >
      {/* ── Hero backdrop ─────────────────────────────────────────────────── */}
      <div className="relative h-[40vh] min-h-[260px] overflow-hidden flex-shrink-0">
        {folder.heroBackdropUrl ? (
          <img
            src={folder.heroBackdropUrl}
            alt={folder.title}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : folder.coverImageUrl ? (
          <img
            src={folder.coverImageUrl}
            alt={folder.title}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#111]" />
        )}

        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#111]/70 via-transparent to-transparent" />

        {/* Top nav */}
        <div className="absolute top-0 left-0 right-0 flex items-center gap-3 px-5 py-4 z-10">
          <button
            onClick={() => router.back()}
            className="folder-back-btn flex items-center gap-2 text-white font-medium text-sm"
            style={{
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "999px",
              padding: "8px 16px",
              cursor: "pointer",
              transition: "background 0.2s ease, transform 0.15s ease",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.12)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(0,0,0,0.35)"; }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 16, height: 16 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          <span className="text-white/40 text-sm font-medium truncate">{collectionTitle}</span>
        </div>

        {/* Folder identity */}
        <div className="absolute bottom-7 left-5 right-5 z-10 flex items-end gap-4">
          {folder.titleLogoUrl ? (
            <img
              src={folder.titleLogoUrl}
              alt={folder.title}
              className="h-12 max-w-[240px] object-contain drop-shadow-2xl"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <h1 className="text-3xl font-black tracking-tight drop-shadow-2xl">
              {folder.coverEmoji && <span className="mr-3">{folder.coverEmoji}</span>}
              {folder.title}
            </h1>
          )}
          {sources.length > 0 && (
            <span className="text-white/40 text-xs mb-0.5">
              {sources.length} source{sources.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 border-b border-white/8"
        style={{ background: "rgba(17,17,17,0.96)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}
      >
        <div ref={tabContainerRef} className="flex gap-1 overflow-x-auto hide-scrollbar px-5 py-2.5">
          {/* All tab */}
          <button
            data-tab={ALL_TAB}
            onClick={() => handleTabClick(ALL_TAB)}
            className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
            style={{
              background: activeTabIdx === ALL_TAB ? "#fff" : "transparent",
              color: activeTabIdx === ALL_TAB ? "#000" : "rgba(255,255,255,0.55)",
              transition: "background 0.2s ease, color 0.2s ease",
            }}
          >
            All
          </button>

          {sources.map((source, idx) => (
            <button
              key={idx}
              data-tab={idx}
              onClick={() => handleTabClick(idx)}
              className="shrink-0 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
              style={{
                background: activeTabIdx === idx ? "#fff" : "transparent",
                color: activeTabIdx === idx ? "#000" : "rgba(255,255,255,0.55)",
                transition: "background 0.2s ease, color 0.2s ease",
              }}
            >
              {(source as any).title || `Source ${idx + 1}`}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content grid ─────────────────────────────────────────────────── */}
      <div className="flex-1 px-5 py-6">
        {(currentLoading || (currentLoadingMore && currentMetas.length === 0)) ? (
          /* Skeleton grid */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : currentMetas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-white/30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125a1.125 1.125 0 01-1.125-1.125v-1.5c0-.621.504-1.125 1.125-1.125m17.25 2.625h-1.5a1.125 1.125 0 00-1.125 1.125M19.5 19.5h.375A1.125 1.125 0 0021 18.375M21 18.375v-1.5a1.125 1.125 0 00-1.125-1.125M3.375 15.75V6a1.125 1.125 0 011.125-1.125h15a1.125 1.125 0 011.125 1.125v9.75" />
              </svg>
            </div>
            <p className="text-white/50 font-semibold">No content available for this tab</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
            {currentMetas.map((meta) => (
              <div
                key={meta.id}
                onClick={() => handleCardClick(meta)}
                className="group cursor-pointer"
              >
                <div
                  className="aspect-[2/3] rounded-xl overflow-hidden relative shadow-lg bg-[#1a1a1a]"
                  style={{ transition: "transform 0.25s ease, box-shadow 0.25s ease" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "scale(1.05)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "0 20px 40px rgba(0,0,0,0.7)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.transform = "scale(1)";
                    (e.currentTarget as HTMLElement).style.boxShadow = "";
                  }}
                >
                  {meta.poster ? (
                    <img
                      src={sanitizeImageUrl(meta.poster)}
                      alt={meta.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-3 text-center">
                      <p className="text-white/40 text-xs font-semibold">{meta.name}</p>
                    </div>
                  )}

                  {/* Hover overlay */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-end p-3 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                    <p className="text-white text-xs font-semibold line-clamp-2">{meta.name}</p>
                  </div>

                  {resolvingId === meta.id && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel + loading indicator */}
        <div ref={sentinelRef} className="h-px w-full mt-4" />

        {currentLoadingMore && currentMetas.length > 0 && (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          </div>
        )}

        {!hasMore && currentTabState.loaded && currentMetas.length > 0 && (
          <p className="text-center text-white/20 text-xs py-6">
            All {currentMetas.length} items loaded
          </p>
        )}
      </div>

      {/* ── Movie Modal ───────────────────────────────────────────────────── */}
      {selectedMovie && (
        <MovieModal
          movie={selectedMovie}
          onClose={() => handleSelectMovie(null)}
          onPlay={(movie, stream, season, episode) => {
            // Save scroll position before navigating away
            sessionStorage.setItem(`nuvio_folder_scroll_${folderId}`, String(window.scrollY));
            
            const url = stream.url ? encodeURIComponent(stream.url) : "";
            const tmdbId = movie.id;
            const type = movie.media_type || (movie.title ? "movie" : "tv");
            let route = `/player?id=${tmdbId}&type=${type}&url=${url}`;
            if (stream.infoHash) route += `&hash=${stream.infoHash}`;
            if (season && episode) route += `&s=${season}&e=${episode}`;
            try {
              if (stream.addonUrl) sessionStorage.setItem("nuvio.currentAddonUrl", stream.addonUrl);
              else sessionStorage.removeItem("nuvio.currentAddonUrl");
            } catch { /* ok */ }
            window.location.href = route;
          }}
        />
      )}
    </div>
  );
}
