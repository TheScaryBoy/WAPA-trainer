// WAPA Trainer offline cache. Everything the app needs (all six modules) is
// already embedded inside index.html itself, so caching just the shell files
// plus whatever external assets (fonts) get fetched is enough for the whole
// app to work with zero signal, e.g. on a flight.
const CACHE_NAME = "wapa-trainer-v1";
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

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          // Opportunistically cache same-origin files and font assets so a
          // later offline load (e.g. mid-flight) can still find them.
          const url = new URL(event.request.url);
          const isFont = url.hostname.includes("fonts.g");
          if (response.ok && (url.origin === self.location.origin || isFont)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          // Offline and not cached: for a page navigation, fall back to the
          // cached app shell rather than showing a browser error page.
          if (event.request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    })
  );
});
