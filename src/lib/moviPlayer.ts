export const MOVI_PLAYER_CDN_URL = "https://cdn.jsdelivr.net/npm/movi-player@0.4.0/dist/element.js";

let moviPlayerLoadPromise: Promise<void> | null = null;

export function ensureMoviPlayerLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();

  if (!(window as any).__nuvio_fetch_429_polyfilled) {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      let retries = 3;
      while (retries > 0) {
        const res = await originalFetch.apply(this, args);
        if (res.status === 429) {
          retries--;
          if (retries === 0) return res;
          console.warn("[Fetch] Intercepted 429 rate limit, retrying in 1.5s...", args[0]);
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return res;
      }
      return originalFetch.apply(this, args);
    };
    (window as any).__nuvio_fetch_429_polyfilled = true;
  }

  if (moviPlayerLoadPromise) return moviPlayerLoadPromise;
  if (customElements.get("movi-player")) return Promise.resolve();
  moviPlayerLoadPromise = new Promise<void>(async (resolve, reject) => {
    const existing = document.querySelector('script[data-nuvio-movi-player]') as HTMLScriptElement | null;
    if (existing) {
      customElements.whenDefined("movi-player").then(() => resolve());
      return;
    }
    const source = localStorage.getItem("nuvio.element_js_source_v3.5") || "cdn";
    const scriptUrl = source === "local" ? "/element.js" : MOVI_PLAYER_CDN_URL;
    console.log(`[Player] Loading player core from ${source} source: ${scriptUrl}`);

    let finalSrc = scriptUrl;

    try {
      if ("caches" in window) {
        const cache = await caches.open("nuvio-player-cache");
        let res = await cache.match(scriptUrl);
        if (!res) {
          console.log(`[Player] Fetching and caching ${scriptUrl}`);
          res = await fetch(scriptUrl);
          if (res.ok) {
            await cache.put(scriptUrl, res.clone());
          } else {
            throw new Error(`HTTP ${res.status}`);
          }
        } else {
          console.log(`[Player] Loaded from cache: ${scriptUrl}`);
        }
        
        const blob = await res.blob();
        finalSrc = URL.createObjectURL(blob);
      }
    } catch (e) {
      console.warn("[Player] Cache failed, falling back to direct src", e);
    }

    const s = document.createElement("script");
    s.type = "module";
    s.src = finalSrc;
    s.async = false;
    s.crossOrigin = "anonymous";
    s.dataset.nuvioMoviPlayer = "true";
    s.onload = () => {
      customElements.whenDefined("movi-player").then(() => resolve());
    };
    s.onerror = () => reject(new Error(`Failed to load ${scriptUrl}`));
    document.head.appendChild(s);
  });
  return moviPlayerLoadPromise;
}

export function precacheMoviPlayer() {
  if (typeof window === "undefined" || !("caches" in window)) return;
  const source = localStorage.getItem("nuvio.element_js_source_v3.5") || "cdn";
  const scriptUrl = source === "local" ? "/element.js" : MOVI_PLAYER_CDN_URL;
  caches.open("nuvio-player-cache").then(cache => {
    cache.match(scriptUrl).then(res => {
      if (!res) {
        fetch(scriptUrl).then(fetchRes => {
          if (fetchRes.ok) {
            cache.put(scriptUrl, fetchRes);
            console.log(`[Player] Pre-cached ${scriptUrl}`);
          }
        }).catch(e => console.warn("Pre-cache failed:", e));
      }
    });
  });
}
