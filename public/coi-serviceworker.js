/*! coi-serviceworker - custom build for NuvioWeb
 *
 *  Injects COOP/COEP headers on same-origin requests, and CORP headers on
 *  cross-origin requests so that SharedArrayBuffer works in Safari (iOS/iPadOS/macOS).
 *
 *  Bypasses HMR/hot-reload and opaque responses (like TMDB images) to prevent loops and breaks.
 */

if (typeof window === "undefined") {
  // ── SERVICE WORKER CONTEXT ─────────────────────────────────────────────────

  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener("fetch", (e) => {
    const req = e.request;
    const url = new URL(req.url);

    // 1. Bypass Next.js hot-reloading / HMR / EventSource connections to prevent request loops
    if (
      url.pathname.includes("/_next/webpack-hmr") ||
      url.pathname.includes("/__nextjs_original-stack-frame") ||
      req.headers.get("Accept") === "text/event-stream"
    ) {
      return;
    }

    // 1b. Bypass ALL image requests — let the browser load them natively.
    // App thumbnails use crossOrigin="anonymous" and their CDNs (TMDB, poster
    // hosts) respond with CORS, which already satisfies COEP: require-corp.
    // Reconstructing an image response here (new Response(res.body, ...)) can
    // strip that CORS approval and, combined with Safari's cache, produces the
    // intermittent broken-thumbnail bug. Skipping images does NOT affect the
    // document's COOP/COEP isolation headers (SharedArrayBuffer) or cross-origin
    // video segments, so playback behaviour is unchanged.
    if (req.destination === "image" || req.destination === "video" || req.destination === "audio") {
      return;
    }

    e.respondWith(
      fetch(req)
        .then((res) => {
          // 2. If the response is opaque (status 0), we cannot modify its headers.
          // Return it directly to prevent breaking cross-origin images (like TMDB).
          if (res.status === 0 || res.type === "opaque") {
            return res;
          }

          const headers = new Headers(res.headers);

          if (url.origin === self.location.origin) {
            // Same-origin resources need COOP/COEP to enable isolation
            headers.set("Cross-Origin-Opener-Policy", "same-origin");
            headers.set("Cross-Origin-Embedder-Policy", "require-corp");
          } else {
            // Cross-origin resources (like Torbox stream segments) must permit being loaded under require-corp
            headers.set("Cross-Origin-Resource-Policy", "cross-origin");
          }

          return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers,
          });
        })
        .catch(() => fetch(req))
    );
  });

} else {
  // ── PAGE CONTEXT ────────────────────────────────────────────────────────────

  (async () => {
    if (!navigator.serviceWorker) return;

    const isOnPlayerPage = window.location.pathname.startsWith("/player");

    // Detect iOS/iPadOS (all browsers use WebKit on iOS and need the SW)
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(navigator.userAgent));

    // Detect desktop Safari (macOS)
    const isDesktopSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    // We only need the service worker fallback on iOS/Safari.
    const needsSW = isIOS || isDesktopSafari;

    if (!needsSW) {
      // Clean up the service worker if it was registered with scope "/"
      // (which would affect dashboard/homepage and cause CORS/COOP/COEP issues)
      // or if we are on a browser that supports COEP: credentialless natively.
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        let unregisteredAny = false;
        for (const reg of registrations) {
          const scopeUrl = new URL(reg.scope);
          if (scopeUrl.pathname === "/") {
            await reg.unregister();
            unregisteredAny = true;
            console.log("[coi-sw] Unregistered root service worker to prevent CORS issues.");
          }
        }
        if (unregisteredAny && navigator.serviceWorker.controller) {
          // Force reload to clear the service worker controller and reset page isolation
          window.location.reload();
        }
      } catch (e) {
        console.error("[coi-sw] Error cleaning up root service worker:", e);
      }
      return;
    }

    // On iOS/Safari and on the player page:
    if (window.crossOriginIsolated) return;
    if (!window.isSecureContext) return;

    try {
      const scriptSrc = document.currentScript ? document.currentScript.src : "/coi-serviceworker.js";
      const reg = await navigator.serviceWorker.register(
        scriptSrc,
        { scope: "/" }
      );

      // Force reload once when service worker becomes active to apply COOP/COEP headers to the document.
      if (reg.active && !navigator.serviceWorker.controller) {
        window.location.reload();
      }
    } catch (err) {
      console.warn("[coi-sw] registration failed:", err);
    }
  })();
}