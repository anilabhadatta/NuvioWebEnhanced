import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";

export const runtime = "nodejs";

const agent = new https.Agent({
  ciphers: "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256",
  honorCipherOrder: true,
  minVersion: "TLSv1.2",
});

interface CacheEntry {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  setCookies: string[];
  expiresAt: number;
}

// Memory cache for proxy GET requests
const proxyCache = new Map<string, CacheEntry>();
const MAX_CACHE_ENTRIES = 500;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

export async function POST(req: NextRequest) {
  try {
    const { url, method, headers, body } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "Missing url" }, { status: 400 });
    }

    const reqMethod = (method || "GET").toUpperCase();

    // Check memory cache for GET requests
    const cacheKey = `${reqMethod}_${url}_${JSON.stringify(headers || {})}`;
    if (reqMethod === "GET") {
      const cached = proxyCache.get(cacheKey);
      const now = Date.now();
      if (cached && cached.expiresAt > now) {
        return NextResponse.json(
          {
            ok: cached.ok,
            status: cached.status,
            statusText: cached.statusText,
            url: cached.url,
            headers: cached.headers,
            body: cached.body,
            setCookies: cached.setCookies,
          },
          {
            status: 200,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-store",
              "X-Proxy-Cache": "HIT",
            },
          }
        );
      }
    }

    // Build headers to send mimicking a real browser
    const headersToSend: Record<string, string> = {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
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

    if (headers && typeof headers === "object") {
      Object.entries(headers).forEach(([k, v]) => {
        const key = k.toLowerCase();
        if (forbiddenHeaders.has(key)) {
          return;
        }
        if (key === "referer") {
          const val = String(v);
          if (val.startsWith("http://localhost") || val.startsWith("https://localhost") || val.includes("127.0.0.1")) {
            return;
          }
        }
        headersToSend[key] = v as string;
      });
    }

    // Perform request using axios + custom httpsAgent (Chrome TLS ciphers)
    const response = await axios({
      url,
      method: reqMethod as any,
      headers: headersToSend,
      data: body || undefined,
      httpsAgent: agent,
      validateStatus: () => true, // Don't throw on error status codes
      responseType: "text",
    });

    const responseBody = response.data || "";

    // Map response headers to a plain object
    const responseHeaders: Record<string, string> = {};
    Object.entries(response.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        responseHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : String(value);
      }
    });

    // Capture set-cookie values
    const setCookies: string[] = [];
    const rawCookies = response.headers["set-cookie"];
    if (rawCookies) {
      if (Array.isArray(rawCookies)) {
        setCookies.push(...rawCookies);
      } else {
        setCookies.push(rawCookies);
      }
    }

    const ok = response.status >= 200 && response.status < 300;

    // Store in cache
    if (reqMethod === "GET") {
      if (proxyCache.size >= MAX_CACHE_ENTRIES) {
        const now = Date.now();
        for (const [key, val] of proxyCache.entries()) {
          if (val.expiresAt < now) {
            proxyCache.delete(key);
          }
        }
        if (proxyCache.size >= MAX_CACHE_ENTRIES) {
          const oldestKey = proxyCache.keys().next().value;
          if (oldestKey) proxyCache.delete(oldestKey);
        }
      }

      proxyCache.set(cacheKey, {
        ok,
        status: response.status,
        statusText: response.statusText || "",
        url,
        headers: responseHeaders,
        body: responseBody,
        setCookies,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }

    return NextResponse.json(
      {
        ok,
        status: response.status,
        statusText: response.statusText || "",
        url,
        headers: responseHeaders,
        body: responseBody,
        setCookies,
      },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "X-Proxy-Cache": "MISS",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to proxy request", detail: String(err) },
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
