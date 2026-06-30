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

    // Detect Safari (iOS, iPadOS, macOS)
    const isSafari =
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(navigator.userAgent));

    if (!isSafari) {
      // Clean up the service worker if it was registered on non-Safari browsers (Chrome, Firefox, etc.)
      // since they natively support COEP: credentialless from next.config.ts and don't need the SW.
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      } catch (e) {}
      return;
    }

    // On Safari, if already isolated, skip registration
    if (window.crossOriginIsolated) return;
    if (!window.isSecureContext) return;

    try {
      const reg = await navigator.serviceWorker.register(
        document.currentScript.src,
        { scope: "/" }
      );

      // Force reload once when service worker becomes active to apply COOP/COEP headers to the document
      if (reg.active && !navigator.serviceWorker.controller) {
        window.location.reload();
      }
    } catch (err) {
      console.warn("[coi-sw] registration failed:", err);
    }
  })();
}