// Cache buster
import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";
import { Readable } from "node:stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STREAM_PROXY_ENABLED = !["false", "0", "no", "off"].includes(
  (process.env.NEXT_PUBLIC_STREAM_PROXY || "true").toLowerCase()
);

const agent = new https.Agent({
  ciphers:
    "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256",
  honorCipherOrder: true,
  minVersion: "TLSv1.2",
});

// Headers that should never be forwarded from the client/scraper to the upstream
const FORBIDDEN_UPSTREAM = new Set([
  "host",
  "connection",
  "origin",
  "content-length",
  "transfer-encoding",
  "sec-fetch-dest",
  "sec-fetch-mode",
  "sec-fetch-site",
  "sec-fetch-user",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "accept-encoding",
]);

async function streamToText(stream: Readable): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export async function GET(req: NextRequest) {
  if (!STREAM_PROXY_ENABLED) {
    return new NextResponse("Stream proxy is disabled", { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const targetUrl = searchParams.get("url");
  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  const customHeadersStr = searchParams.get("headers") || "{}";
  let customHeaders: Record<string, string> = {};
  try {
    customHeaders = JSON.parse(customHeadersStr);
  } catch (_) {}

  // Base headers — Chrome desktop UA for maximum compatibility
  const headersToSend: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    accept: "*/*",
    "accept-language": "en-US,en;q=0.9",
  };

  // Merge custom scraper headers
  Object.entries(customHeaders).forEach(([k, v]) => {
    const key = k.toLowerCase();
    if (!FORBIDDEN_UPSTREAM.has(key)) {
      headersToSend[key] = v as string;
    }
  });

  // Forward the browser's Range header (seek support for large files)
  const browserRange = req.headers.get("range");
  if (browserRange) {
    headersToSend["range"] = browserRange;
  }

  // Create an AbortController so we can cleanly kill the axios request
  // if the client (movi-player) aborts the connection.
  const controller = new AbortController();
  req.signal.addEventListener("abort", () => {
    controller.abort();
  });

  try {
    let currentUrl = targetUrl;
    let response: any = null;
    let redirectCount = 0;

    // Manually follow redirects to preserve Chrome TLS fingerprint across hops
    while (redirectCount < 8) {
      if (req.signal.aborted) throw new Error("AbortError");

      response = await axios({
        url: currentUrl,
        method: "GET",
        headers: headersToSend,
        httpsAgent: agent,
        maxRedirects: 0,
        validateStatus: () => true, // never throw — forward all status codes
        responseType: "stream",
        signal: controller.signal, // instantly aborts upstream if client disconnects
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers["location"];
        if (location) {
          currentUrl = new URL(location, currentUrl).toString();
          redirectCount++;
          // Consume the redirect body to free the socket
          response.data.resume();
          continue;
        }
      }
      break;
    }

    if (!response) {
      return new NextResponse("Failed to fetch target URL", { status: 502 });
    }

    const contentType = (response.headers["content-type"] || "").toLowerCase();
    const isM3U8 =
      contentType.includes("mpegurl") ||
      contentType.includes("m3u8") ||
      currentUrl.split("?")[0].endsWith(".m3u8");

    if (isM3U8) {
      const text = await streamToText(response.data);
      const rewritten = rewriteM3U8(text, currentUrl, customHeadersStr);
      return new NextResponse(rewritten, {
        status: 200,
        headers: {
          "Content-Type": "application/x-mpegURL",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    }

    // Build response headers — pass through what's needed for video playback
    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Headers", "Range");
    responseHeaders.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");

    const passthrough = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "last-modified",
      "etag",
    ];
    passthrough.forEach((h) => {
      const v = response.headers[h];
      if (v !== undefined) {
        responseHeaders.set(h, Array.isArray(v) ? v.join(", ") : String(v));
      }
    });

    // Convert Node.js Readable → Web ReadableStream (required for Next.js App Router)
    const webStream = Readable.toWeb(response.data) as ReadableStream;

    // Failsafe: if the Node stream is somehow hanging around, destroy it when Web Stream cancels
    req.signal.addEventListener("abort", () => {
      if (response && response.data && typeof response.data.destroy === "function") {
        response.data.destroy();
      }
    });

    return new NextResponse(webStream, {
      status: response.status,
      statusText: response.statusText || "",
      headers: responseHeaders,
    });
  } catch (err: any) {
    if (axios.isCancel(err) || err.name === "AbortError" || req.signal.aborted) {
      return new NextResponse(null, { status: 499 }); // Client Closed Request
    }
    console.error("[streamProxy] Error:", err?.message || err);
    return new NextResponse(`Proxy error: ${String(err?.message || err)}`, { status: 500 });
  }
}

export async function HEAD(req: NextRequest) {
  if (!STREAM_PROXY_ENABLED) {
    return new NextResponse("Stream proxy is disabled", { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const targetUrl = searchParams.get("url");
  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
      "Accept-Ranges": "bytes",
    },
  });
}

export async function OPTIONS() {
  if (!STREAM_PROXY_ENABLED) {
    return new NextResponse("Stream proxy is disabled", { status: 403 });
  }

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
      "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges",
    },
  });
}

function rewriteM3U8(content: string, baseUrl: string, headersJson: string): string {
  const lines = content.split(/\r?\n/);
  const rewrittenLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    // Rewrite ANY URL found in the manifest to go through the proxy.
    // This is required to bypass 403 Forbidden errors on media segments (like .jpg or .ts).
    if (trimmed.startsWith("#")) {
      if (trimmed.includes("URI=")) {
        return trimmed.replace(/URI="([^"]+)"/g, (match, uri) => {
          try {
            const resolved = new URL(uri, baseUrl).toString();
            const proxied = `/api/streamProxy?url=${encodeURIComponent(resolved)}&headers=${encodeURIComponent(headersJson)}`;
            return `URI="${proxied}"`;
          } catch {
            return match;
          }
        });
      }
      return line;
    }

    try {
      const resolved = new URL(trimmed, baseUrl).toString();
      return `/api/streamProxy?url=${encodeURIComponent(resolved)}&headers=${encodeURIComponent(headersJson)}`;
    } catch {
      return line;
    }
  });

  return rewrittenLines.join("\n");
}
