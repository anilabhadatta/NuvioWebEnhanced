import CryptoJS from "crypto-js";

// Memory cache for scraper JS codes to avoid fetching multiple times
const scraperCodeCache: Record<string, string> = {};

// Helper to load/poly-fill cheerio in browser using DOMParser
const cheerioPolyfill = {
  load: function (htmlString: string) {
    let doc: Document;
    if (typeof window !== "undefined") {
      const parser = new DOMParser();
      doc = parser.parseFromString(htmlString || "", "text/html");
    } else {
      // Server-side fallback (if ever run on server)
      doc = {} as Document;
    }

    function wrapElements(elements: Element[]): any {
      const wrapper: any = {
        length: elements.length,
        each: function (callback: (idx: number, el: any) => void) {
          for (let i = 0; i < elements.length; i++) {
            const elWrapper = wrapElements([elements[i]]);
            callback.call(elWrapper, i, elWrapper);
          }
          return wrapper;
        },
        find: function (selector: string) {
          const found: Element[] = [];
          for (let i = 0; i < elements.length; i++) {
            const children = elements[i].querySelectorAll(selector);
            children.forEach((el) => found.push(el));
          }
          return wrapElements(found);
        },
        text: function () {
          return elements.map((el) => el.textContent || "").join("");
        },
        html: function () {
          if (elements.length === 0) return "";
          return elements[0].innerHTML || "";
        },
        attr: function (name: string) {
          if (elements.length === 0) return undefined;
          const val = elements[0].getAttribute(name);
          return val === null ? undefined : val;
        },
        first: function () {
          return wrapElements(elements.length > 0 ? [elements[0]] : []);
        },
        last: function () {
          return wrapElements(elements.length > 0 ? [elements[elements.length - 1]] : []);
        },
        next: function () {
          const nextEls = elements.map((el) => el.nextElementSibling).filter(Boolean) as Element[];
          return wrapElements(nextEls);
        },
        prev: function () {
          const prevEls = elements.map((el) => el.previousElementSibling).filter(Boolean) as Element[];
          return wrapElements(prevEls);
        },
        eq: function (index: number) {
          if (index >= 0 && index < elements.length) return wrapElements([elements[index]]);
          return wrapElements([]);
        },
        get: function (index?: number) {
          if (typeof index === "number") {
            return elements[index];
          }
          return elements;
        },
        children: function (sel?: string) {
          const children: Element[] = [];
          for (let i = 0; i < elements.length; i++) {
            const elChildren = Array.from(elements[i].children);
            elChildren.forEach((child) => {
              if (!sel || child.matches(sel)) {
                children.push(child);
              }
            });
          }
          return wrapElements(children);
        },
        parent: function () {
          const parents = elements.map((el) => el.parentElement).filter(Boolean) as Element[];
          return wrapElements(Array.from(new Set(parents)));
        },
        map: function (callback: (idx: number, el: any) => any) {
          const results: any[] = [];
          for (let i = 0; i < elements.length; i++) {
            const elWrapper = wrapElements([elements[i]]);
            const res = callback.call(elWrapper, i, elWrapper);
            if (res !== undefined && res !== null) results.push(res);
          }
          return {
            length: results.length,
            get: function (idx?: number) { return typeof idx === "number" ? results[idx] : results; },
            toArray: function () { return results; },
          };
        },
        filter: function (selectorOrCallback: string | ((idx: number, el: any) => boolean)) {
          if (typeof selectorOrCallback === "function") {
            const filtered: Element[] = [];
            for (let i = 0; i < elements.length; i++) {
              const elWrapper = wrapElements([elements[i]]);
              if (selectorOrCallback.call(elWrapper, i, elWrapper)) {
                filtered.push(elements[i]);
              }
            }
            return wrapElements(filtered);
          } else if (typeof selectorOrCallback === "string") {
            const filtered = elements.filter((el) => el.matches && el.matches(selectorOrCallback));
            return wrapElements(filtered);
          }
          return wrapper;
        },
        toArray: function () {
          return elements.map((el) => wrapElements([el]));
        },
      };

      // Expose numerical indices directly on the wrapper object
      for (let i = 0; i < elements.length; i++) {
        wrapper[i] = elements[i];
      }

      return wrapper;
    }

    const $: any = function (selector: any, context: any) {
      if (selector && typeof selector !== "string") {
        if (selector.length !== undefined && (selector[0] instanceof Element || selector.each !== undefined)) {
          return selector;
        }
        if (selector instanceof Element) {
          return wrapElements([selector]);
        }
      }
      if (context) {
        const contextEl = context instanceof Element ? context : (context[0] || doc.body);
        const els = Array.from(contextEl.querySelectorAll(selector)) as Element[];
        return wrapElements(els);
      }
      const els = Array.from(doc.querySelectorAll(selector)) as Element[];
      return wrapElements(els);
    };

    $.html = function (el: any) {
      if (el) {
        const element = el instanceof Element ? el : el[0];
        return element ? element.outerHTML : "";
      }
      return doc.documentElement.outerHTML;
    };

    return $;
  },
};

