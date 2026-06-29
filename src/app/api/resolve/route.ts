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
    // Follow all redirects server-side. Use a ranged GET so the CDN responds
    // quickly with just headers (206 Partial Content) instead of streaming the
    // full file. Abort immediately after reading the final URL.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(url, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      redirect: "follow",
      signal: controller.signal,
    });

    const finalUrl = res.url || url;
    clearTimeout(timeout);
    controller.abort();

    return NextResponse.json(
      { url: finalUrl },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (err: any) {
    if (err?.name === "AbortError") {
      // Abort after reading res.url is expected — return the original URL
      return NextResponse.json(
        { url },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*" } },
      );
    }
    return NextResponse.json(
      { error: "Failed to resolve", detail: String(err) },
      { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
}
