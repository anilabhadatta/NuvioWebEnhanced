/*! coi-serviceworker - custom build for NuvioWeb
 *
 *  Injects COOP/COEP headers on same-origin requests only, so that
 *  SharedArrayBuffer is available for the video player on Safari/iOS.
 *
 *  Cross-origin requests (TMDB images, external APIs) are intentionally
 *  skipped — the browser handles them natively with no interference.
 *
 *  Reload loop prevention: we only ever do ONE reload using a sessionStorage
 *  flag, so the activation handshake cannot loop.
 */

if (typeof window === "undefined") {
  // ── SERVICE WORKER CONTEXT ─────────────────────────────────────────────────

  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener("fetch", (e) => {
    const req = e.request;
    const url = new URL(req.url);

    // ✅ Only intercept same-origin requests.
    // Cross-origin requests (image.tmdb.org, etc.) are completely ignored —
    // returning without calling e.respondWith() hands them back to the browser.
    if (url.origin !== self.location.origin) {
      return;
    }

    // For same-origin requests, fetch and inject the required isolation headers.
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.status === 0 || res.type === "opaque") return res;

          const headers = new Headers(res.headers);
          headers.set("Cross-Origin-Opener-Policy", "same-origin");
          headers.set("Cross-Origin-Embedder-Policy", "credentialless");

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

    // If already cross-origin isolated (e.g. desktop Chrome via Next.js headers),
    // we don't need the service worker at all — skip registration entirely.
    if (window.crossOriginIsolated) return;

    if (!window.isSecureContext) return;

    // Only register on Safari/WebKit. Chrome and Firefox receive the isolation
    // headers directly from Next.js (next.config.ts) and don't need the SW.
    const isSafari =
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ||
      /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (!isSafari) return;

    try {
      const reg = await navigator.serviceWorker.register(
        document.currentScript.src,
        { scope: "/" }
      );

      // ✅ Reload-once guard: only reload if we haven't already done so.
      // This prevents the infinite reload loop caused by repeated activations.
      const reloadKey = "coi_sw_reloaded";
      if (reg.active && !navigator.serviceWorker.controller) {
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, "1");
          window.location.reload();
        }
      } else {
        // SW is in control — clear the flag so future hard refreshes work.
        sessionStorage.removeItem(reloadKey);
      }

    } catch (err) {
      console.warn("[coi-sw] registration failed:", err);
    }
  })();
}