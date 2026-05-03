// Service worker for TCG Scanner PWA.
// Provides offline shell caching, offline fallback page, and install capability.

const CACHE_NAME = "tcg-scanner-v4";

// Pre-cached at install time — must include the offline fallback page.
const SHELL_URLS = [
  "/",
  "/offline",
  "/dashboard",
  "/collection",
  "/scan",
  "/manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests (API calls, form submissions, eBay OAuth, etc.)
  if (request.method !== "GET") return;

  // Skip API routes entirely — never cache, never offline-fallback for data requests.
  if (request.url.includes("/api/")) return;

  // Navigation requests (page loads): network-first, fall back to /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/offline").then((r) => r || caches.match("/"))
      )
    );
    return;
  }

  // Next.js build assets (/_next/static/…): network-first with cache fallback.
  // These change every build, so we prefer fresh but serve stale if offline.
  if (request.url.includes("/_next/")) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Static assets (images, fonts, icons): cache-first, populate on miss.
  // Only cache same-origin assets — external CDN images (Scryfall, Pokemon TCG, etc.)
  // are cross-origin opaque responses that cannot be reliably cached.
  const isSameOrigin = request.url.startsWith(self.location.origin);
  if (isSameOrigin && /\.(png|jpg|jpeg|svg|webp|woff2?)(\?.*)?$/.test(request.url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            return response;
          })
      )
    );
    return;
  }
});
