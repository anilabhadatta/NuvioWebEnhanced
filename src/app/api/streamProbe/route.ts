import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";

export const runtime = "nodejs";

const agent = new https.Agent({
  ciphers:
    "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256",
  honorCipherOrder: true,
  minVersion: "TLSv1.2",
});

const FORBIDDEN_UPSTREAM = new Set([
  "host", "connection", "origin", "content-length", "transfer-encoding",
  "sec-fetch-dest", "sec-fetch-mode", "sec-fetch-site", "sec-fetch-user",
  "sec-ch-ua", "sec-ch-ua-mobile", "sec-ch-ua-platform", "accept-encoding",
]);

// Known video file extensions that always resolve to "direct" without a probe
const DIRECT_VIDEO_EXTS = new Set([
  ".mp4", ".mkv", ".avi", ".mov", ".wmv", ".flv", ".webm", ".m4v",
  ".mpg", ".mpeg", ".ts", ".m2ts", ".vob", ".f4v", ".rm", ".rmvb",
]);

// Known HLS extensions that always resolve to "hls"
const HLS_EXTS = new Set([".m3u8", ".m3u"]);

function getUrlExt(url: string): string {
  try {
    const path = new URL(url).pathname.toLowerCase();
    const dot = path.lastIndexOf(".");
    return dot >= 0 ? path.slice(dot) : "";
  } catch {
    return "";
  }
}

function isHLSContentType(ct: string): boolean {
  return ct.includes("mpegurl") || ct.includes("m3u8");
}

function isDirectVideoContentType(ct: string): boolean {
  return (
    ct.startsWith("video/") ||
    ct === "application/octet-stream" ||
    ct === "application/mp4" ||
    ct === "application/x-matroska"
  );
}

// ---------------------------------------------------------------------------
// Short-lived cache so streamProxy HEAD requests can be answered without
// hitting the upstream again (avoids rate-limiting from server IP).
// ---------------------------------------------------------------------------
interface ProbeEntry {
  finalUrl: string;
  contentType: string;
  contentLength: string;
  strategy: "hls" | "direct" | "proxy";
  expiresAt: number;
}
const probeCache = new Map<string, ProbeEntry>();
const PROBE_TTL = 5 * 60_000; // 5 minutes

/** Called by streamProxy to answer HEAD requests from the cache. */
export function getCachedProbe(originalUrl: string): ProbeEntry | null {
  const entry = probeCache.get(originalUrl);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry;
}

/**
 * POST /api/streamProbe
 *
 * Determines how movi-player should load a scraper stream URL.
 *
 * Decision order:
 *  1. URL extension is a known video file → "direct" (no server request)
 *  2. URL extension is .m3u8 → "hls" (no server request)
 *  3. Follow redirects with HEAD → classify by final Content-Type
 *  4. If still ambiguous or rate-limited but final URL looks like video → "direct"
 *  5. Otherwise "proxy"
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url: targetUrl, headers: customHeaders = {} } = body as {
      url: string;
      headers?: Record<string, string>;
    };

    if (!targetUrl) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    // ── Fast-path: classify by URL extension without any network request ──────
    const ext = getUrlExt(targetUrl);
    if (DIRECT_VIDEO_EXTS.has(ext)) {
      return NextResponse.json(
        { finalUrl: targetUrl, contentType: "", strategy: "direct", probeStatus: 0 },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }
      );
    }
    if (HLS_EXTS.has(ext)) {
      return NextResponse.json(
        { finalUrl: targetUrl, contentType: "application/x-mpegURL", strategy: "hls", probeStatus: 0 },
        { status: 200, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }
      );
    }

    // ── Network probe: follow redirects and inspect Content-Type ─────────────
    const headersToSend: Record<string, string> = {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "*/*",
      "accept-language": "en-US,en;q=0.9",
    };

    Object.entries(customHeaders).forEach(([k, v]) => {
      const key = k.toLowerCase();
      if (!FORBIDDEN_UPSTREAM.has(key) && key !== "range") {
        headersToSend[key] = v;
      }
    });

    let currentUrl = targetUrl;
    let contentType = "";
    let contentLength = "";
    let status = 0;

    for (let i = 0; i < 8; i++) {
      let response: any;
      try {
        response = await axios({
          url: currentUrl,
          method: "HEAD",
          headers: headersToSend,
          httpsAgent: agent,
          maxRedirects: 0,
          validateStatus: () => true,
          timeout: 8_000,
        });
      } catch {
        break;
      }

      status = response.status;
      contentType = response.headers["content-type"] || "";
      contentLength = response.headers["content-length"] || "";

      if (status >= 300 && status < 400) {
        const location = response.headers["location"];
        if (location) {
          currentUrl = new URL(location, currentUrl).toString();
          continue;
        }
      }
      break;
    }

    // ── Classify based on probe result ─────────────────────────────────────
    const finalExt = getUrlExt(currentUrl);
    let strategy: "hls" | "direct" | "proxy";

    if (isHLSContentType(contentType) || HLS_EXTS.has(finalExt)) {
      strategy = "hls";
    } else if (
      (isDirectVideoContentType(contentType) && (status === 200 || status === 206)) ||
      DIRECT_VIDEO_EXTS.has(finalExt)
    ) {
      // Direct video file — also covers the case where the CDN returned a
      // rate-limit (429) from our server IP but the browser IP would work fine.
      strategy = "direct";
    } else if (status === 429 || status === 0) {
      // Rate-limited or unreachable from server IP — let the browser try directly.
      // If the final URL extension is a video file it's definitely "direct";
      // otherwise fall back to proxy so at least something loads.
      strategy = DIRECT_VIDEO_EXTS.has(finalExt) ? "direct" : "proxy";
    } else {
      strategy = "proxy";
    }

    // Cache result so streamProxy can answer HEAD requests without upstream calls
    const entry: ProbeEntry = {
      finalUrl: currentUrl,
      contentType,
      contentLength,
      strategy,
      expiresAt: Date.now() + PROBE_TTL,
    };
    probeCache.set(targetUrl, entry);
    probeCache.set(currentUrl, entry);

    return NextResponse.json(
      { finalUrl: currentUrl, contentType, strategy, probeStatus: status },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
