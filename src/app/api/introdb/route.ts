import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const imdbId = searchParams.get('imdb_id');
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  if (!imdbId || !season || !episode) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  try {
    // We make the request server-to-server to bypass browser CORS restrictions.
    // We use the env variable for the upstream API URL, avoiding hardcoded URLs.
    const baseUrl = (process.env.NEXT_PUBLIC_INTRODB_API_URL || "https://api.introdb.app").replace(/\/$/, '');
    const url = `${baseUrl}/segments?imdb_id=${imdbId}&season=${season}&episode=${episode}`;
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        // Some APIs require a User-Agent, so we add a generic one just in case
        'User-Agent': 'NuvioMedia/1.0',
      },
      // Cache the response to save API calls
      next: { revalidate: 3600 } 
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `IntroDB API responded with status: ${response.status}` }, 
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('IntroDB Proxy Error:', error);
    return NextResponse.json({ error: 'Failed to fetch skip segments' }, { status: 500 });
  }
}
