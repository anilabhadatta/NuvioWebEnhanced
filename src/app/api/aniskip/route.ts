import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imdbId = searchParams.get('imdb_id');
  const episode = searchParams.get('episode');

  if (!imdbId || !episode) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    // 1. Resolve IMDb ID to MAL ID
    const resolveRes = await fetch(`https://arm.haglund.dev/api/v2/imdb?id=${imdbId}&include=myanimelist`, {
      next: { revalidate: 86400 } // Cache for 24h
    });
    
    if (!resolveRes.ok) {
      return NextResponse.json({ error: 'Failed to resolve MAL ID' }, { status: resolveRes.status });
    }
    
    const resolveData = await resolveRes.json();
    if (!Array.isArray(resolveData) || resolveData.length === 0 || !resolveData[0].myanimelist) {
      return NextResponse.json({ results: [] }); // No anime mapping found
    }
    
    const malId = resolveData[0].myanimelist;

    // 2. Fetch skip times from AniSkip
    const typesQuery = 'types=op&types=ed&types=recap&types=mixed-op&types=mixed-ed';
    const aniskipRes = await fetch(`https://api.aniskip.com/v2/skip-times/${malId}/${episode}?${typesQuery}&episodeLength=0`, {
      next: { revalidate: 3600 }
    });
    
    if (!aniskipRes.ok) {
      if (aniskipRes.status === 404) {
        return NextResponse.json({ results: [] }); // Not found
      }
      return NextResponse.json({ error: 'Failed to fetch aniskip' }, { status: aniskipRes.status });
    }

    const data = await aniskipRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('AniSkip Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to fetch anime skip segments' }, { status: 500 });
  }
}
