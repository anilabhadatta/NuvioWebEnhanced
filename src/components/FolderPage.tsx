"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { pullCollections, loadLocalCollections, Collection, CollectionFolder, CollectionSource, normalizeGithubUrl } from "@/lib/collections";
import { fetchTmdbCollectionSourcePage, fetchTmdbCollectionSource, resolveStremioIdToMovie, TMDBMovie } from "@/lib/tmdb";
import { fetchAddons, fetchAddonManifest } from "@/lib/addons";
import { fetchCollectionCatalog, CatalogMeta } from "@/lib/catalogs";
import MovieModal from "@/components/MovieModal";
import { getDynamicSystemCollections } from "@/lib/defaultCollections";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface TabState {
  metas: CatalogMeta[];
  page: number;
  totalPages: number;
  nextSkip: number;
  loading: boolean;
  loadingMore: boolean;
  loaded: boolean;
}

const INITIAL_TAB: TabState = {
  metas: [],
  page: 0,
  totalPages: 1,
  nextSkip: 0,
  loading: false,
  loadingMore: false,
  loaded: false,
};

// Special index for the "All" tab
const ALL_TAB = -1;

// ——————————————————————————————————————————————————————————————————————————————————————————————————

/** Returns whether a source is TMDB-backed (supports pagination) or addon-backed (one-shot). */
function isTmdbSource(source: any): boolean {
  const provider = (source.provider || "tmdb").toLowerCase();
  return provider === "tmdb" || !!source.tmdbSourceType;
}

async function resolveSourcePage(
  source: CollectionSource & Record<string, any>,
  idToUrl: Map<string, string>,
  page: number,
  currentSkip: number,
): Promise<{ items: CatalogMeta[]; totalPages: number; nextSkip: number }> {
  let config = { ...source };
  const provider = (config.provider || "tmdb").toLowerCase();
  if (provider === "trakt") return { items: [], totalPages: 0, nextSkip: 0 };

  if (isTmdbSource(source)) {
    const { items, totalPages } = await fetchTmdbCollectionSourcePage(source, page);
    return { items, totalPages, nextSkip: page + 1 };
  }

  // Addon-backed
  let url = config.url || (config.addonId ? idToUrl.get(config.addonId) : undefined);

  if (url && url.includes("v3-cinemeta.strem.io")) {
    if (config.catalogId === "imdbRating" || config.catalogId === "featured") {
      url = "https://cinemeta-catalogs.strem.io/imdbRating/manifest.json";
      config.catalogId = "imdbRating";
    } else {
      url = "https://cinemeta-catalogs.strem.io/top/manifest.json";
      config.catalogId = "top";
    }
  }

  if (!url || !config.type || !config.catalogId) return { items: [], totalPages: 0, nextSkip: 0 };

  try {
    const items = await fetchCollectionCatalog(url, config.type, config.catalogId, (config as any).genre, currentSkip);
    const hasMore = items.length > 0;
    return {
      items,
      totalPages: hasMore ? page + 1 : page,
      nextSkip: currentSkip + items.length,
    };
  } catch (e) {
    return { items: [], totalPages: 0, nextSkip: 0 };
  }
}

// â”€â”€â”€ Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const H_EXPANDED = 260;
const H_COLLAPSED = 104;

