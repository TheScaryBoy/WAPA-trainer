// WAPA Trainer offline cache. Everything the app needs (all seven modules) is
// already embedded inside index.html itself, so caching just the shell files
// plus whatever external assets (fonts) get fetched is enough for the whole
// app to work with zero signal, e.g. on a flight.
//
// IMPORTANT: bump CACHE_NAME any time index.html (or any core asset) changes.
// The browser only re-installs this service worker when sw.js itself changes
// byte-for-byte, so a cache name bump is what forces it to notice there's a
// new version to fetch instead of silently serving the old cached page
// forever.
const CACHE_NAME = "wapa-trainer-v2";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./apple-touch-icon.png",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const isNavigation = event.request.mode === "navigate";
  const url = new URL(event.request.url);
  const isCoreShellFile =
    url.origin === self.location.origin &&
    (isNavigation || url.pathname.endsWith("/index.html"));

  if (isCoreShellFile) {
    // Network-first for the app shell itself: always try to fetch the latest
    // index.html when online (so an update you upload shows up right away),
    // and only fall back to the cached copy when there's no signal.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }

  // Everything else (manifest, icons, fonts): cache-first, since these
  // rarely change and this keeps the app instant and fully usable offline.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          const isFont = url.hostname.includes("fonts.g");
          if (response.ok && (url.origin === self.location.origin || isFont)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => undefined);
    })
  );
});
