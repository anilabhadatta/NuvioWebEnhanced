export interface CinemetaItem {
  id: string;
  type: string;
  name: string;
  poster: string;
  background?: string;
  logo?: string;
  description?: string;
  releaseInfo?: string;
  imdbRating?: string;
}

export async function fetchTrendingMovies(): Promise<CinemetaItem[]> {
  try {
    const res = await fetch("https://v3-cinemeta.strem.io/catalog/movie/top.json");
    if (!res.ok) throw new Error("Failed to fetch trending movies");
    const data = await res.json();
    return data.metas || [];
  } catch (error) {
    console.error("Error fetching trending movies:", error);
    return [];
  }
}

export async function fetchTrendingSeries(): Promise<CinemetaItem[]> {
  try {
    const res = await fetch("https://v3-cinemeta.strem.io/catalog/series/top.json");
    if (!res.ok) throw new Error("Failed to fetch trending series");
    const data = await res.json();
    return data.metas || [];
  } catch (error) {
    console.error("Error fetching trending series:", error);
    return [];
  }
}
