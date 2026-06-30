/*! coi-serviceworker - custom build for NuvioWeb
 *  Purpose: Inject COOP/COEP headers ONLY on same-origin requests so that
 *  SharedArrayBuffer is available in the player on Safari/iOS.
 *  Cross-origin requests (e.g. TMDB images) are passed through completely
 *  untouched to avoid breaking thumbnails.
 */

if (typeof window === "undefined") {
  // ── SERVICE WORKER CONTEXT ─────────────────────────────────────────────────

  self.addEventListener("install", () => self.skipWaiting());
  self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener("fetch", (e) => {
    const req = e.request;
    const url = new URL(req.url);

    // Only intercept same-origin requests. Let all cross-origin requests
    // (TMDB images, external APIs, etc.) pass through without any modification.
    if (url.origin !== self.location.origin) {
      return; // do NOT call e.respondWith — browser handles it natively
    }

    // For same-origin requests, fetch normally and inject the required headers.
    e.respondWith(
      fetch(req).then((res) => {
        // Don't modify opaque or error responses
        if (res.status === 0 || res.type === "opaque") return res;

        const headers = new Headers(res.headers);
        headers.set("Cross-Origin-Opener-Policy", "same-origin");
        headers.set("Cross-Origin-Embedder-Policy", "credentialless");

        return new Response(res.body, {
          status: res.status,
          statusText: res.statusText,
          headers,
        });
      }).catch(() => fetch(req)) // fallback: just do a plain fetch on error
    );
  });

} else {
  // ── PAGE CONTEXT ────────────────────────────────────────────────────────────
  // Register the service worker if the page is not yet cross-origin isolated.
  // This is needed on Safari (iOS/iPadOS) which doesn't support the HTTP headers
  // approach on certain deployments.

  (async () => {
    if (!navigator.serviceWorker) return;

    // If already isolated (e.g. via Next.js headers on desktop Chrome), skip.
    if (window.crossOriginIsolated) {
      console.log("[coi-sw] already cross-origin isolated, skipping SW registration");
      return;
    }

    if (!window.isSecureContext) {
      console.log("[coi-sw] not a secure context, cannot register SW");
      return;
    }

    try {
      const reg = await navigator.serviceWorker.register(
        document.currentScript.src,
        { scope: "/" } // global scope so it covers /player navigation
      );
      console.log("[coi-sw] registered, scope:", reg.scope);

      // If the SW just became active for the first time, reload to get headers.
      if (reg.active && !navigator.serviceWorker.controller) {
        console.log("[coi-sw] reloading to activate SW headers");
        window.location.reload();
      }

      reg.addEventListener("updatefound", () => {
        console.log("[coi-sw] update found, reloading");
        window.location.reload();
      });
    } catch (err) {
      console.warn("[coi-sw] registration failed:", err);
    }
  })();
}