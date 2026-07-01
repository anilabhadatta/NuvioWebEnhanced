import axios from "axios";

export const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY || "ecb37597e45cfeed0586f3cd57233d0b";
export const TMDB_BASE_URL = "https://api.themoviedb.org/3";
export const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/original";
export const TMDB_IMAGE_W500 = "https://image.tmdb.org/t/p/w500";

export const tmdb = axios.create({
  baseURL: TMDB_BASE_URL,
});

export const fetchTvDetails = async (id: number | string) => {
  const res = await tmdb.get(`/tv/${id}?api_key=${TMDB_API_KEY}&language=en-US`);
  return res.data;
};

export const fetchTvSeason = async (tvId: number | string, seasonNumber: number) => {
  const res = await tmdb.get(`/tv/${tvId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=en-US`);
  return res.data;
};

export interface NextEpisodeMeta {
  season: number;
  episode: number;
  title: string;
  thumbnail: string | null;
  overview: string | null;
  airDate: string | null;
  hasAired: boolean;
}

/**
 * Resolves the next episode after (season, episode). First tries the same season,
 * then falls back to season+1 episode 1. Returns null if there is no next episode.
 */
export const fetchNextEpisode = async (
  tvId: number | string,
  season: number,
  episode: number,
): Promise<NextEpisodeMeta | null> => {
  const buildMeta = (s: number, ep: any): NextEpisodeMeta => {
    const airDate: string | null = ep.air_date || null;
    let hasAired = true;
    if (airDate) {
      const air = new Date(airDate).getTime();
      const today = new Date().setHours(0, 0, 0, 0);
      hasAired = !Number.isNaN(air) && air <= today;
    }
    return {
      season: s,
      episode: ep.episode_number,
      title: ep.name || `Episode ${ep.episode_number}`,
      thumbnail: ep.still_path ? `https://image.tmdb.org/t/p/w342${ep.still_path}` : null,
      overview: ep.overview || null,
      airDate,
      hasAired,
    };
  };

  try {
    const data = await fetchTvSeason(tvId, season);
    const eps: any[] = data?.episodes || [];
    const nextInSameSeason = eps.find((e) => e.episode_number === episode + 1);
    if (nextInSameSeason) return buildMeta(season, nextInSameSeason);
  } catch (_) {
    /* fall through */
  }

  try {
    const nextSeason = await fetchTvSeason(tvId, season + 1);
    const eps: any[] = nextSeason?.episodes || [];
    const first = eps.find((e) => e.episode_number === 1) || eps[0];
    if (first) return buildMeta(season + 1, first);
  } catch (_) {
    /* no next season */
  }

  return null;
};

export const fetchExternalIds = async (id: number | string, type: "movie" | "tv") => {
  const res = await tmdb.get(`/${type}/${id}/external_ids?api_key=${TMDB_API_KEY}`);
  return res.data;
};

/**
 * Resolve a Stremio catalog meta id (imdb ttXXXX, or tmdb:NNN) to a TMDBMovie so
 * it can be opened in the existing MovieModal. Returns null if it can't resolve.
 */
export const resolveStremioIdToMovie = async (
  rawId: string,
  fallbackType?: string,
): Promise<TMDBMovie | null> => {
  try {
    const id = rawId.trim();
    // Direct TMDB id form: tmdb:12345 or movie:12345 / series:12345
    const tmdbMatch = id.match(/(?:tmdb|movie|series):(\d+)/i);
    if (tmdbMatch) {
      const tmdbId = parseInt(tmdbMatch[1]);
      const type = fallbackType === "series" || fallbackType === "tv" ? "tv" : "movie";
      return await fetchTmdbAsMovie(tmdbId, type);
    }

    // IMDb id form: ttXXXXX → /find
    const imdbMatch = id.match(/tt\d+/);
    if (imdbMatch) {
      const res = await tmdb.get(`/find/${imdbMatch[0]}?api_key=${TMDB_API_KEY}&external_source=imdb_id`);
      const movie = res.data?.movie_results?.[0];
      const tv = res.data?.tv_results?.[0];
      const chosen = (fallbackType === "series" || fallbackType === "tv") ? (tv || movie) : (movie || tv);
      if (!chosen) return null;
      return { ...chosen, media_type: chosen === tv ? "tv" : "movie" } as TMDBMovie;
    }
    return null;
  } catch {
    return null;
  }
};

