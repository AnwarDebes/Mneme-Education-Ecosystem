// mneme service worker - offline shell + recently-viewed deck cache.
// Activates only after the page registers it explicitly.

const SHELL_CACHE = "mneme-shell-v2";
const DATA_CACHE = "mneme-data-v2";
const DECK_CACHE = "mneme-decks-v2";

const SHELL_ASSETS = [
  "/",
  "/library",
  "/today",
  "/insights",
  "/learn",
  "/help",
  "/cards",
  "/showcase",
  "/manifest.json",
  "/icon.svg",
];

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (event.data?.type === "PREFETCH_DECKS" && Array.isArray(event.data.deckIds)) {
    event.waitUntil(
      caches.open(DECK_CACHE).then(async (cache) => {
        for (const id of event.data.deckIds) {
          try {
            const resp = await fetch(`/api/jobs/${id}`);
            if (resp.ok) await cache.put(`/api/jobs/${id}`, resp);
          } catch {
            /* ignore */
          }
        }
      }),
    );
  }
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => null)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // API: stale-while-revalidate for read-only endpoints.
  if (url.pathname.startsWith("/api/")) {
    if (req.method !== "GET") return;
    if (url.pathname.includes("/events")) return; // SSE: skip
    if (url.pathname.includes("/chat")) return;
    if (url.pathname.includes("/explain")) return;
    if (url.pathname.includes("/summarize")) return;
    if (url.pathname.includes("/improve")) return;
    if (url.pathname.includes("/suggest")) return;
    if (url.pathname.includes("/from-text")) return;
    if (url.pathname.includes("/import")) return;
    if (url.pathname.includes("/grade")) return;
    event.respondWith(
      caches.open(DATA_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((resp) => {
            if (resp.ok) cache.put(req, resp.clone());
            return resp;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Static / page: cache-first, fall back to network.
  if (req.mode === "navigate" || url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((resp) => {
            if (resp.ok && url.origin === self.location.origin) {
              caches.open(SHELL_CACHE).then((c) => c.put(req, resp.clone()));
            }
            return resp;
          })
          .catch(() => caches.match("/library"));
      }),
    );
  }
});