interface Cookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
}

const cookieJar: Cookie[] = [];

function getDomainFromUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    return url.hostname.replace(/^\./, "");
  } catch {
    return "";
  }
}

function parseSetCookie(cookieStr: string, defaultDomain: string): Cookie | null {
  const parts = cookieStr.split(";").map((p) => p.trim());
  if (parts.length === 0 || !parts[0]) return null;

  const keyValue = parts[0].split("=");
  if (keyValue.length < 2) return null;
  const name = keyValue[0].trim();
  const value = keyValue.slice(1).join("=").trim();

  let domain = defaultDomain;
  let path = "/";
  let expires: number | undefined;

  for (let i = 1; i < parts.length; i++) {
    const pair = parts[i].split("=");
    const key = pair[0].trim().toLowerCase();
    const val = pair[1] ? pair[1].trim() : "";

    if (key === "domain" && val) {
      domain = val.replace(/^\./, "");
    } else if (key === "path" && val) {
      path = val;
    } else if (key === "max-age" && val) {
      const seconds = parseInt(val, 10);
      if (!isNaN(seconds)) {
        expires = Date.now() + seconds * 1000;
      }
    } else if (key === "expires" && val) {
      const ms = Date.parse(val);
      if (!isNaN(ms)) {
        expires = ms;
      }
    }
  }

  return { name, value, domain, path, expires };
}

function storeCookies(url: string, setCookies: string[]) {
  const defaultDomain = getDomainFromUrl(url);
  if (!defaultDomain) return;

  for (const cookieStr of setCookies) {
    const cookie = parseSetCookie(cookieStr, defaultDomain);
    if (!cookie) continue;

    const index = cookieJar.findIndex(
      (c) => c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path
    );
    if (index !== -1) {
      cookieJar.splice(index, 1);
    }
    cookieJar.push(cookie);
  }
}

function getCookiesForUrl(urlStr: string): string {
  const domain = getDomainFromUrl(urlStr);
  if (!domain) return "";

  let path = "/";
  try {
    const url = new URL(urlStr);
    path = url.pathname || "/";
  } catch {}

  const now = Date.now();
  const matched = cookieJar.filter((c) => {
    if (c.expires && c.expires < now) return false;
    const domainMatch = domain === c.domain || domain.endsWith("." + c.domain);
    if (!domainMatch) return false;
    return path.startsWith(c.path);
  });

  if (matched.length === 0) return "";
  return matched.map((c) => `${c.name}=${c.value}`).join("; ");
}

// ---------------------------------------------------------------------------
// Micro-batch proxy: collects all fetch calls that arrive within a single JS
// microtask tick and sends them as ONE bulk POST to /api/proxyBulk.
// This reduces 500+ individual /api/proxy calls to a handful of bulk calls.
// ---------------------------------------------------------------------------

