// Kinetix Africa service worker — deliberately minimal.
//
// It never caches pages, API responses or anything behind a login: member
// data, balances and payments must always come fresh from the server. It
// shows /offline.html (instead of the browser's own error page) when a page
// can't be reached because the phone has no connection, and serves the few
// static images listed in PRECACHE from its cache.
// Bump CACHE when any PRECACHE file changes.
const CACHE = "kinetix-offline-v2";
const OFFLINE_URL = "/offline.html";
// The offline page and its icon, plus the launch screen's images so every
// launch after the first shows them instantly
// (components/pwa/launch-screen.tsx).
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/launch/mark.png",
  "/launch/photo-1.jpg",
  "/launch/photo-2.jpg",
  "/launch/photo-3.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // The offline page's own icon: without this it would go to the (absent)
  // network and show as broken. Only the precached files, nothing else.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && PRECACHE.includes(url.pathname)) {
    event.respondWith(
      caches
        .match(request, { ignoreSearch: true })
        .then((cached) => cached ?? fetch(request)),
    );
    return;
  }

  // Page loads only; every other request (scripts, data, Server Actions,
  // payments) goes to the network untouched, exactly as without this file.
  if (request.mode !== "navigate") return;

  event.respondWith(
    fetch(request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (await cache.match(OFFLINE_URL)) ?? Response.error();
    }),
  );
});
