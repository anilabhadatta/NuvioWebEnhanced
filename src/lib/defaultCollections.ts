import { Collection, CollectionFolder } from "./collections";
import { fetchAddons, fetchAddonManifest } from "./addons";

// In-memory cache so we only hit Supabase+manifests once per session
let dynamicCollectionsCache: Collection[] | null = null;
let dynamicCollectionsPromise: Promise<Collection[]> | null = null;

export const SYSTEM_COLLECTIONS: Collection[] = [
  {
    id: "system_browse",
    title: "Explore",
    viewMode: "ROWS",
    folders: [
      {
        id: "sys_popular_movies",
        title: "Popular Movies",
        coverEmoji: "🎬",
        tileShape: "poster",
        sources: [
          { provider: "addon", addonId: "cinemeta-top", type: "movie", catalogId: "top", title: "Popular Movies", url: "https://cinemeta-catalogs.strem.io/top/manifest.json" }
        ]
      },
      {
        id: "sys_popular_series",
        title: "Popular Series",
        coverEmoji: "📺",
        tileShape: "poster",
        sources: [
          { provider: "addon", addonId: "cinemeta-top", type: "series", catalogId: "top", title: "Popular Series", url: "https://cinemeta-catalogs.strem.io/top/manifest.json" }
        ]
      },
      {
        id: "sys_featured_movies",
        title: "Featured Movies",
        coverEmoji: "⭐",
        tileShape: "poster",
        sources: [
          { provider: "addon", addonId: "cinemeta-featured", type: "movie", catalogId: "imdbRating", title: "Featured Movies", url: "https://cinemeta-catalogs.strem.io/imdbRating/manifest.json" }
        ]
      },
      {
        id: "sys_featured_series",
        title: "Featured Series",
        coverEmoji: "🌟",
        tileShape: "poster",
        sources: [
          { provider: "addon", addonId: "cinemeta-featured", type: "series", catalogId: "imdbRating", title: "Featured Series", url: "https://cinemeta-catalogs.strem.io/imdbRating/manifest.json" }
        ]
      }
    ]
  }
];

export async function getDynamicSystemCollections(): Promise<Collection[]> {
  if (dynamicCollectionsCache) return dynamicCollectionsCache;
  if (dynamicCollectionsPromise) return dynamicCollectionsPromise;

  dynamicCollectionsPromise = (async () => {
  let addons: any[] = [];
  try {
    addons = await fetchAddons();
  } catch (e) {
    console.error("Failed to fetch addons for dynamic collections", e);
  }
  
  const enabledAddons = addons.filter(a => a.enabled !== false);
  const addonsWithManifests = await Promise.all(
    enabledAddons.map(async (a) => {
      try {
        if (a.manifest) return a;
        let url = a.url;
        if (!url.endsWith("/manifest.json") && !url.includes("manifest.json")) {
          url = url.replace(/\/$/, "") + "/manifest.json";
        }
        const manifest = await fetchAddonManifest(url);
        return { ...a, manifest, url };
      } catch {
        return a;
      }
    })
  );

  const dynamicFolders: CollectionFolder[] = [];

  for (const addon of addonsWithManifests) {
    const manifest = addon.manifest;
    if (!manifest || !manifest.catalogs) continue;

    for (const catalog of manifest.catalogs) {
      if (catalog.extra && catalog.extra.some((ex: any) => ex.isRequired)) {
        continue;
      }

      const folderId = `${manifest.id}:${catalog.type}:${catalog.id}`;

      let title = catalog.name || "";
      if (!title) {
        title = `${addon.name} ${catalog.type === "movie" ? "Movies" : "Series"}`;
      } else {
        const lowerTitle = title.toLowerCase();
        if (
          !lowerTitle.includes("movie") &&
          !lowerTitle.includes("movies") &&
          !lowerTitle.includes("show") &&
          !lowerTitle.includes("shows") &&
          !lowerTitle.includes("series") &&
          !lowerTitle.includes("tv")
        ) {
          title = `${title} ${catalog.type === "movie" ? "Movies" : "Series"}`;
        }
      }

      dynamicFolders.push({
        id: folderId,
        title: title,
        coverEmoji: catalog.type === "movie" ? "🎬" : "📺",
        tileShape: "poster",
        sources: [
          {
            provider: "addon" as const,
            addonId: manifest.id,
            type: catalog.type,
            catalogId: catalog.id,
            title: title,
            url: addon.url
          }
        ]
      });
    }
  }

  if (dynamicFolders.length === 0) {
      return SYSTEM_COLLECTIONS;
    }

    return [
      {
        id: "system_browse",
        title: "Explore",
        viewMode: "ROWS",
        folders: dynamicFolders
      }
    ];
  })();

  dynamicCollectionsCache = await dynamicCollectionsPromise;
  return dynamicCollectionsCache;
}

export function clearDynamicCollectionsCache() {
  dynamicCollectionsCache = null;
  dynamicCollectionsPromise = null;
}
