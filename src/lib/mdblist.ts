/**
 * MDBList external ratings, mirrored from NuvioMobile MdbListMetadataService.
 * Endpoint: POST https://api.mdblist.com/rating/{movie|show}/{provider}?apikey=KEY
 * Body: { ids: [imdbId], provider: "imdb" } → { ratings: [{ rating }] }
 */

const KEY_STORAGE = "nuvio_mdblist_api_key";

export const MDBLIST_PROVIDERS = [
  "imdb", "tmdb", "tomatoes", "metacritic", "trakt", "letterboxd", "audience",
] as const;
export type MdbListProvider = (typeof MDBLIST_PROVIDERS)[number];

export interface ExternalRating {
  source: string;
  value: number;
}

export function getMdbListApiKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(KEY_STORAGE) || "";
}

export function setMdbListApiKey(key: string) {
  if (typeof window === "undefined") return;
  if (key.trim()) localStorage.setItem(KEY_STORAGE, key.trim());
  else localStorage.removeItem(KEY_STORAGE);
}

function extractImdbId(value?: string | null): string | null {
  if (!value) return null;
  const m = value.match(/tt\d+/);
  return m ? m[0] : null;
}

const cache = new Map<string, ExternalRating[]>();

async function fetchProviderRating(
  imdbId: string,
  mediaType: "movie" | "show",
  provider: MdbListProvider,
  apiKey: string,
): Promise<ExternalRating | null> {
  try {
    const url = `https://api.mdblist.com/rating/${mediaType}/${provider}?apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [imdbId], provider: "imdb" }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const rating = json?.ratings?.[0]?.rating;
    if (typeof rating !== "number") return null;
    return { source: provider, value: rating };
  } catch {
    return null;
  }
}

/**
 * Fetch external ratings for a title. `idOrImdb` may be an imdb id (ttXXXX) or
 * any string containing one. Returns [] if no API key or no imdb id.
 */
export async function fetchExternalRatings(
  idOrImdb: string,
  type: string,
  providers: MdbListProvider[] = ["imdb", "tmdb", "tomatoes", "metacritic"],
): Promise<ExternalRating[]> {
  const apiKey = getMdbListApiKey();
  if (!apiKey) return [];
  const imdbId = extractImdbId(idOrImdb);
  if (!imdbId) return [];

  const mediaType: "movie" | "show" = type === "movie" ? "movie" : "show";
  const cacheKey = `${mediaType}:${imdbId}:${providers.join(",")}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey)!;

  const results = await Promise.all(
    providers.map((p) => fetchProviderRating(imdbId, mediaType, p, apiKey)),
  );
  const ratings = results.filter((r): r is ExternalRating => r !== null);
  cache.set(cacheKey, ratings);
  return ratings;
}
