import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Stream proxy — pipes bytes from upstream CDN to browser with proper CORS headers.
 * This allows Shaka Player's MSE fetch() to work even when the CDN doesn't return
 * Access-Control-Allow-Origin headers.
 * 
 * The server just forwards bytes; no transcoding is done.
 * Range requests (for seeking) are forwarded transparently.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL' }, { status: 400 });

  // Forward the Range header from the browser (essential for video seeking)
  const rangeHeader = req.headers.get('range');
  const upstreamHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (compatible; NuvioWeb)',
    'Accept': '*/*',
  };
  if (rangeHeader) upstreamHeaders['Range'] = rangeHeader;

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(url, {
      headers: upstreamHeaders,
      redirect: 'follow',
    });
  } catch (e) {
    console.error('[stream-proxy] fetch error', e);
    return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 });
  }

  // Build response headers — add CORS so Shaka can do MSE byte-range fetches
  const responseHeaders = new Headers();
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type');
  responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

  // Forward the important upstream headers
  const forward = [
    'content-type',
    'content-length',
    'content-range',
    'accept-ranges',
    'last-modified',
    'etag',
  ];
  for (const h of forward) {
    const v = upstreamRes.headers.get(h);
    if (v) responseHeaders.set(h, v);
  }

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: responseHeaders,
  });
}

export async function HEAD(req: NextRequest) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return new NextResponse(null, { status: 400 });

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NuvioWeb)' },
      redirect: 'follow',
    });
  } catch (e) {
    return new NextResponse(null, { status: 502 });
  }

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  const forward = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
  for (const h of forward) {
    const v = upstreamRes.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new NextResponse(null, { status: upstreamRes.status, headers });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  });
}
