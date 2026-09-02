/* ─── RoamCircle realtime.js — Step 4 (all bugs fixed) ───────
 *
 * Fix #1  const in switch case → wrapped in block {}
 * Fix #2  reconnect loop when no token → guard added
 * Fix #4  page refresh loses token → GET /api/auth/token endpoint
 * Fix #5  sender gets their own new_message push → skip if sender === owner
 * Fix #7  stale relTime → re-render on dropdown open
 * Fix #9  RC_connect removed (unused)
 * Fix #10 chat.js functions called via event queue to ensure init order
 */

(function () {
  "use strict";

  // ── State ─────────────────────────────────────────────────
  let ws            = null;
  let wsToken       = null;
  let reconnectMs   = 1000;
  let pingTimer     = null;
  let reconnTimer   = null;
  let isConnected   = false;
  let isConnecting  = false;   // Fix #2 — prevent overlapping connect attempts
  const MAX_RECONNECT_MS = 30_000;

  const notifications = [];
  let unreadCount = 0;

  // ── Token management ──────────────────────────────────────
  // Fix #4 — fetch a fresh WS token from the server on page load
  // Server exposes GET /api/auth/token which returns { token } from the cookie
  async function fetchFreshToken() {
    try {
      const res  = await fetch("/api/auth/token");
      const data = await res.json().catch(() => ({}));
      return data.token || null;
    } catch { return null; }
  }

  // Called by dashboard inline script after reading sessionStorage
  window.RC_setWsToken = function(token) {
    wsToken = token;
    if (!isConnected && !isConnecting) connect();
  };

  // ── Connect ───────────────────────────────────────────────
  async function connect() {
    if (isConnected || isConnecting) return;
    if (ws && ws.readyState === WebSocket.OPEN) return;

    // Fix #4 — if no token in memory, try fetching from server
    if (!wsToken) {
      wsToken = await fetchFreshToken();
      if (!wsToken) return; // not logged in — stop, don't reconnect
    }

    isConnecting = true;
    const proto  = location.protocol === "https:" ? "wss:" : "ws:";
    const url    = `${proto}//${location.host}/ws?token=${encodeURIComponent(wsToken)}`;

    try { ws = new WebSocket(url); }
    catch(e) {
      console.error("[ws] connect failed:", e.message);
      isConnecting = false;
      scheduleReconnect();
      return;
    }

    ws.addEventListener("open", () => {
      isConnecting = false;
      isConnected  = true;
      reconnectMs  = 1000;
      startPing();
      updateBellStatus(true);
      console.log("[ws] connected");
    });

    ws.addEventListener("message", e => {
      try { handleEvent(JSON.parse(e.data)); }
      catch { /* ignore malformed */ }
    });

    ws.addEventListener("close", () => {
      isConnecting = false;
      isConnected  = false;
      stopPing();
      updateBellStatus(false);
      console.log("[ws] disconnected");
      // Fix #2 — only reconnect if we still have a token
      if (wsToken) scheduleReconnect();
    });

    ws.addEventListener("error", () => {
      // error always followed by close — handled there
    });
  }

  function scheduleReconnect() {
    // Fix #2 — guard: never schedule if no token
    if (!wsToken) return;
    clearTimeout(reconnTimer);
    reconnTimer = setTimeout(() => {
      if (!isConnected && !isConnecting) connect();
    }, reconnectMs);
    reconnectMs = Math.min(reconnectMs * 2, MAX_RECONNECT_MS);
  }

  // ── Heartbeat ─────────────────────────────────────────────
  function startPing() {
    stopPing();
    pingTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 25_000);
  }

  function stopPing() { clearInterval(pingTimer); }

  // ── Public API ────────────────────────────────────────────
  window.RC_WS = {
    send(event) {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    },
    isConnected() { return isConnected; }
  };

  // ── Event handler ─────────────────────────────────────────
  // Fix #10 — dispatch via custom DOM events so chat.js handlers
  // are guaranteed to be registered before we call them
  function dispatchRC(name, detail) {
    document.dispatchEvent(new CustomEvent(`rc:${name}`, { detail }));
  }

  function handleEvent(event) {

    switch (event.type) {

      case "pong":
        break;

      case "connected":
        console.log("[ws] session confirmed:", event.name);
        break;

      case "match_request": {
        addNotification({
          icon:   "🤝",
          title:  "New match request",
          body:   `${event.fromName} wants to ride with you!`,
          ts:     Date.now(),
          action: () => {
            document.getElementById("requests-section")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
        // Fix #10 — use custom event so chat.js can handle it safely
        dispatchRC("match_request", event);
        break;
      }
      case "trip_published": {
      addNotification({
        icon:  "🧭",
        title: "New rider on your route",
        body:  `${event.fromName} published a trip to ${event.to}.`,
        ts:    Date.now(),
        action: () => document.getElementById("requests-section")
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      });
      dispatchRC("trip_published", event);
      break;
      }
      case "match_cancelled": {
        addNotification({
          icon:  "🚪",
          title: "Rider left the crew",
          body:  `${event.fromName} cancelled the match.`,
          ts:    Date.now(),
          action: () => dispatchRC("match_cancelled", event)
        });
        dispatchRC("match_cancelled", event);
        break;
      }
      case "match_accepted": {
        addNotification({
          icon:   "🎉",
          title:  "Mutual match!",
          body:   `You and ${event.fromName} both accepted — you can now chat!`,
          ts:     Date.now(),
          action: () => dispatchRC("open_chat", { requesterId: event.requesterId })
        });
        dispatchRC("match_accepted", event);
        break;
      }

      // Fix #1 — wrap case block in {} to allow const declarations
      case "new_message": {
        const panelEl       = document.getElementById("chat-panel");
        const panelOpen     = panelEl?.classList.contains("open") ?? false;
        const isActiveThread = panelOpen && window._rcActiveThread === event.threadId;

        if (!isActiveThread) {
          const preview = event.text
            ? `${event.fromName}: ${event.text.slice(0, 60)}${event.text.length > 60 ? "…" : ""}`
            : `${event.fromName} shared a route`;

          addNotification({
            icon:   "💬",
            title:  "New message",
            body:   preview,
            ts:     Date.now(),
            action: () => {
              // Extract requesterId from event.from (the sender)
              const requesterId = event.from;
              dispatchRC("open_chat", { requesterId });
            }
          });

          // Mark the tab unread if panel is open on a different thread
          if (panelOpen) {
            const requesterId = event.from;
            document.querySelector(`.chat-tab[data-thread="${requesterId}"]`)
              ?.classList.add("has-unread");
          }
        }

        // Always dispatch so chat.js can refresh the open thread
        dispatchRC("new_message", event);
        break;
      }
    }
  }

  // ── Notification system ───────────────────────────────────
  function addNotification(n) {
    notifications.unshift(n);
    if (notifications.length > 20) notifications.pop();
    unreadCount++;
    renderBell();
    // Only re-render dropdown if it's open
    if (document.getElementById("notif-dropdown")?.classList.contains("open")) {
      renderDropdown();
    }
    // Browser notification
    if (Notification.permission === "granted") {
      try {
        new Notification(`RoamCircle — ${n.title}`, { body: n.body });
      } catch { /* some browsers block it */ }
    }
  }

  function dismissNotification(reqId) {
    if (!reqId) return;
    const idx = notifications.findIndex(n => n.reqId === reqId);
    if (idx !== -1) {
      notifications.splice(idx, 1);
      if (unreadCount > 0) unreadCount--;
      renderBell();
      if (dropdownOpen) renderDropdown();
    }
  }

  function initPendingNotifications() {
    const cards = document.querySelectorAll("[data-request-card]:not(.is-accepted):not(.is-rejected)");
    if (!cards.length) return;
    let added = 0;
    cards.forEach(card => {
      const id = card.dataset.requestCard;
      if (!id) return;
      if (notifications.some(n => n.reqId === id)) return;
      const name = card.querySelector(".req-name")?.childNodes[0]?.textContent?.trim() || "A rider";
      const score = card.querySelector(".match-score")?.textContent?.trim() || "";
      const routeFrom = card.querySelector(".from-pill")?.textContent?.trim() || "";
      const routeTo = card.querySelector(".to-pill")?.textContent?.trim() || "";
      const routeStr = (routeFrom && routeTo) ? ` (${routeFrom} → ${routeTo})` : "";

      notifications.push({
        icon: "🤝",
        title: "New match request",
        body: `${name}${score ? ` [${score}]` : ""} wants to ride with you${routeStr}!`,
        ts: Date.now() - 30000,
        reqId: id,
        action: () => {
          const target = document.querySelector(`[data-request-card="${id}"]`);
          if (target) {
            target.scrollIntoView({ behavior: "smooth", block: "center" });
            target.style.outline = "2px solid var(--green)";
            target.style.outlineOffset = "4px";
            setTimeout(() => { target.style.outline = ""; target.style.outlineOffset = ""; }, 2000);
          } else {
            document.getElementById("requests-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }
      });
      added++;
    });
    if (added > 0) {
      unreadCount += added;
      renderBell();
      if (dropdownOpen) renderDropdown();
    }
  }

  window.RC_addNotification = addNotification;
  window.RC_notify          = addNotification;
  window.RC_dismissNotification = dismissNotification;
  window.RC_initPendingNotifications = initPendingNotifications;

  function renderBell() {
    const badge = document.getElementById("notif-badge");
    if (!badge) return;
    badge.textContent = unreadCount > 9 ? "9+" : String(unreadCount);
    badge.hidden = unreadCount === 0;
    const base = document.title.replace(/^\(\d+\+?\)\s*/, "");
    document.title = unreadCount > 0 ? `(${unreadCount > 9 ? "9+" : unreadCount}) ${base}` : base;
  }

  // Fix #7 — re-render relative times on every dropdown open
  function renderDropdown() {
    const list = document.getElementById("notif-list");
    if (!list) return;

    if (!notifications.length) {
      list.innerHTML = `<div class="notif-empty">No notifications yet</div>`;
      return;
    }

    list.innerHTML = notifications.map((n, i) => `
      <div class="notif-item" data-notif-index="${i}">
        <span class="notif-icon">${n.icon}</span>
        <div class="notif-body">
          <div class="notif-title">${escHtml(n.title)}</div>
          <div class="notif-text">${escHtml(n.body)}</div>
          <div class="notif-time">${relTime(n.ts)}</div>
        </div>
      </div>`).join("");

    list.querySelectorAll(".notif-item").forEach(el => {
      el.addEventListener("click", () => {
        const idx = Number(el.dataset.notifIndex);
        notifications[idx]?.action?.();
        closeDropdown();
        unreadCount = 0;
        renderBell();
      });
    });
  }

  // Fix #7 — relTime called fresh on every render, not cached
  function relTime(ts) {
    const diff = Date.now() - ts;
    if (diff < 60_000)    return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    return `${Math.floor(diff / 86_400_000)}d ago`;
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── Bell dropdown ─────────────────────────────────────────
  let dropdownOpen = false;

  function openDropdown() {
    const dd = document.getElementById("notif-dropdown");
    if (!dd) return;
    renderDropdown(); // Fix #7 — always re-render to refresh relTime
    dd.classList.add("open");
    dropdownOpen = true;
    unreadCount  = 0;
    renderBell();
  }

  function closeDropdown() {
    document.getElementById("notif-dropdown")?.classList.remove("open");
    dropdownOpen = false;
  }

  function updateBellStatus(online) {
    const dot = document.getElementById("ws-status-dot");
    if (!dot) return;
    dot.style.background = online ? "#1DB954" : "#727272";
    dot.title = online ? "Live — real-time on" : "Offline — reconnecting…";
  }

  // ── DOM ready ─────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async () => {
    document.getElementById("notif-bell")?.addEventListener("click", e => {
      e.stopPropagation();
      dropdownOpen ? closeDropdown() : openDropdown();
    });

    document.addEventListener("click", e => {
      if (dropdownOpen && !e.target.closest("#notif-wrap")) closeDropdown();
    });

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    renderBell();
    setTimeout(initPendingNotifications, 400);

    // Fix #4 — try to connect on page load even without sessionStorage token
    // (covers page refresh case)
    if (!wsToken) {
      wsToken = await fetchFreshToken();
      if (wsToken) connect();
    }
  });

})();
