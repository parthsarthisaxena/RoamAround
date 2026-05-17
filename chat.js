/* ─── RoamCircle Chat System ──────────────────────────────
   Features:
   - Slide-in panel, per-traveler threads
   - localStorage persistence
   - Typing indicator with realistic delay
   - Itinerary snippet strip
   - Itinerary share as a special bubble
   - Timestamps on every message
──────────────────────────────────────────────────────────── */

const CHAT_STORAGE_KEY = "roamcircle_chat_v1";
const REQUEST_STORAGE_KEY = "roamcircle_requests";

// ── Traveler metadata ───────────────────────────────────────
const TRAVELERS = {
  "lea-bali": {
    name: "Lea Martin",
    initial: "L",
    trip: "Bali · Apr 12–19",
    welcomeMsg: "Hey! So excited we matched 🌴 Have you started looking at where to stay in Canggu?",
    replies: [
      "That sounds perfect honestly!",
      "I was thinking we do the Campuhan Ridge walk on Day 2 — early morning before it gets hot 🌅",
      "Yes to beach club!! I heard Finns is amazing",
      "Should we split a scooter or just use Grab? I'm fine either way",
      "Omg I found this cafe called Zibiru that looks incredible for brunch",
      "Are you cool with a 6am sunrise hike? I know it's early lol",
      "Just sent you the villa shortlist I made! Let me know what you think",
      "Can we add a cooking class to the itinerary? There's one in Ubud that looks amazing 🍜",
    ]
  },
  "maya-bali": {
    name: "Maya Shah",
    initial: "M",
    trip: "Bali · Apr 13–18",
    welcomeMsg: "Hi! Really glad we connected. I've been scouting some amazing photo spots in Ubud 📸",
    replies: [
      "The rice terraces at Tegalalang are a must for golden hour shots",
      "I have a whole list of instagrammable cafes if you want it haha",
      "Do you have a good camera or are you going phone only?",
      "Markets are my fave — Seminyak market has the best vintage finds",
      "Let's do a photo walk on Day 1 while we're still fresh!",
      "I found a rooftop bar that has insane sunset views 🌇",
      "Totally fine with a relaxed pace — I like having downtime too",
      "Should we plan a Nusa Penida day trip? The views are unreal",
    ]
  },
  "jun-bali": {
    name: "Jun Park",
    initial: "J",
    trip: "Bali · Apr 14–17",
    welcomeMsg: "Hey! Looking forward to the Bali coworking setup. Do you have a good spot picked out yet?",
    replies: [
      "Dojo coworking in Canggu is supposed to be really good — fast wifi",
      "I usually work 9–1 then I'm free the rest of the day",
      "The food market near Seminyak opens at 4pm — perfect for after work",
      "Are you cool with splitting food costs evenly or keeping it separate?",
      "I know a great spot for group dinner on Friday night 🍽️",
      "Remote work life in Bali is the dream honestly",
      "What time do you usually call it quits for the day?",
      "Let's grab coffee at a coworking cafe and plan the week",
    ]
  }
};

// ── State ───────────────────────────────────────────────────
let activeThread = null; // current open traveler id
let replyTimers = {};    // pending reply timeouts
let currentItinerary = null; // latest generated itinerary from planner

