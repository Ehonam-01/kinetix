// Kinetix Africa service worker — deliberately minimal.
//
// It never caches pages, API responses or anything behind a login: member
// data, balances and payments must always come fresh from the server. Its
// only job is to show /offline.html (instead of the browser's own error
// page) when a page can't be reached because the phone has no connection.
// Bump CACHE when offline.html or the icons change.
const CACHE = "kinetix-offline-v1";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

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
