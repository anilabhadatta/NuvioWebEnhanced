import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

/**
 * Lightweight redirect-resolver for debrid streams that CORS-block in the browser.
 * Follows the redirect chain server-side (no CORS enforcement) and returns the
 * final CDN URL as JSON. Zero video bytes are proxied — only the resolved URL
 * string (~200 bytes) passes through this function.
 *
 * Usage: GET /api/resolve?url=<encoded addon/debrid stream URL>
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json(
      { error: "Missing ?url= parameter" },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }

  try {
    let currentUrl = url;
    const maxRedirects = 5;
    
    for (let i = 0; i < maxRedirects; i++) {
      let redirected = false;

      // Try HEAD request first (no body download)
      try {
        const res = await fetch(currentUrl, {
          method: "HEAD",
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          redirect: "manual",
          cache: "no-store",
        });

        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get("location");
          if (location) {
            currentUrl = new URL(location, currentUrl).toString();
            redirected = true;
          }
        }
      } catch (e) {
        // HEAD failed, fall through to GET
      }

      // If HEAD did not redirect and we haven't resolved yet, try GET with manual redirect
      if (!redirected) {
        try {
          const res = await fetch(currentUrl, {
            method: "GET",
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            redirect: "manual",
            cache: "no-store",
          });

          if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get("location");
            if (location) {
              currentUrl = new URL(location, currentUrl).toString();
              redirected = true;
            }
          }
        } catch (e) {
          // If both fail, break loop and return what we have
          break;
        }
      }

      // If no redirect happened on this step, we reached the end of the chain!
      if (!redirected) {
        break;
      }
    }

    return NextResponse.json(
      { url: currentUrl },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to resolve", detail: String(err) },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