const fetchTmdbAsMovie = async (tmdbId: number, type: "movie" | "tv"): Promise<TMDBMovie | null> => {
  try {
    const res = await tmdb.get(`/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`);
    const d = res.data;
    return {
      id: d.id,
      title: d.title,
      name: d.name,
      overview: d.overview,
      backdrop_path: d.backdrop_path,
      poster_path: d.poster_path,
      vote_average: d.vote_average,
      release_date: d.release_date,
      first_air_date: d.first_air_date,
      genre_ids: (d.genres || []).map((g: any) => g.id),
      media_type: type,
      original_language: d.original_language,
    };
  } catch {
    return null;
  }
};

export const searchTmdb = async (query: string, year?: string, type: "movie" | "tv" = "movie"): Promise<TMDBMovie | null> => {
  try {
    let url = `/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=en-US`;
    if (year) {
      if (type === "movie") url += `&primary_release_year=${year}`;
      if (type === "tv") url += `&first_air_date_year=${year}`;
    }
    const res = await tmdb.get(url);
    const results = res.data?.results || [];
    if (results.length > 0) {
      const d = results[0];
      return {
        id: d.id,
        title: d.title,
        name: d.name,
        overview: d.overview,
        backdrop_path: d.backdrop_path,
        poster_path: d.poster_path,
        vote_average: d.vote_average,
        release_date: d.release_date,
        first_air_date: d.first_air_date,
        genre_ids: d.genre_ids || [],
        media_type: type,
        original_language: d.original_language,
      };
    }
    return null;
  } catch {
    return null;
  }
};


export const TMDB_URLS = {
  trending: `/trending/all/week?api_key=${TMDB_API_KEY}&language=en-US`,
  trendingMovies: `/trending/movie/week?api_key=${TMDB_API_KEY}&language=en-US`,
  trendingSeries: `/trending/tv/week?api_key=${TMDB_API_KEY}&language=en-US`,
  originals: `/discover/tv?api_key=${TMDB_API_KEY}&with_networks=213&sort_by=popularity.desc&language=en-US`,
  topRated: `/movie/top_rated?api_key=${TMDB_API_KEY}&language=en-US`,
  action: `/discover/movie?api_key=${TMDB_API_KEY}&with_genres=28`,
  comedy: `/discover/movie?api_key=${TMDB_API_KEY}&with_genres=35`,
  horror: `/discover/movie?api_key=${TMDB_API_KEY}&with_genres=27`,
  scifi: `/discover/movie?api_key=${TMDB_API_KEY}&with_genres=878`,
  animated: `/discover/movie?api_key=${TMDB_API_KEY}&with_genres=16`,
  upcoming: `/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US`,
};

export interface TMDBMovie {
  id: number;
  title?: string;
  name?: string;
  overview: string;
  backdrop_path: string;
  poster_path: string;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids: number[];
  media_type?: string;
  original_language: string;
}

export const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 53: "Thriller",
  10752: "War", 37: "Western", 10759: "Action & Adventure",
  10762: "Kids", 10765: "Sci-Fi & Fantasy",
};

export function getGenreNames(ids: number[]): string[] {
  return ids.slice(0, 3).map((id) => GENRE_MAP[id]).filter(Boolean);
}