interface PendingRequest {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}

let _batchQueue: PendingRequest[] = [];
let _batchScheduled = false;
let _batchIdCounter = 0;

function buildFetchResponse(parsed: any, url: string) {
  const responseHeaders = new Headers();
  if (parsed.headers) {
    Object.entries(parsed.headers).forEach(([k, v]) => {
      responseHeaders.append(k, v as string);
    });
  }
  if (parsed.setCookies && Array.isArray(parsed.setCookies)) {
    storeCookies(url, parsed.setCookies);
  }
  return {
    ok: parsed.ok,
    status: parsed.status,
    statusText: parsed.statusText,
    url: parsed.url || url,
    headers: responseHeaders,
    clone: function () { return this; },
    text: () => Promise.resolve(parsed.body),
    json: () => {
      try { return Promise.resolve(JSON.parse(parsed.body)); }
      catch { return Promise.resolve(null); }
    },
  };
}

async function flushBatch() {
  const batch = _batchQueue;
  _batchQueue = [];
  _batchScheduled = false;

  if (batch.length === 0) return;

  try {
    const res = await fetch("/api/proxyBulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: batch.map(({ id, url, method, headers, body }) => ({
          id,
          url,
          method,
          headers,
          body,
        })),
      }),
    });

    if (!res.ok) {
      const err = new Error(`Bulk proxy failed: ${res.statusText}`);
      batch.forEach((p) => p.reject(err));
      return;
    }

    const data = await res.json();
    const responseMap = new Map<string, any>();
    (data.responses || []).forEach((r: any) => responseMap.set(r.id, r));

    batch.forEach((pending) => {
      const parsed = responseMap.get(pending.id);
      if (!parsed) {
        pending.reject(new Error("No response returned for request " + pending.id));
        return;
      }
      if (parsed.error) {
        pending.reject(new Error(parsed.error));
        return;
      }
      pending.resolve(buildFetchResponse(parsed, pending.url));
    });
  } catch (err) {
    batch.forEach((p) => p.reject(err));
  }
}

// Polyfilled fetch that coalesces all scraper HTTP requests into bulk proxy calls
const customFetch = (url: string, options: any = {}): Promise<any> => {
  const lowerUrl = url.toLowerCase();
  const shouldProxy =
    !url.startsWith("/") &&
    !lowerUrl.includes("localhost") &&
    !lowerUrl.includes("127.0.0.1") &&
    !lowerUrl.includes("api.themoviedb.org") &&
    !lowerUrl.includes("api.trakt.tv");

  if (!shouldProxy) {
    return window.fetch(url, options);
  }

  const method = (options.method || "GET").toUpperCase();
  const incomingHeaders = options.headers || {};

  // Attach cookies from our client-side cookie jar
  const cookieHeader = getCookiesForUrl(url);
  const headers = { ...incomingHeaders };
  if (cookieHeader) {
    headers["Cookie"] = cookieHeader;
  }

  const body = options.body || "";

  return new Promise((resolve, reject) => {
    const id = String(++_batchIdCounter);
    _batchQueue.push({ id, url, method, headers, body, resolve, reject });

    if (!_batchScheduled) {
      _batchScheduled = true;
      // Use queueMicrotask so the batch flushes after all synchronous scraper
      // setup is done but before any await resumes — maximising batch size.
      queueMicrotask(flushBatch);
    }
  });
};


// Require polyfill to return cheerio and CryptoJS
const customRequire = (moduleName: string) => {
  if (
    moduleName === "cheerio" ||
    moduleName === "cheerio-without-node-native" ||
    moduleName === "react-native-cheerio"
  ) {
    return cheerioPolyfill;
  }
  if (moduleName === "crypto-js") {
    return CryptoJS;
  }
  throw new Error(`Module '${moduleName}' is not available in scraper sandbox`);
};

