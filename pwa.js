/* ─── RoamCircle pwa.js — PWA & Mountain Offline Controller ─────────
 * Manages Service Worker lifecycle, offline mountain zone detection,
 * local trip itinerary caching, and 1-tap app installation.
 ───────────────────────────────────────────────────────────────── */

(function () {
  "use strict";

  const STORAGE_OFFLINE_TRIP = "rc_offline_trip";
  const STORAGE_OFFLINE_ITINERARY = "rc_offline_itinerary";

  let deferredInstallPrompt = null;

  // ── Service Worker Registration ───────────────────────────────
  async function registerServiceWorker() {
    if ("serviceWorker" in navigator && (window.location.protocol === "https:" || window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        console.log("[pwa] Service Worker registered with scope:", registration.scope);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[pwa] New version ready. Will update on next launch.");
              }
            });
          }
        });
      } catch (err) {
        console.warn("[pwa] Service Worker registration failed:", err.message);
      }
    }
  }

  // ── Offline Mountain Mode Detector ────────────────────────────
  function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    const banner = document.getElementById("mountain-offline-banner");
    const bannerText = document.getElementById("mountain-offline-text");

    if (!banner) return;

    if (!isOnline) {
      banner.classList.add("visible");
      if (bannerText) {
        bannerText.innerHTML = "<strong>🏔️ Mountain Offline Mode Active</strong> — Saved route itinerary, meetpoints, and Emergency Safety Hub are available offline.";
      }
    } else {
      if (banner.classList.contains("visible")) {
        if (bannerText) {
          bannerText.innerHTML = "<strong>✓ Connection Restored</strong> — Synchronizing live chats and convoy requests...";
        }
        setTimeout(() => {
          banner.classList.remove("visible");
        }, 3200);
      }
    }
  }

  // ── Offline Trip & Itinerary Caching ──────────────────────────
  function cacheActiveTrip(trip) {
    if (!trip) return;
    try {
      localStorage.setItem(STORAGE_OFFLINE_TRIP, JSON.stringify({
        ...trip,
        cachedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.warn("[pwa] Could not cache trip offline:", e);
    }
  }

  function getCachedTrip() {
    try {
      const saved = localStorage.getItem(STORAGE_OFFLINE_TRIP);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  function cacheItinerary(itinerary) {
    if (!itinerary) return;
    try {
      localStorage.setItem(STORAGE_OFFLINE_ITINERARY, JSON.stringify({
        ...itinerary,
        cachedAt: new Date().toISOString()
      }));
    } catch (e) {
      console.warn("[pwa] Could not cache itinerary offline:", e);
    }
  }

  function getCachedItinerary() {
    try {
      const saved = localStorage.getItem(STORAGE_OFFLINE_ITINERARY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  // ── PWA Installation Prompt ───────────────────────────────────
  function setupInstallPrompt() {
    const installBtn = document.getElementById("nav-install-btn");

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (installBtn) {
        installBtn.style.display = "inline-flex";
      }
    });

    installBtn?.addEventListener("click", async () => {
      if (!deferredInstallPrompt) {
        alert("To install RoamCircle:\n• Chrome/Android: Tap menu (⋮) → 'Install app'\n• Safari/iOS: Tap Share (⎋) → 'Add to Home Screen'");
        return;
      }

      deferredInstallPrompt.prompt();
      const choiceResult = await deferredInstallPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        console.log("[pwa] User accepted the install prompt");
        if (installBtn) installBtn.style.display = "none";
      }
      deferredInstallPrompt = null;
    });

    window.addEventListener("appinstalled", () => {
      console.log("[pwa] RoamCircle PWA installed successfully");
      if (installBtn) installBtn.style.display = "none";
      deferredInstallPrompt = null;
    });
  }

  // ── Initialization ─────────────────────────────────────────────
  function init() {
    registerServiceWorker();
    setupInstallPrompt();

    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus();

    // Auto-cache current trip from DOM if available
    const myTripCard = document.getElementById("my-trip-card");
    if (myTripCard) {
      const from = myTripCard.querySelector(".route-pill.from")?.textContent?.trim();
      const to = myTripCard.querySelector(".route-pill.to")?.textContent?.trim();
      const meet = myTripCard.querySelector(".trip-card-meetpoints")?.textContent?.trim();
      if (from && to) {
        cacheActiveTrip({ from, to, meetpoints: meet });
      }
    }
  }

  // Export to global scope
  window.RC_pwa = {
    cacheActiveTrip,
    getCachedTrip,
    cacheItinerary,
    getCachedItinerary,
    init
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
