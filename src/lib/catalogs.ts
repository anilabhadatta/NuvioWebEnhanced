/**
 * Stremio addon catalog fetching, used to resolve Collection folder sources into
 * rows of content on the home page. Mirrors the catalog endpoint shape used by
 * NuvioMobile's CollectionCatalogResolver.
 *
 *   {baseUrl}/catalog/{type}/{catalogId}.json
 *   {baseUrl}/catalog/{type}/{catalogId}/genre={genre}.json
 */

export interface CatalogMeta {
  id: string;            // Stremio id (often an imdb id like tt..., or tmdb:123)
  type: string;          // movie | series
  name: string;
  poster?: string;
  posterShape?: string;
  background?: string;
  description?: string;
}

function baseFromManifest(manifestUrl: string): { base: string; query: string } {
  const base = manifestUrl.split("/manifest.json")[0];
  const query = manifestUrl.includes("?") ? "?" + manifestUrl.split("?")[1] : "";
  return { base, query };
}

export async function fetchCollectionCatalog(
  manifestUrl: string,
  type: string,
  catalogId: string,
  genre?: string,
): Promise<CatalogMeta[]> {
  try {
    const { base, query } = baseFromManifest(manifestUrl);
    const genrePart = genre && genre.trim() && genre.toLowerCase() !== "none"
      ? `/genre=${encodeURIComponent(genre)}`
      : "";
    const url = `${base}/catalog/${encodeURIComponent(type)}/${encodeURIComponent(catalogId)}${genrePart}.json${query}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.metas)) return [];
    return data.metas.map((m: any) => ({
      id: m.id,
      type: m.type || type,
      name: m.name || m.title || "",
      poster: m.poster,
      posterShape: m.posterShape,
      background: m.background,
      description: m.description,
    }));
  } catch {
    return [];
  }
}
