import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return new NextResponse('Failed to fetch image', { status: res.status });
    }

    // Pass through the image content and append permissive CORS & CORP headers
    const headers = new Headers(res.headers);
    headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(res.body, {
      status: res.status,
      headers
    });
  } catch (err) {
    console.error('Image proxy error:', err);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
