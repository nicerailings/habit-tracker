const CACHE = "habits-v1";
const APP_SHELL = [
  "./",
  "./manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(request).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE).then((c) => c.put(request, resClone));
        return res;
      }).catch(() => caches.match(request))
    );
  } else {
    e.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => {
        const resClone = res.clone();
        caches.open(CACHE).then((c) => c.put(request, resClone));
        return res;
      }))
    );
  }
});