function FolderHeader({
  folder,
  sources,
  collectionTitle,
  activeTabIdx,
  handleTabClick,
  tabContainerRef,
}: {
  folder: CollectionFolder;
  sources: CollectionSource[];
  collectionTitle: string;
  activeTabIdx: number;
  handleTabClick: (idx: number) => void;
  tabContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const router = useRouter();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollRange = H_EXPANDED - H_COLLAPSED;
  const progress = Math.min(1, Math.max(0, scrollY / scrollRange));
  const headerHeight = H_EXPANDED - progress * (H_EXPANDED - H_COLLAPSED);

  const isAddonFolder = folder.id.startsWith("sys_") || folder.id.includes(":");

  return (
    <div
      className="fixed top-0 left-0 right-0 z-20 overflow-hidden"
      style={{
        height: `${headerHeight}px`,
        background: "#111",
        borderBottom: `1px solid rgba(255, 255, 255, ${progress * 0.08})`,
      }}
    >
      {/* Backdrop Image or Gradient */}
      <div 
        className="absolute inset-0 transition-opacity duration-300"
        style={{ 
          opacity: 1 - progress * 0.7,
          filter: `blur(${progress * 8}px)`,
        }}
      >
        {folder.heroBackdropUrl ? (
          <img
            src={normalizeGithubUrl(folder.heroBackdropUrl)}
            alt={folder.title}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : folder.coverImageUrl ? (
          <img
            src={normalizeGithubUrl(folder.coverImageUrl)}
            alt={folder.title}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#111]" />
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-black/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#111]/70 via-transparent to-transparent" />
      </div>

      {/* Glassmorphic Solid Color Overlay that fades in as we scroll */}
      <div
        className="absolute inset-0"
        style={{
          background: `rgba(17, 17, 17, ${progress * 0.96})`,
          backdropFilter: progress > 0 ? `blur(${progress * 16}px)` : "none",
          WebkitBackdropFilter: progress > 0 ? `blur(${progress * 16}px)` : "none",
        }}
      />

      {/* Row 1: Top Nav (Back Button, Mini Title/Logo, Collection Title) */}
      <div className="absolute top-0 left-0 right-0 h-14 flex items-center justify-between px-5 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => { router.push("/dashboard"); }}
            className="folder-back-btn flex items-center gap-2 text-white font-medium text-xs px-3 py-1.5 bg-black/35 hover:bg-white/12 border border-white/12 rounded-full transition-all cursor-pointer"
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3.5 h-3.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            Back
          </button>
          
          {/* Mini Title/Logo (fades in as we scroll) */}
          <div 
            className="flex items-center gap-2 min-w-0 transition-all duration-300"
            style={{
              opacity: progress,
              transform: `translateY(${(1 - progress) * 8}px)`,
              pointerEvents: progress > 0.5 ? "auto" : "none",
            }}
          >
            {folder.titleLogoUrl ? (
              <img
                src={normalizeGithubUrl(folder.titleLogoUrl)}
                alt={folder.title}
                className="h-5 max-w-[120px] object-contain drop-shadow-md"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            ) : (
              <span className="font-extrabold text-sm tracking-tight truncate">
                {folder.coverEmoji && <span className="mr-1">{folder.coverEmoji}</span>}
                {folder.title}
              </span>
            )}
            {sources.length > 0 && (
              <span className="text-white/30 text-[10px] whitespace-nowrap hidden sm:inline">
                • {sources.length} source{sources.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
        
        <span className="text-white/40 text-xs font-medium truncate ml-4">{collectionTitle}</span>
      </div>

      {/* Large Folder Identity (fades out as we scroll) */}
      <div 
        className="absolute left-5 right-5 z-10 flex items-end gap-4 pointer-events-none"
        style={{
          bottom: "64px", // sits right above the tabs
          opacity: Math.max(0, 1 - progress * 1.8),
          transform: `translateY(${progress * -15}px) scale(${1 - progress * 0.05})`,
          transformOrigin: "left bottom",
        }}
      >
        {folder.titleLogoUrl ? (
          <img
            src={normalizeGithubUrl(folder.titleLogoUrl)}
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
          <span className="text-white/40 text-xs mb-0.5 whitespace-nowrap">
            {sources.length} source{sources.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Row 2: Tab buttons container (positioned at bottom of the header) */}
      <div 
        ref={tabContainerRef} 
        className="absolute bottom-0 left-0 right-0 flex gap-1 overflow-x-auto hide-scrollbar px-5 py-2 z-10"
        style={{
          height: "48px",
        }}
      >
        {/* All tab */}
        <button
          data-tab={ALL_TAB}
          onClick={() => handleTabClick(ALL_TAB)}
          className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap"
          style={{
            background: activeTabIdx === ALL_TAB ? "#fff" : "transparent",
            color: activeTabIdx === ALL_TAB ? "#000" : "rgba(255,255,255,0.55)",
            transition: "background 0.2s ease, color 0.2s ease",
          }}
        >
          All
        </button>

        {!isAddonFolder && sources.map((source, idx) => (
          <button
            key={idx}
            data-tab={idx}
            onClick={() => handleTabClick(idx)}
            className="shrink-0 px-4 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap"
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
  );
}

export default function FolderPage() {
  const params = useParams();
  const router = useRouter();
  const rawFolderId = params?.folderId as string;
  const folderId = rawFolderId ? decodeURIComponent(rawFolderId) : "";

  const [folder, setFolder] = useState<CollectionFolder | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = sessionStorage.getItem(`nuvio_folder_meta_${folderId}`);
        if (cached) return JSON.parse(cached);
      } catch { /* ignore */ }
    }
    return null;
  });
  const [collectionTitle, setCollectionTitle] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(`nuvio_folder_title_${folderId}`) || "";
    }
    return "";
  });
  const [activeTabIdx, setActiveTabIdx] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`nuvio_folder_activeTab_${folderId}`);
      if (saved) return parseInt(saved, 10);
    }
    return ALL_TAB;
  });
  const [tabStates, setTabStates] = useState<Record<number, TabState>>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`nuvio_folder_tabs_${folderId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          Object.keys(parsed).forEach(k => {
            parsed[k].loading = false;
            parsed[k].loadingMore = false;
          });
          return parsed;
        } catch { /* ignore */ }
      }
    }
    return {};
  });
  const [idToUrl, setIdToUrl] = useState<Map<string, string>>(new Map());
  const [addonsResolved, setAddonsResolved] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<TMDBMovie | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const tabContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fetchedTabsRef = useRef<Set<number>>(new Set());

  // Restore scroll and movie on mount, and track scroll position
  useEffect(() => {
    const lastMovie = sessionStorage.getItem("lastOpenedMovie");
    if (lastMovie) {
      try { setSelectedMovie(JSON.parse(lastMovie)); } catch (e) { }
    }

    requestAnimationFrame(() => {
      setMounted(true);
      setTimeout(() => setShowContent(true), 50);
    });

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

  // â”€â”€ Find the folder â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    let active = true;

    const findFolder = async () => {
      const processCollections = async (collections: Collection[]) => {
        // Dynamic system collections are always included â€” no need to re-fetch addons for them
        const sys = await getDynamicSystemCollections();
        const allCollections = [...collections, ...sys];
        for (const col of allCollections) {
          for (const f of col.folders || []) {
            if (f.id === folderId) {
              if (!active) return true;
              setFolder(f);
              setCollectionTitle(col.title);
              try {
                sessionStorage.setItem(`nuvio_folder_meta_${folderId}`, JSON.stringify(f));
                sessionStorage.setItem(`nuvio_folder_title_${folderId}`, col.title);
              } catch { /* ignore */ }

              // For addon-backed sources that already have a direct url, no manifest lookup needed
              const sourcesWithoutUrl = (f.sources || []).filter(
                (s) => !s.url && (!s.provider || (s.provider as string) === "addon")
              );
              if (sourcesWithoutUrl.length > 0 && idToUrl.size === 0) {
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

              return true;
            }
          }
        }
        return false;
      };

      // For system/addon folder IDs, resolve directly from dynamic collections â€” no Supabase needed
      const isSystemFolder = folderId.startsWith("sys_") || folderId.includes(":");
      if (isSystemFolder) {
        await processCollections([]);
        return;
      }

      const localCollections = loadLocalCollections();
      if (localCollections.length > 0) {
        const found = await processCollections(localCollections);
        if (found) return;
      }

      // Fetch fresh from Supabase only if not already cached this session
      const cacheKey = "nuvio_collections_pulled";
      const cachedRaw = sessionStorage.getItem(cacheKey);
      let freshCollections: Collection[] = [];
      if (cachedRaw) {
        try { freshCollections = JSON.parse(cachedRaw); } catch { /* ignore */ }
      }
      if (!freshCollections || freshCollections.length === 0) {
        freshCollections = await pullCollections();
        if (freshCollections.length > 0) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(freshCollections)); } catch { /* ignore */ }
        }
      }
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

  // â”€â”€ Tab state helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Load a specific source tab (paginated) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
        const { items, totalPages, nextSkip } = await resolveSourcePage(
          sources[idx] as any,
          idToUrl,
          nextPage,
          isFirstLoad ? 0 : current.nextSkip || 0
        );

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
              nextSkip: nextSkip,
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

  const depletedSourcesRef = useRef<Set<number>>(new Set());

  // â”€â”€ Load "All" tab â€” fetches sources one by one in a circular manner â”€â”€â”€â”€â”€â”€
  const loadAllTab = useCallback(
    async (reset = false) => {
      if (reset) depletedSourcesRef.current.clear();

      const current = tabStates[ALL_TAB] || INITIAL_TAB;
      if (!reset && current.loaded && current.page >= current.totalPages) return;
      if (!reset && (current.loading || current.loadingMore)) return;

      let nextPage = reset ? 1 : current.page + 1;
      const isFirstLoad = reset || !current.loaded;

      // Skip depleted sources
      let sourceIndex = (nextPage - 1) % sources.length;
      let loopCount = 0;
      while (depletedSourcesRef.current.has(sourceIndex) && loopCount < sources.length) {
        nextPage++;
        sourceIndex = (nextPage - 1) % sources.length;
        loopCount++;
      }

      if (loopCount >= sources.length) {
        // All sources are depleted
        setTabStates((prev) => ({
          ...prev,
          [ALL_TAB]: { ...prev[ALL_TAB], totalPages: current.page, loading: false, loadingMore: false }
        }));
        return;
      }

      setTabState(ALL_TAB, isFirstLoad ? { loading: true } : { loadingMore: true });
      try {
        const sourcePage = Math.floor((nextPage - 1) / sources.length) + 1;
        const source = sources[sourceIndex];

        // Estimate skip as (sourcePage - 1) * 20
        const calculatedSkip = (sourcePage - 1) * 20;

        // Fetch just this ONE source's page to keep it extremely fast
        const res = await resolveSourcePage(source as any, idToUrl, sourcePage, calculatedSkip);

        if (res.items.length === 0) {
          depletedSourcesRef.current.add(sourceIndex);
          // Auto-advance to the next one if this one was empty
          setTabStates((prev) => ({
            ...prev,
            [ALL_TAB]: { ...(prev[ALL_TAB] || INITIAL_TAB), page: nextPage, loading: false, loadingMore: false }
          }));
          setTimeout(() => loadAllTab(false), 50);
          return;
        }

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
              nextSkip: calculatedSkip + res.items.length,
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

  // Invalidate cache if sources config changed or if cached hash is missing but cache exists
  useEffect(() => {
    if (sources.length > 0 && typeof window !== "undefined") {
      const currentHash = JSON.stringify(sources);
      const cachedHash = sessionStorage.getItem(`nuvio_folder_sources_hash_${folderId}`);
      const hasCachedTabs = !!sessionStorage.getItem(`nuvio_folder_tabs_${folderId}`);
      if (hasCachedTabs && (!cachedHash || cachedHash !== currentHash)) {
        sessionStorage.removeItem(`nuvio_folder_tabs_${folderId}`);
        sessionStorage.removeItem(`nuvio_folder_activeTab_${folderId}`);
        setTabStates({});
        setActiveTabIdx(ALL_TAB);
        fetchedTabsRef.current.clear();
      }
      sessionStorage.setItem(`nuvio_folder_sources_hash_${folderId}`, currentHash);
    }
  }, [sources, folderId]);

  // â”€â”€ Bootstrap: set initial active tab when folder is ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (sources.length > 0 && folder && Object.keys(tabStates).length === 0) {
      setActiveTabIdx(ALL_TAB);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, sources.length]);

  // â”€â”€ Load active tab content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ IntersectionObserver for infinite scroll â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Tab click handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Card click â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleCardClick = async (meta: CatalogMeta) => {
    setResolvingId(meta.id);
    const movie = await resolveStremioIdToMovie(meta.id, meta.type);
    setResolvingId(null);
    if (movie) handleSelectMovie(movie);
  };

  // â”€â”€ Derived display state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const currentTabState = tabStates[activeTabIdx] || INITIAL_TAB;
  const currentMetas = currentTabState.metas;
  const currentLoading = currentTabState.loading;
  const currentLoadingMore = currentTabState.loadingMore;
  const hasMore =
    currentTabState.loaded &&
    currentTabState.page < currentTabState.totalPages;

  if (!mounted || !folder) {
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
        opacity: showContent ? 1 : 0,
        transform: showContent ? "none" : "scale(0.985)",
        transition: "opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      {/* Spacer to hold the space of the expanded header so content flows naturally below it */}
      <div style={{ height: `${H_EXPANDED}px` }} className="flex-shrink-0 w-full" />

      {/* Sticky/Fixed minimizable header container */}
      <FolderHeader
        folder={folder}
        sources={sources}
        collectionTitle={collectionTitle}
        activeTabIdx={activeTabIdx}
        handleTabClick={handleTabClick}
        tabContainerRef={tabContainerRef}
      />

      {/* â”€â”€ Content grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                      src={normalizeGithubUrl(meta.poster)}
                      alt={meta.name}
                      className="w-full h-full object-cover transition-opacity duration-700 opacity-0"
                      loading="lazy"
                      decoding="async"
                      onLoad={(e) => (e.currentTarget.style.opacity = '1')}
                      ref={(img) => { if (img?.complete) img.style.opacity = '1'; }}
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

      {/* â”€â”€ Movie Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