/** Build a TMDB url for a given source (without a page param). Returns the URL string + the resolved media type. */
export function buildTmdbSourceUrl(source: any): { url: string; type: string } | null {
  if (source.provider === "trakt") return null;

  const { tmdbSourceType, mediaType, sortBy, tmdbId, filters = {} } = source;
  const rawType = (mediaType || "MOVIE").toLowerCase();
  const type = rawType === "tv" ? "tv" : "movie";

  const filterParams: string[] = [];
  if (filters.withGenres) filterParams.push(`with_genres=${filters.withGenres}`);
  if (filters.voteCountGte) filterParams.push(`vote_count.gte=${filters.voteCountGte}`);
  if (filters.withOriginalLanguage) filterParams.push(`with_original_language=${filters.withOriginalLanguage}`);
  if (filters.year) {
    if (type === "tv") filterParams.push(`first_air_date_year=${filters.year}`);
    else filterParams.push(`primary_release_year=${filters.year}`);
  }
  const filterStr = filterParams.length > 0 ? `&${filterParams.join("&")}` : "";

  let url = "";
  // Some source types don't support pagination — mark them
  let isPaginatable = true;
  switch ((tmdbSourceType || "DISCOVER").toUpperCase()) {
    case "TRENDING":
      url = `/trending/${type}/week?api_key=${TMDB_API_KEY}&language=en-US${filterStr}`;
      break;
    case "TOP_RATED":
    case "TOPRATED":
      url = `/${type}/top_rated?api_key=${TMDB_API_KEY}&language=en-US${filterStr}`;
      break;
    case "POPULAR":
      url = `/${type}/popular?api_key=${TMDB_API_KEY}&language=en-US${filterStr}`;
      break;
    case "UPCOMING":
      url = `/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US${filterStr}`;
      break;
    case "NOW_PLAYING":
    case "NOWPLAYING":
      url = `/movie/now_playing?api_key=${TMDB_API_KEY}&language=en-US${filterStr}`;
      break;
    case "LIST":
      if (!tmdbId) return null;
      url = `/list/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
      break;
    case "MOVIECOLLECTION":
      if (!tmdbId) return null;
      url = `/collection/${tmdbId}?api_key=${TMDB_API_KEY}&language=en-US`;
      isPaginatable = false;
      break;
    case "COMPANY":
      url = `/discover/${type}?api_key=${TMDB_API_KEY}&with_companies=${tmdbId}&sort_by=${sortBy || "popularity.desc"}${filterStr}`;
      break;
    case "NETWORK":
      url = `/discover/tv?api_key=${TMDB_API_KEY}&with_networks=${tmdbId}&sort_by=${sortBy || "popularity.desc"}${filterStr}`;
      break;
    case "PERSON":
      url = `/discover/${type}?api_key=${TMDB_API_KEY}&with_cast=${tmdbId}&sort_by=${sortBy || "popularity.desc"}${filterStr}`;
      break;
    case "DISCOVER":
    default:
      url = `/discover/${type}?api_key=${TMDB_API_KEY}&language=en-US&sort_by=${sortBy || "popularity.desc"}${filterStr}`;
      break;
  }

  return { url, type, isPaginatable } as any;
}

function normalizeTmdbResults(results: any[], type: string): any[] {
  return results.map((m: any) => ({
    id: `tmdb:${m.id}`,
    type: m.media_type || type,
    name: m.title || m.name || "",
    poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined,
    posterShape: "poster",
    background: m.backdrop_path ? `https://image.tmdb.org/t/p/original${m.backdrop_path}` : undefined,
    description: m.overview,
  }));
}

/** Fetch a single page of results for a TMDB source. Returns { items, totalPages }. */
export const fetchTmdbCollectionSourcePage = async (
  source: any,
  page: number = 1,
): Promise<{ items: any[]; totalPages: number }> => {
  try {
    const built = buildTmdbSourceUrl(source);
    if (!built) return { items: [], totalPages: 0 };
    const { url, type, isPaginatable } = built as any;

    const pageUrl = isPaginatable !== false ? `${url}&page=${page}` : url;
    const res = await tmdb.get(pageUrl);
    const results = res.data?.results || res.data?.parts || res.data?.items || [];
    const totalPages = isPaginatable !== false ? (res.data?.total_pages ?? 1) : 1;

    return { items: normalizeTmdbResults(results, type), totalPages };
  } catch (err) {
    console.error("TMDB paginated fetch error for source", source?.title, err);
    return { items: [], totalPages: 0 };
  }
};

/** Legacy: fetch page 1 only (used by FolderDetailModal and other callers). */
export const fetchTmdbCollectionSource = async (source: any): Promise<any[]> => {
  const { items } = await fetchTmdbCollectionSourcePage(source, 1);
  return items;
};

/**
 * Safely rewrites github.com raw image URLs to raw.githubusercontent.com so they
 * support CORS headers and can be loaded under COEP: require-corp.
 */
export function sanitizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  const trimmed = url.trim();
  if (trimmed.includes("github.com") && trimmed.includes("/blob/")) {
    try {
      const parsed = new URL(trimmed);
      const pathname = parsed.pathname.replace("/blob/", "/");
      return `https://raw.githubusercontent.com${pathname}`;
    } catch (e) {
      return trimmed;
    }
  }
  return trimmed;
}