// Load the scraper JS code
async function loadScraperCode(url: string): Promise<string | null> {
  if (scraperCodeCache[url]) {
    return scraperCodeCache[url];
  }
  try {
    const res = await fetch(url);
    if (!res.ok) {
      // Try proxying if direct raw download fails
      const proxyRes = await customFetch(url);
      const code = await proxyRes.text();
      if (code) {
        scraperCodeCache[url] = code;
        return code;
      }
      return null;
    }
    const code = await res.text();
    scraperCodeCache[url] = code;
    return code;
  } catch (err) {
    console.error("Failed to load scraper code from:", url, err);
    return null;
  }
}

/**
 * Executes a scraper plugin.
 *
 * Primary path: POST the scraper code + params to /api/scraperRun where Node.js
 * runs it server-side. All HTTP requests the scraper makes are performed directly
 * from the server (no browser→proxy round trips = zero /api/proxy calls).
 *
 * Fallback path: if the server route is unavailable, run the scraper in the
 * browser sandbox (original behaviour).
 */
export async function executeScraper(
  manifestUrl: string,
  filename: string,
  tmdbId: string,
  mediaType: string,
  season?: number,
  episode?: number,
  scraperId?: string,
  settings?: any
): Promise<any[]> {
  const baseUrl = manifestUrl.split("?")[0].split("/manifest.json")[0];
  const codeUrl = filename.startsWith("http://") || filename.startsWith("https://")
    ? filename
    : `${baseUrl}/${filename.replace(/^\//, "")}`;

  const code = await loadScraperCode(codeUrl);
  if (!code) {
    throw new Error(`Failed to load code for scraper: ${scraperId || filename}`);
  }

  // ── Server-side execution (primary) ───────────────────────────────────────
  try {
    const res = await fetch("/api/scraperRun", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, tmdbId, mediaType, season, episode, scraperId, settings }),
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.results)) {
        return data.results;
      }
      if (data.error) {
        console.warn(`[scraperRun] Server error for ${scraperId}, falling back:`, data.error);
      }
    }
  } catch (serverErr) {
    console.warn(`[scraperRun] Server route unavailable for ${scraperId}, falling back:`, serverErr);
  }

  // ── Browser sandbox fallback ───────────────────────────────────────────────
  return runScraperInBrowser(code, tmdbId, mediaType, season, episode, scraperId, settings);
}

async function runScraperInBrowser(
  code: string,
  tmdbId: string,
  mediaType: string,
  season?: number,
  episode?: number,
  scraperId?: string,
  settings?: any
): Promise<any[]> {
  // Create sandbox global state
  const sandboxGlobals: any = {
    CryptoJS,
    cheerio: cheerioPolyfill,
    require: customRequire,
    console: {
      log: (...args: any[]) => console.log(`[Scraper: ${scraperId || "Plugin"}]`, ...args),
      error: (...args: any[]) => console.error(`[Scraper: ${scraperId || "Plugin"}]`, ...args),
      warn: (...args: any[]) => console.warn(`[Scraper: ${scraperId || "Plugin"}]`, ...args),
    },
    fetch: customFetch,
    SCRAPER_ID: scraperId || "",
    SCRAPER_SETTINGS: settings || {},
  };

  if (typeof window !== "undefined") {
    sandboxGlobals.URL = window.URL;
    sandboxGlobals.URLSearchParams = window.URLSearchParams;
    sandboxGlobals.AbortController = window.AbortController;
    sandboxGlobals.AbortSignal = window.AbortSignal;
    sandboxGlobals.atob = window.atob;
    sandboxGlobals.btoa = window.btoa;
    sandboxGlobals.TextEncoder = window.TextEncoder;
    sandboxGlobals.TextDecoder = window.TextDecoder;
  }

  // Bind references to globalThis, global, self, and window within the sandbox
  sandboxGlobals.globalThis = sandboxGlobals;
  sandboxGlobals.global = sandboxGlobals;
  sandboxGlobals.window = sandboxGlobals;
  sandboxGlobals.self = sandboxGlobals;

  // We wrap the code in a Function and call it with the sandboxGlobals as the context 'this'
  const keys = Object.keys(sandboxGlobals);
  const values = Object.values(sandboxGlobals);

  const wrapperCode = `
    const { ${keys.join(", ")} } = this;
    var module = { exports: {} };
    var exports = module.exports;
    
    (function() {
      ${code}
    })();
    
    var getStreams = module.exports.getStreams || globalThis.getStreams;
    if (!getStreams) {
      throw new Error("getStreams function not found");
    }
    return getStreams(tmdbId, mediaType, season, episode);
  `;

  try {
    const fn = new Function("tmdbId", "mediaType", "season", "episode", wrapperCode);
    const results = await fn.call(sandboxGlobals, tmdbId, mediaType, season, episode);
    return Array.isArray(results) ? results : [];
  } catch (err: any) {
    console.error(`Error running scraper ${scraperId || "unknown"}:`, err);
    return [];
  }
}

