/* ─── RoamCircle sw.js — Mountain Offline Service Worker ─────────────
 * Offline caching for remote overland zones (Leh/Spiti/Western Ghats).
 ───────────────────────────────────────────────────────────────── */

const CACHE_NAME = "roamcircle-v1-static";
const OFFLINE_URL = "/dashboard.html";

const CORE_ASSETS = [
  "/",
  "/dashboard.html",
  "/index.html",
  "/login.html",
  "/signup.html",
  "/profile.html",
  "/manifest.json",
  "/styles.css",
  "/dashboard.css",
  "/theme.js",
  "/theme-light.css",
  "/map.js",
  "/expenses.js",
  "/safety.js",
  "/media.js",
  "/pwa.js",
  "/realtime.js",
  "/ratings.js",
  "/script.js",
  "/trip-covers.js",
  "/animate.js",
  "/chat.js?v=2",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
  "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
];

// ── Install: Pre-cache static shell ──────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log("[sw] Pre-caching core application shell...");
      for (const url of CORE_ASSETS) {
        try {
          await cache.add(url);
        } catch (e) {
          console.warn("[sw] Pre-cache skipped for optional asset:", url, e.message);
        }
      }
    })
  );
  self.skipWaiting();
});

// ── Activate: Clean old caches ───────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
  console.log("[sw] Mountain Offline Service Worker active & claiming clients");
});

// ── Fetch: Stale-While-Revalidate & Network-First for API ─────────
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Non-GET requests (e.g. POST /api) bypass Service Worker cache
  if (req.method !== "GET") return;

  // WebSocket connections or chrome extensions bypass
  if (url.protocol === "ws:" || url.protocol === "wss:" || !url.protocol.startsWith("http")) return;

  // 1. API Requests — Network First, Fallback to Cache
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ offline: true, error: "Network unavailable in mountain zone." }), {
            status: 503,
            headers: { "Content-Type": "application/json" }
          });
        })
    );
    return;
  }

  // 2. Navigation / Page Requests — Cache First with Network Fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // 3. Static Assets (CSS, JS, Fonts, Images) — Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => null);

      return cached || fetchPromise;
    })
  );
});
