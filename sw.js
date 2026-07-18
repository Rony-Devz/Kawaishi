/* Kawaishi Ju-Jitsu — service worker.
 * Versioned caches. Relative URLs only, so it works under any scope
 * (localhost:8123 and any Netlify subpath alike).
 *
 * Strategy:
 *   - Navigations / HTML  -> network-first (cache fallback offline).
 *   - data.js             -> network-first (updates land immediately; cache fallback).
 *   - images + static     -> cache-first with runtime caching.
 */

const VERSION = "v38";
const PRECACHE = "kawaishi-precache-" + VERSION;
const RUNTIME = "kawaishi-runtime-" + VERSION;

// App shell — relative to the SW's own location (the scope root).
const PRECACHE_URLS = [
  "./",
  "./index.html",
  "./data.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon-180.png",
  "./icons/favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) =>
      // Cache entries individually so one missing file can't abort the install.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch((err) => {
            console.warn("[sw] precache skipped:", url, err);
          })
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== PRECACHE && k !== RUNTIME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

function isImageRequest(request, url) {
  if (request.destination === "image") return true;
  return /\.(png|jpe?g|gif|webp|svg|avif|ico)$/i.test(url.pathname);
}

// Network-first: fresh when online, cached copy when offline.
async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(PRECACHE);
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fb = await cache.match(fallbackUrl);
      if (fb) return fb;
    }
    throw err;
  }
}

// Cache-first: serve from cache, fetch+store on miss.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const cache = await caches.open(RUNTIME);
  const fresh = await fetch(request);
  if (fresh && fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only handle same-origin requests; let cross-origin (e.g. YouTube) pass through.
  if (url.origin !== self.location.origin) return;

  // Navigations / HTML -> network-first, fall back to the cached shell.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  // data.js -> network-first so curriculum updates appear immediately.
  if (url.pathname.endsWith("/data.js") || url.pathname.endsWith("data.js")) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Images (incl. img/illus/*.png) -> cache-first with runtime caching.
  if (isImageRequest(request, url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Everything else static (manifest, icons, etc.) -> cache-first.
  event.respondWith(cacheFirst(request));
});
