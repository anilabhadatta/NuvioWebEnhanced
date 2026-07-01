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

    // 2. Bypass all cross-origin requests (like TMDB, jsdelivr, Torbox).
    // WebKit/Safari crashes or throws 405 errors when a Service Worker attempts to reconstruct
    // cross-origin responses. Since we use crossOrigin="anonymous" on images/scripts, they
    // pass COEP requirements natively without Service Worker header injection.
    if (url.origin !== self.location.origin) {
      return;
    }

    e.respondWith(
      fetch(req)
        .then((res) => {
          // 3. If the response is opaque (status 0), we cannot modify its headers.
          if (res.status === 0 || res.type === "opaque") {
            return res;
          }

          const headers = new Headers(res.headers);

          // We only intercept same-origin resources to inject COOP/COEP
          headers.set("Cross-Origin-Opener-Policy", "same-origin");
          headers.set("Cross-Origin-Embedder-Policy", "require-corp");

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

    // Detect iOS/iPadOS (all browsers use WebKit on iOS and need the SW)
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(navigator.userAgent));

    // Detect desktop Safari (macOS)
    const isDesktopSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    const needsSW = isIOS || isDesktopSafari;

    if (!needsSW) {
      // Clean up the service worker if it was registered on non-WebKit desktop/Android browsers (Chrome, Firefox, etc.)
      // since they natively support COEP: credentialless from next.config.ts and don't need the SW.
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      } catch (e) {}
      return;
    }

    // On iOS/Safari, if already isolated, skip registration
    if (window.crossOriginIsolated) return;
    if (!window.isSecureContext) return;

    try {
      const scriptSrc = document.currentScript ? document.currentScript.src : "/coi-serviceworker.js";
      const reg = await navigator.serviceWorker.register(
        scriptSrc,
        { scope: "/" }
      );

      // Helper: reload once when the SW becomes active for the first time.
      // We only reload once (tracked via sessionStorage) to prevent reload loops.
      const reloadOnce = () => {
        if (sessionStorage.getItem("coi-reloaded")) return;
        sessionStorage.setItem("coi-reloaded", "1");
        window.location.reload();
      };

      if (!navigator.serviceWorker.controller) {
        // No controller yet — the SW is either installing or already active but
        // not yet controlling this page (first visit). Watch for activation.
        const pending = reg.installing || reg.waiting || reg.active;
        if (pending && pending.state !== "activated") {
          pending.addEventListener("statechange", function () {
            if (this.state === "activated") reloadOnce();
          });
        } else {
          // Already active but not controlling — reload so it takes control.
          reloadOnce();
        }
      }
    } catch (err) {
      console.warn("[coi-sw] registration failed:", err);
    }
  })();
}