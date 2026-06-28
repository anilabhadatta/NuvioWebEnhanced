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
