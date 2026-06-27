import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'No URL provided' }, { status: 400 });

  try {
    // Perform a HEAD request to follow redirects and get the final URL
    // Some providers might reject HEAD, so we fallback to a GET request and abort it immediately
    let finalUrl = url;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
      
      const res = await fetch(url, { 
        method: 'GET', // Use GET because some APIs reject HEAD
        redirect: 'follow',
        signal: controller.signal
      });
      
      finalUrl = res.url;
      
      // Abort the GET request immediately since we only want the final URL, not the content
      clearTimeout(timeoutId);
      controller.abort();
    } catch (e: any) {
      // If it aborted, we might still have the URL if it threw during streaming, 
      // but if it failed entirely, we just fallback to the original URL
      console.error("Resolve error:", e);
    }

    return NextResponse.json({ url: finalUrl });
  } catch (e: any) {
    console.error("API Resolve error:", e);
    return NextResponse.json({ url }, { status: 200 }); // Return original on absolute failure
  }
}
