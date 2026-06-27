export interface SkipInterval {
  startTime: number;
  endTime: number;
  type: "intro" | "outro" | "recap";
}

export const INTRODB_API_URL = process.env.NEXT_PUBLIC_INTRODB_API_URL || "/api/introdb";

export async function fetchSkipIntervals(imdbId: string, season: number, episode: number): Promise<SkipInterval[]> {
  try {
    const baseUrl = INTRODB_API_URL.endsWith("/") ? INTRODB_API_URL.slice(0, -1) : INTRODB_API_URL;
    const url = `${baseUrl}/segments?imdb_id=${imdbId}&season=${season}&episode=${episode}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    
    const data = await res.json();
    const intervals: SkipInterval[] = [];

    const addInterval = (segment: any, type: SkipInterval["type"]) => {
      if (!segment) return;
      const start = Number.isFinite(Number(segment.start_sec))
        ? Number(segment.start_sec)
        : Number.isFinite(Number(segment.start_ms))
          ? Number(segment.start_ms) / 1000
          : NaN;
      const end = Number.isFinite(Number(segment.end_sec))
        ? Number(segment.end_sec)
        : Number.isFinite(Number(segment.end_ms))
          ? Number(segment.end_ms) / 1000
          : NaN;
      if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
        intervals.push({ startTime: start, endTime: end, type });
      }
    };

    addInterval(data.intro, "intro");
    addInterval(data.recap, "recap");
    addInterval(data.outro, "outro");

    return intervals.sort((a, b) => a.startTime - b.startTime);
  } catch (err) {
    console.error("Failed to fetch IntroDB segments", err);
    return [];
  }
}
