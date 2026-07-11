import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import https from "https";
import vm from "vm";
import crypto from "crypto";
import * as cheerioLib from "cheerio";

export const runtime = "nodejs";

const agent = new https.Agent({
  ciphers:
    "TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256",
  honorCipherOrder: true,
  minVersion: "TLSv1.2",
});

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

// Response deduplication cache — same URL+method within one scraper run reuse the same promise
const DEDUP_TTL = 60_000; // 1 minute
const dedupCache = new Map<string, { data: any; expiresAt: number }>();

function getDedupKey(url: string, method: string, headersJson: string): string {
  return `${method}:${url}:${headersJson}`;
}

async function serverFetch(url: string, method: string, headers: Record<string, string>, body?: string) {
  const dedupKey = getDedupKey(url, method, JSON.stringify(headers));
  const now = Date.now();
  const cached = dedupCache.get(dedupKey);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const headersToSend: Record<string, string> = {
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "accept-language": "en-US,en;q=0.9",
  };

  Object.entries(headers).forEach(([k, v]) => {
    const key = k.toLowerCase();
    if (!forbiddenHeaders.has(key)) {
      headersToSend[key] = v;
    }
  });

  const response = await axios({
    url,
    method: method as any,
    headers: headersToSend,
    data: body || undefined,
    httpsAgent: agent,
    validateStatus: () => true,
    responseType: "text",
  });

  const responseHeaders: Record<string, string> = {};
  Object.entries(response.headers).forEach(([k, v]) => {
    if (v !== undefined) {
      responseHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(", ") : String(v);
    }
  });

  const setCookies: string[] = [];
  const rawCookies = response.headers["set-cookie"];
  if (rawCookies) {
    if (Array.isArray(rawCookies)) setCookies.push(...rawCookies);
    else setCookies.push(rawCookies);
  }

  const result = {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    statusText: response.statusText || "",
    url,
    headers: responseHeaders,
    body: String(response.data || ""),
    setCookies,
  };

  // Only cache GET 200 responses
  if (method === "GET" && result.ok) {
    dedupCache.set(dedupKey, { data: result, expiresAt: now + DEDUP_TTL });
  }

  return result;
}

/** Build a fetch-compatible response object from our internal result */
function buildFetchResponse(result: any) {
  const headerObj: Record<string, string> = result.headers || {};
  return {
    ok: result.ok,
    status: result.status,
    statusText: result.statusText,
    url: result.url,
    headers: {
      get: (name: string) => headerObj[name.toLowerCase()] ?? null,
      has: (name: string) => name.toLowerCase() in headerObj,
      forEach: (cb: (v: string, k: string) => void) =>
        Object.entries(headerObj).forEach(([k, v]) => cb(v, k)),
    },
    clone: function () { return this; },
    text: async () => result.body,
    json: async () => {
      try { return JSON.parse(result.body); }
      catch { return null; }
    },
  };
}

/** Minimal cookie jar for server-side scraper execution */
function createCookieJar() {
  const jar: Map<string, string> = new Map();

  function setFromHeaders(url: string, setCookies: string[]) {
    for (const cookie of setCookies) {
      const [nameVal] = cookie.split(";");
      const [name, value] = nameVal.split("=");
      if (name && value !== undefined) {
        jar.set(name.trim(), `${name.trim()}=${value.trim()}`);
      }
    }
  }

  function getCookieHeader(): string {
    return Array.from(jar.values()).join("; ");
  }

  return { setFromHeaders, getCookieHeader };
}

export async function POST(req: NextRequest) {
  try {
    const { code, tmdbId, mediaType, season, episode, scraperId, settings } = await req.json();

    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Missing scraper code" }, { status: 400 });
    }

    const cookieJar = createCookieJar();

    // Server-side fetch polyfill used by the scraper
    const scraperFetch = async (url: string, options: any = {}) => {
      const method = (options.method || "GET").toUpperCase();
      const incomingHeaders: Record<string, string> = options.headers || {};
      const cookieHeader = cookieJar.getCookieHeader();
      if (cookieHeader) {
        incomingHeaders["Cookie"] = cookieHeader;
      }

      const result = await serverFetch(url, method, incomingHeaders, options.body);

      // Store cookies
      if (result.setCookies.length > 0) {
        cookieJar.setFromHeaders(url, result.setCookies);
      }

      return buildFetchResponse(result);
    };

    // Minimal URL polyfill for Node
    const URLImpl = URL;
    const URLSearchParamsImpl = URLSearchParams;

    const sandboxGlobals: any = {
      fetch: scraperFetch,
      SCRAPER_ID: scraperId || "",
      SCRAPER_SETTINGS: settings || {},
      URL: URLImpl,
      URLSearchParams: URLSearchParamsImpl,
      atob: (str: string) => Buffer.from(str, "base64").toString("binary"),
      btoa: (str: string) => Buffer.from(str, "binary").toString("base64"),
      TextEncoder,
      TextDecoder,
      console: {
        log: (...args: any[]) => console.log(`[ScraperServer:${scraperId}]`, ...args),
        error: (...args: any[]) => console.error(`[ScraperServer:${scraperId}]`, ...args),
        warn: (...args: any[]) => console.warn(`[ScraperServer:${scraperId}]`, ...args),
      },
    };

    // Inline CryptoJS (MD5 / SHA256 / AES — most common scraper uses)
    // We inject a minimal stub; real scrapers that need CryptoJS will get it via require
    const cryptoJsStub = {
      MD5: (s: string) => {
        return { toString: () => crypto.createHash("md5").update(s).digest("hex") };
      },
      SHA256: (s: string) => {
        return { toString: () => crypto.createHash("sha256").update(s).digest("hex") };
      },
      enc: { Utf8: "utf8", Base64: "base64", Hex: "hex" },
    };

    sandboxGlobals.CryptoJS = cryptoJsStub;
    sandboxGlobals.require = (mod: string) => {
      if (["cheerio", "cheerio-without-node-native", "react-native-cheerio"].includes(mod)) {
        return cheerioLib;
      }
      if (mod === "crypto-js") return cryptoJsStub;
      throw new Error(`Module '${mod}' not available in server scraper sandbox`);
    };

    const keys = Object.keys(sandboxGlobals);
    const wrapperCode = `
      const { ${keys.join(", ")} } = __globals;
      var module = { exports: {} };
      var exports = module.exports;
      var globalThis = __globals;
      var global = __globals;
      var window = __globals;
      var self = __globals;

      (function() {
        ${code}
      })();

      var getStreams = module.exports.getStreams || globalThis.getStreams;
      if (!getStreams) throw new Error("getStreams not found in scraper");
      return getStreams(tmdbId, mediaType, season, episode);
    `;

    const vmContext = vm.createContext({ __globals: sandboxGlobals });
    const script = new vm.Script(`(async function(tmdbId, mediaType, season, episode) { ${wrapperCode} })(tmdbId, mediaType, season, episode)`, {
      filename: `scraper-${scraperId}.js`,
    });

    // Inject runtime args into context
    vmContext.tmdbId = tmdbId;
    vmContext.mediaType = mediaType;
    vmContext.season = season ?? null;
    vmContext.episode = episode ?? null;

    const promise = script.runInContext(vmContext);
    const results = await promise;

    return NextResponse.json(
      { results: Array.isArray(results) ? results : [] },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err: any) {
    console.error("[scraperRun] Error:", err);
    return NextResponse.json(
      { error: String(err), results: [] },
      { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
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
