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

    // Permanently uninstall the Service Worker polyfill.
    // WebKit (iOS Safari / Brave iOS) crashes when a Service Worker intercepts native MP4 video streams.
    // Since Shaka Player doesn't strictly need SharedArrayBuffer, we can rely entirely on next.config.ts
    // for Chrome/Android isolation, and let iOS degrade gracefully to native playback without SW interference.
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      let unregisteredAny = false;
      for (const reg of registrations) {
        await reg.unregister();
        unregisteredAny = true;
      }
      if (unregisteredAny && navigator.serviceWorker.controller) {
        console.log("[coi-sw] Unregistered legacy service worker. Reloading to clear isolation state.");
        window.location.reload();
      }
    } catch (e) {
      console.warn("[coi-sw] cleanup failed:", e);
    }
  })();
}