import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";

export const runtime = "nodejs";

const agent = new https.Agent({
  ciphers: "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256",
  honorCipherOrder: true,
  minVersion: "TLSv1.2",
});

async function streamToText(stream: any): Promise<string> {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const targetUrl = searchParams.get("url");
  if (!targetUrl) {
    return new NextResponse("Missing url parameter", { status: 400 });
  }

  const customHeadersStr = searchParams.get("headers") || "{}";
  let customHeaders: Record<string, string> = {};
  try {
    customHeaders = JSON.parse(customHeadersStr);
  } catch (_) { }

  // Build headers to send mimicking a real browser
  const headersToSend: Record<string, string> = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "accept": "*/*",
    "accept-language": "en-US,en;q=0.9",
  };

  const forbiddenHeaders = new Set([
    "host",
    "connection",
    "origin",
    "content-length",
    "sec-fetch-dest",
    "sec-fetch-mode",
    "sec-fetch-site",
    "sec-fetch-user",
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
    "accept-encoding",
  ]);

  // Merge custom and request range headers
  if (customHeaders && typeof customHeaders === "object") {
    Object.entries(customHeaders).forEach(([k, v]) => {
      const key = k.toLowerCase();
      if (!forbiddenHeaders.has(key)) {
        headersToSend[key] = v as string;
      }
    });
  }

  const range = req.headers.get("range");
  if (range) {
    headersToSend["range"] = range;
  }

  try {
    let currentUrl = targetUrl;
    let response: any = null;
    let redirectCount = 0;
    const maxRedirects = 5;

    // Follow redirects manually with Chrome TLS fingerprints preserved
    while (redirectCount < maxRedirects) {
      response = await axios({
        url: currentUrl,
        method: "GET",
        headers: headersToSend,
        httpsAgent: agent,
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        responseType: "stream",
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location;
        if (location) {
          currentUrl = new URL(location, currentUrl).toString();
          redirectCount++;
          continue;
        }
      }
      break;
    }

    if (!response) {
      return new NextResponse("Failed to fetch target URL", { status: 500 });
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
        status: response.status,
        headers: {
          "Content-Type": "application/x-mpegURL",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    }

    // Copy relevant headers for streaming media content
    const responseHeaders = new Headers();
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    const headersToCopy = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
    ];

    headersToCopy.forEach((header) => {
      const val = response.headers[header];
      if (val !== undefined) {
        responseHeaders.set(header, Array.isArray(val) ? val.join(", ") : String(val));
      }
    });

    return new NextResponse(response.data, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new NextResponse(`Proxy error: ${String(err)}`, { status: 500 });
  }
}

function rewriteM3U8(content: string, baseUrl: string, headersJson: string): string {
  const lines = content.split(/\r?\n/);
  const rewrittenLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return line;

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
      const proxied = `/api/streamProxy?url=${encodeURIComponent(resolved)}&headers=${encodeURIComponent(headersJson)}`;
      return proxied;
    } catch {
      return line;
    }
  });

  return rewrittenLines.join("\n");
}