// ── Storage helpers ─────────────────────────────────────────
function loadAllChats() {
  try { return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

function saveAllChats(data) {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(data));
}

function getThread(id) {
  const all = loadAllChats();
  return all[id] || { messages: [], replyIndex: 0 };
}

function saveThread(id, thread) {
  const all = loadAllChats();
  all[id] = thread;
  saveAllChats(all);
}

function loadRequestStates() {
  try { return JSON.parse(localStorage.getItem(REQUEST_STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

// ── Utilities ───────────────────────────────────────────────
function formatTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDateLabel(isoString) {
  const d = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function scrollToBottom(smooth = true) {
  const msgs = document.getElementById("chat-messages");
  if (!msgs) return;
  msgs.scrollTo({ top: msgs.scrollHeight, behavior: smooth ? "smooth" : "instant" });
}

function getAcceptedIds() {
  const states = loadRequestStates();
  return Object.entries(states)
    .filter(([, v]) => v === "accept")
    .map(([k]) => k);
}

// ── Itinerary snippet ───────────────────────────────────────
function updateSnippet() {
  const snippetEl = document.getElementById("snippet-days");
  if (!snippetEl) return;

  // Try to read the live itinerary from the planner DOM
  const dayCards = document.querySelectorAll("#planner-days .day-card");
  const days = [];
  dayCards.forEach((card, i) => {
    const title = card.querySelector("strong")?.textContent || `Day ${i + 1}`;
    days.push({ day: i + 1, title });
  });

  if (days.length === 0) {
    snippetEl.innerHTML = `<div class="snippet-day"><strong>Day 1</strong>Arrive & explore</div>
      <div class="snippet-day"><strong>Day 2</strong>Beach club day</div>
      <div class="snippet-day"><strong>Day 3</strong>Ubud & cafes</div>
      <div class="snippet-day"><strong>Day 4</strong>Sunrise hike</div>
      <div class="snippet-day"><strong>Day 5</strong>Calm final day</div>`;
    return;
  }

  snippetEl.innerHTML = days.map(d =>
    `<div class="snippet-day"><strong>Day ${d.day}</strong>${d.title.length > 28 ? d.title.slice(0, 26) + "…" : d.title}</div>`
  ).join("");
}

// ── Render messages ─────────────────────────────────────────
function renderMessages(threadId) {
  const container = document.getElementById("chat-messages");
  const typingEl = document.getElementById("typing-indicator");
  if (!container) return;

  const thread = getThread(threadId);
  const msgs = thread.messages;

  if (msgs.length === 0) {
    container.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">💬</div>
        <p>No messages yet.<br>Say hi to start planning!</p>
      </div>`;
    if (typingEl) typingEl.classList.remove("visible");
    return;
  }

  let html = "";
  let lastDateLabel = "";

  msgs.forEach(msg => {
    const dateLabel = formatDateLabel(msg.ts);
    if (dateLabel !== lastDateLabel) {
      html += `<div class="chat-date-divider"><span>${dateLabel}</span></div>`;
      lastDateLabel = dateLabel;
    }

    if (msg.type === "itinerary") {
      html += `
        <div class="chat-msg mine">
          <div class="chat-bubble itinerary-share">
            <div class="itinerary-share-label">📍 Shared itinerary</div>
            <div class="itinerary-share-title">${escHtml(msg.title)}</div>
            <div class="itinerary-share-days">${escHtml(msg.summary)}</div>
          </div>
          <div class="chat-ts">${formatTime(msg.ts)}</div>
        </div>`;
    } else {
      const side = msg.from === "me" ? "mine" : "theirs";
      html += `
        <div class="chat-msg ${side}">
          <div class="chat-bubble">${escHtml(msg.text)}</div>
          <div class="chat-ts">${formatTime(msg.ts)}</div>
        </div>`;
    }
  });

  container.innerHTML = html;

  // Move typing indicator inside messages so it appears at the bottom
  if (typingEl) container.appendChild(typingEl);

  scrollToBottom(false);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Send a message ──────────────────────────────────────────
function sendMessage(threadId, text, type = "text", meta = {}) {
  if (!text.trim() && type === "text") return;

  const thread = getThread(threadId);
  const msg = {
    from: "me",
    text: text.trim(),
    ts: new Date().toISOString(),
    type,
    ...meta
  };
  thread.messages.push(msg);
  saveThread(threadId, thread);

  if (threadId === activeThread) renderMessages(threadId);

  // Schedule a reply
  scheduleReply(threadId);
}

// ── Typing indicator + auto reply ───────────────────────────
function scheduleReply(threadId) {
  if (replyTimers[threadId]) return; // already pending

  const typingEl = document.getElementById("typing-indicator");
  const delay = 1800 + Math.random() * 1800; // 1.8–3.6s

  // Show typing if this is the active thread
  if (threadId === activeThread && typingEl) {
    setTimeout(() => {
      if (threadId === activeThread) {
        typingEl.classList.add("visible");
        scrollToBottom();
      }
    }, 600);
  }

  replyTimers[threadId] = setTimeout(() => {
    const thread = getThread(threadId);
    const traveler = TRAVELERS[threadId];
    if (!traveler) return;

    const replies = traveler.replies;
    const idx = thread.replyIndex || 0;
    const replyText = replies[idx % replies.length];

    thread.messages.push({
      from: "them",
      text: replyText,
      ts: new Date().toISOString(),
      type: "text"
    });
    thread.replyIndex = idx + 1;
    saveThread(threadId, thread);

    delete replyTimers[threadId];

    if (threadId === activeThread) {
      if (typingEl) typingEl.classList.remove("visible");
      renderMessages(threadId);
      scrollToBottom();
    } else {
      // Mark tab as unread
      const tab = document.querySelector(`.chat-tab[data-thread="${threadId}"]`);
      if (tab) tab.classList.add("has-unread");
    }
  }, delay);
}

// ── Open panel ──────────────────────────────────────────────
function openChat(threadId) {
  const panel = document.getElementById("chat-panel");
  const overlay = document.getElementById("chat-overlay");
  const traveler = TRAVELERS[threadId];
  if (!traveler || !panel) return;

  activeThread = threadId;

  // Update header
  document.getElementById("chat-avatar").textContent = traveler.initial;
  document.getElementById("chat-header-name").textContent = traveler.name;
  document.getElementById("chat-header-trip").textContent = traveler.trip;

  // Build tabs for all accepted threads
  buildTabs(threadId);

  // Mark tab active & clear unread
  const tab = document.querySelector(`.chat-tab[data-thread="${threadId}"]`);
  document.querySelectorAll(".chat-tab").forEach(t => t.classList.remove("active"));
  if (tab) { tab.classList.add("active"); tab.classList.remove("has-unread"); }

  // Seed welcome message if first open
  const thread = getThread(threadId);
  if (thread.messages.length === 0) {
    thread.messages.push({
      from: "them",
      text: traveler.welcomeMsg,
      ts: new Date().toISOString(),
      type: "text"
    });
    saveThread(threadId, thread);
  }

  updateSnippet();
  renderMessages(threadId);

  panel.classList.add("open");
  overlay.classList.add("open");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  // Focus input
  setTimeout(() => {
    const input = document.getElementById("chat-input");
    if (input) input.focus();
  }, 350);
}

function closeChat() {
  const panel = document.getElementById("chat-panel");
  const overlay = document.getElementById("chat-overlay");
  const typingEl = document.getElementById("typing-indicator");

  panel.classList.remove("open");
  overlay.classList.remove("open");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";

  if (typingEl) typingEl.classList.remove("visible");
  activeThread = null;
}

// ── Build thread tabs ───────────────────────────────────────
function buildTabs(currentId) {
  const tabsEl = document.getElementById("chat-tabs");
  if (!tabsEl) return;

  const accepted = getAcceptedIds();
  // Always include the current one
  const ids = [...new Set([currentId, ...accepted])].filter(id => TRAVELERS[id]);

  if (ids.length <= 1) {
    tabsEl.style.display = "none";
    return;
  }

  tabsEl.style.display = "flex";
  tabsEl.innerHTML = ids.map(id => {
    const t = TRAVELERS[id];
    const thread = getThread(id);
    const hasUnread = false; // cleared on open
    return `
      <button class="chat-tab${id === currentId ? " active" : ""}${hasUnread ? " has-unread" : ""}"
              data-thread="${id}" role="tab" aria-selected="${id === currentId}">
        <div class="chat-tab-dot"></div>
        ${t.initial}. ${t.name.split(" ")[0]}
        <span class="chat-tab-unread">!</span>
      </button>`;
  }).join("");

  tabsEl.querySelectorAll(".chat-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.thread;
      if (id === activeThread) return;
      switchThread(id);
    });
  });
}

function switchThread(threadId) {
  const traveler = TRAVELERS[threadId];
  if (!traveler) return;

  activeThread = threadId;
  document.getElementById("chat-avatar").textContent = traveler.initial;
  document.getElementById("chat-header-name").textContent = traveler.name;
  document.getElementById("chat-header-trip").textContent = traveler.trip;

  document.querySelectorAll(".chat-tab").forEach(t => {
    t.classList.toggle("active", t.dataset.thread === threadId);
    t.setAttribute("aria-selected", t.dataset.thread === threadId);
    if (t.dataset.thread === threadId) t.classList.remove("has-unread");
  });

  const typingEl = document.getElementById("typing-indicator");
  if (typingEl) typingEl.classList.remove("visible");

  renderMessages(threadId);
  updateSnippet();
}

// ── Share itinerary ─────────────────────────────────────────
function shareItinerary() {
  if (!activeThread) return;

  const titleEl = document.getElementById("planner-title");
  const summaryEl = document.getElementById("planner-summary");
  const title = titleEl?.textContent || "Bali itinerary";
  const summary = summaryEl?.textContent || "Our shared trip plan.";

  const thread = getThread(activeThread);
  thread.messages.push({
    from: "me",
    type: "itinerary",
    title,
    summary,
    text: `Shared itinerary: ${title}`,
    ts: new Date().toISOString()
  });
  saveThread(activeThread, thread);
  renderMessages(activeThread);
  scrollToBottom();
  scheduleReply(activeThread);
}


// ── Nav chat button state ───────────────────────────────────
function updateNavChatBtn() {
  const btn = document.getElementById("nav-chat-btn");
  const countEl = document.getElementById("nav-chat-count");
  if (!btn) return;

  const accepted = getAcceptedIds();
  const count = accepted.length;

  if (count > 0) {
    btn.classList.add("has-active");
    if (countEl) {
      countEl.textContent = count;
      countEl.hidden = false;
    }
  } else {
    btn.classList.remove("has-active");
    if (countEl) countEl.hidden = true;
  }
}

// ── Request card wiring ─────────────────────────────────────
function wireRequestCards() {
  const cards = document.querySelectorAll("[data-request-card]");
  const states = loadRequestStates();

  cards.forEach(card => {
    const id = card.dataset.requestCard;

    // Restore accepted/rejected state from localStorage
    if (states[id] === "accept") {
      applyAccepted(card, id, false);
    } else if (states[id] === "reject") {
      applyRejected(card);
    }

    card.addEventListener("click", event => {
      const btn = event.target.closest("[data-request-action]");
      if (!btn) return;

      const action = btn.dataset.requestAction;
      const all = loadRequestStates();
      all[id] = action;
      localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(all));

      if (action === "accept") {
        applyAccepted(card, id, true);
      } else {
        applyRejected(card);
      }

      updateRequestCount();
    });
  });
}

function applyAccepted(card, id, openImmediately) {
  card.classList.add("is-accepted");
  card.classList.remove("is-rejected");

  const actionsEl = card.querySelector(".request-actions");
  if (actionsEl) {
    actionsEl.innerHTML = `
      <p class="request-status">Matched ✓</p>
      <button class="open-chat-btn" data-open-chat="${id}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
        </svg>
        Open chat
      </button>`;

    actionsEl.querySelector("[data-open-chat]")?.addEventListener("click", e => {
      e.stopPropagation();
      openChat(id);
    });
  }

  updateNavChatBtn();
  if (openImmediately) openChat(id);
}

function applyRejected(card) {
  card.classList.add("is-rejected");
  card.classList.remove("is-accepted");
  const actionsEl = card.querySelector(".request-actions");
  if (actionsEl) {
    actionsEl.innerHTML = `<p class="request-status" style="color:#727272">Rejected</p>`;
  }
  updateNavChatBtn();
}

function updateRequestCount() {
  const el = document.getElementById("request-count");
  if (!el) return;
  const pending = document.querySelectorAll("[data-request-card]:not(.is-accepted):not(.is-rejected)").length;
  el.textContent = String(pending);
  el.hidden = pending === 0;
}

// ── Input bar wiring ────────────────────────────────────────
function wireInputBar() {
  const input = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const shareBtn = document.getElementById("chat-share-itinerary");

  if (!input || !sendBtn) return;

  // Auto-resize textarea
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
    sendBtn.disabled = input.value.trim().length === 0;
  });

  // Send on Enter (Shift+Enter = newline)
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  });

  sendBtn.addEventListener("click", doSend);

  shareBtn?.addEventListener("click", shareItinerary);

  function doSend() {
    const text = input.value.trim();
    if (!text || !activeThread) return;
    sendMessage(activeThread, text);
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;
  }
}

// ── Close wiring ────────────────────────────────────────────
function wireClose() {
  document.getElementById("chat-close")?.addEventListener("click", closeChat);
  document.getElementById("chat-overlay")?.addEventListener("click", closeChat);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && activeThread) closeChat();
  });

  // Nav bar chat button — open the most recent accepted thread
  document.getElementById("nav-chat-btn")?.addEventListener("click", () => {
    const accepted = getAcceptedIds();
    if (accepted.length === 0) {
      // Flash the Requests section so user knows to accept first
      const requestsSection = document.getElementById("requests");
      if (requestsSection) {
        requestsSection.scrollIntoView({ behavior: "smooth", block: "start" });
        requestsSection.style.outline = "2px solid #1DB954";
        requestsSection.style.borderRadius = "12px";
        setTimeout(() => { requestsSection.style.outline = ""; requestsSection.style.borderRadius = ""; }, 1800);
      }
      return;
    }
    // Open the first accepted thread (or last active one)
    const target = accepted[0];
    openChat(target);
  });
}

// ── Init ────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  wireRequestCards();
  wireInputBar();
  wireClose();
  updateRequestCount();
  updateNavChatBtn();

  // Listen for itinerary updates from the planner
  document.getElementById("planner-form")?.addEventListener("submit", () => {
    setTimeout(updateSnippet, 2000); // wait for render
  });
});