export async function executeGetSettingsLayout(
  manifestUrl: string,
  filename: string,
  scraperId?: string
): Promise<any[] | null> {
  const baseUrl = manifestUrl.split("?")[0].split("/manifest.json")[0];
  const codeUrl = filename.startsWith("http://") || filename.startsWith("https://")
    ? filename
    : `${baseUrl}/${filename.replace(/^\//, "")}`;

  const code = await loadScraperCode(codeUrl);
  if (!code) {
    return null;
  }

  // Create sandbox global state
  const sandboxGlobals: any = {
    CryptoJS,
    cheerio: cheerioPolyfill,
    require: customRequire,
    console: {
      log: (...args: any[]) => console.log(`[ScraperLayout: ${scraperId || "Plugin"}]`, ...args),
      error: (...args: any[]) => console.error(`[ScraperLayout: ${scraperId || "Plugin"}]`, ...args),
      warn: (...args: any[]) => console.warn(`[ScraperLayout: ${scraperId || "Plugin"}]`, ...args),
    },
    fetch: customFetch,
    SCRAPER_ID: scraperId || "",
    SCRAPER_SETTINGS: {},
  };

  if (typeof window !== "undefined") {
    sandboxGlobals.URL = window.URL;
    sandboxGlobals.URLSearchParams = window.URLSearchParams;
    sandboxGlobals.AbortController = window.AbortController;
    sandboxGlobals.AbortSignal = window.AbortSignal;
    sandboxGlobals.atob = window.atob;
    sandboxGlobals.btoa = window.btoa;
    sandboxGlobals.TextEncoder = window.TextEncoder;
    sandboxGlobals.TextDecoder = window.TextDecoder;
  }

  // Bind references to globalThis, global, self, and window within the sandbox
  sandboxGlobals.globalThis = sandboxGlobals;
  sandboxGlobals.global = sandboxGlobals;
  sandboxGlobals.window = sandboxGlobals;
  sandboxGlobals.self = sandboxGlobals;

  // We wrap the code in a Function and call it with the sandboxGlobals as the context 'this'
  const keys = Object.keys(sandboxGlobals);

  const wrapperCode = `
    const { ${keys.join(", ")} } = this;
    var module = { exports: {} };
    var exports = module.exports;
    
    (function() {
      ${code}
    })();
    
    var getSettingsLayout = module.exports.getSettingsLayout || globalThis.getSettingsLayout;
    if (!getSettingsLayout) {
      return null;
    }
    return getSettingsLayout();
  `;

  try {
    const fn = new Function(wrapperCode);
    const results = await fn.call(sandboxGlobals);
    return Array.isArray(results) ? results : null;
  } catch (err: any) {
    console.error(`Error getting settings layout for ${scraperId || filename}:`, err);
    return null;
  }
}

