const CHAT_KEY = "rc_chat_v3";
const REQUEST_KEY = "rc_requests_v3";

const TRAVELERS = {
  arjun: {
    name: "Arjun Mehta",
    initial: "A",
    face: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop&crop=face",
    cover: "https://images.unsplash.com/photo-1558981285-6f0c94958bb6?w=600&h=200&fit=crop",
    trip: "Pune to Ladakh",
    vehicle: "Bajaj Dominar 400",
    dates: "Jun 12-28",
    welcome: "Hey! Saw your route plan. I am starting from Pune and can merge at Nashik. What is your departure date?",
    replies: [
      "Nashik works perfectly for me. I can be there by day 2 morning.",
      "I have done Leh-Manali twice, so I can help navigate the passes.",
      "Do you carry a toolkit? I always pack spares for mountain rides.",
      "What time do you usually start riding in the mornings?",
      "I prefer dhabas over restaurants too. Saves money and the food is better.",
      "Keylong is a great overnight stop before Manali.",
      "Should we sync on a WhatsApp group once we have the full crew?",
      "I can pick up extra fuel cans in Pune if needed."
    ]
  },
  priya: {
    name: "Priya Nair",
    initial: "P",
    face: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&h=120&fit=crop&crop=face",
    cover: "https://images.unsplash.com/photo-1596738520741-38e3cc17439f?w=600&h=200&fit=crop",
    trip: "Nashik to Ladakh",
    vehicle: "Royal Enfield Classic 350",
    dates: "Jun 15-30",
    welcome: "Hi! First Ladakh trip for me, but I have done Spiti. I am a photographer, so I might stop for shots. Is that okay?",
    replies: [
      "The landscapes on this route are unreal.",
      "I am fine with an early 5am start. Golden hour light is the best.",
      "Do you know any good camping spots near Keylong?",
      "I ride a Classic 350, so my pace may be slightly slower on climbs.",
      "I always carry a first aid kit and extra water.",
      "Can we plan a rest day in Manali?",
      "Happy to be the group photographer if you all do not mind.",
      "What is the fuel situation past Manali?"
    ]
  },
  rohan: {
    name: "Rohan Das",
    initial: "R",
    face: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face",
    cover: "https://images.unsplash.com/photo-1604537466608-109fa2f16c3b?w=600&h=200&fit=crop",
    trip: "Delhi to Ladakh",
    vehicle: "KTM Adventure 390",
    dates: "Jun 10-22",
    welcome: "Yo! Different source but same destination. Manali is the natural sync point. I ride fast, but I wait at major stops.",
    replies: [
      "Manali day 1 evening works to meet up and plan together from there.",
      "I usually do 400km days, but I can dial it back for the group.",
      "Rohtang Pass in June should be open, we should be fine.",
      "I am comfortable doing basic mechanical checks.",
      "Let us share a live tracking link so we can see each other on the route.",
      "I know a good guesthouse in Jispa.",
      "I can carry extra bungee cords and a puncture kit.",
      "Fast riding is fine only where the roads allow it."
    ]
  }
};

let activeThread = null;
const replyTimers = {};

function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function loadChats() {
  return loadJson(CHAT_KEY, {});
}

function getThread(id) {
  return loadChats()[id] || { messages: [], replyIndex: 0 };
}

function saveThread(id, thread) {
  const all = loadChats();
  all[id] = thread;
  saveJson(CHAT_KEY, all);
}

function loadRequests() {
  return loadJson(REQUEST_KEY, {});
}

function saveRequest(id, state) {
  const all = loadRequests();
  all[id] = state;
  saveJson(REQUEST_KEY, all);
}

function getAccepted() {
  return Object.entries(loadRequests())
    .filter(([, value]) => value === "accept")
    .map(([id]) => id);
}

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso) {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function scrollBottom(smooth = true) {
  const box = document.getElementById("chat-messages");
  if (box) {
    box.scrollTo({ top: box.scrollHeight, behavior: smooth ? "smooth" : "instant" });
  }
}

function renderMessages(id) {
  const box = document.getElementById("chat-messages");
  const typingEl = document.getElementById("typing-indicator");
  if (!box) return;

  const messages = getThread(id).messages;
  if (!messages.length) {
    box.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">Chat</div>
        <p>No messages yet - say hi.</p>
      </div>
    `;
    typingEl?.classList.remove("visible");
    return;
  }

  let html = "";
  let lastDate = "";

  for (const message of messages) {
    const dateLabel = fmtDate(message.ts);
    if (dateLabel !== lastDate) {
      html += `<div class="chat-date-divider"><span>${dateLabel}</span></div>`;
      lastDate = dateLabel;
    }

    if (message.type === "route") {
      html += `
        <div class="chat-msg mine">
          <div class="chat-bubble route-share">
            <div class="route-share-label">Shared route</div>
            <div class="route-share-title">${esc(message.title)}</div>
            <div class="route-share-sub">${esc(message.sub)}</div>
          </div>
          <div class="chat-ts">${fmtTime(message.ts)}</div>
        </div>
      `;
      continue;
    }

    const side = message.from === "me" ? "mine" : "theirs";
    html += `
      <div class="chat-msg ${side}">
        <div class="chat-bubble">${esc(message.text)}</div>
        <div class="chat-ts">${fmtTime(message.ts)}</div>
      </div>
    `;
  }

  box.innerHTML = html;
  if (typingEl) box.appendChild(typingEl);
  scrollBottom(false);
}

function scheduleReply(id) {
  if (replyTimers[id]) return;

  const typingEl = document.getElementById("typing-indicator");
  const delay = 1800 + Math.random() * 1600;

  setTimeout(() => {
    if (id === activeThread && typingEl) {
      typingEl.classList.add("visible");
      scrollBottom();
    }
  }, 600);

  replyTimers[id] = setTimeout(() => {
    const traveler = TRAVELERS[id];
    const thread = getThread(id);
    const index = thread.replyIndex || 0;
    const text = traveler.replies[index % traveler.replies.length];

    thread.messages.push({ from: "them", text, ts: new Date().toISOString(), type: "text" });
    thread.replyIndex = index + 1;
    saveThread(id, thread);
    delete replyTimers[id];

    if (id === activeThread) {
      typingEl?.classList.remove("visible");
      renderMessages(id);
      scrollBottom();
    } else {
      document.querySelector(`.chat-tab[data-thread="${id}"]`)?.classList.add("has-unread");
    }
  }, delay);
}

function sendMsg(id, text, type = "text", meta = {}) {
  if (type === "text" && !text.trim()) return;

  const thread = getThread(id);
  thread.messages.push({ from: "me", text: text.trim(), ts: new Date().toISOString(), type, ...meta });
  saveThread(id, thread);

  if (id === activeThread) renderMessages(id);
  scheduleReply(id);
}

function buildTabs(currentId) {
  const tabs = document.getElementById("chat-tabs");
  if (!tabs) return;

  const ids = [...new Set([currentId, ...getAccepted().filter((id) => TRAVELERS[id])])];
  if (ids.length <= 1) {
    tabs.classList.remove("visible");
    tabs.innerHTML = "";
    return;
  }

  tabs.classList.add("visible");
  tabs.innerHTML = ids.map((id) => {
    const traveler = TRAVELERS[id];
    return `
      <button class="chat-tab${id === currentId ? " active" : ""}" data-thread="${id}" role="tab">
        <img class="chat-tab-face" src="${traveler.face}" alt="${traveler.initial}" onerror="this.style.display='none'">
        ${traveler.name.split(" ")[0]}
      </button>
    `;
  }).join("");

  tabs.querySelectorAll(".chat-tab").forEach((button) => {
    button.addEventListener("click", () => openChat(button.dataset.thread));
  });
}

function openChat(id) {
  const traveler = TRAVELERS[id];
  if (!traveler) return;

  activeThread = id;

  const image = document.getElementById("chat-avatar-img");
  const fallback = document.getElementById("chat-avatar-fallback");
  if (image) {
    image.src = traveler.face;
    image.style.display = "block";
  }
  if (fallback) {
    fallback.style.display = "none";
    fallback.textContent = traveler.initial;
  }

  const name = document.getElementById("chat-header-name");
  const trip = document.getElementById("chat-header-trip");
  if (name) name.textContent = traveler.name;
  if (trip) trip.textContent = traveler.trip;

  const thread = getThread(id);
  if (!thread.messages.length) {
    thread.messages.push({ from: "them", text: traveler.welcome, ts: new Date().toISOString(), type: "text" });
    saveThread(id, thread);
  }

  buildTabs(id);
  renderMessages(id);

  document.getElementById("chat-panel")?.classList.add("open");
  document.getElementById("chat-overlay")?.classList.add("open");
  document.body.style.overflow = "hidden";
  setTimeout(() => document.getElementById("chat-input")?.focus(), 300);
}

function closeChat() {
  document.getElementById("chat-panel")?.classList.remove("open");
  document.getElementById("chat-overlay")?.classList.remove("open");
  document.getElementById("typing-indicator")?.classList.remove("visible");
  document.body.style.overflow = "";
  activeThread = null;
}

function updateNavBtn() {
  const button = document.getElementById("nav-chat-btn");
  const count = document.getElementById("nav-chat-count");
  const acceptedCount = getAccepted().length;

  if (!button) return;
  button.classList.toggle("has-active", acceptedCount > 0);

  if (count) {
    count.textContent = String(acceptedCount);
    count.hidden = acceptedCount === 0;
  }
}

function updateRequestBadge() {
  const badge = document.getElementById("request-count");
  if (!badge) return;

  const pending = document.querySelectorAll("[data-request-card]:not(.is-accepted):not(.is-rejected)").length;
  badge.textContent = String(pending);
  badge.hidden = pending === 0;
}

function rebuildMatchesGrid() {
  const grid = document.getElementById("matches-grid");
  const empty = document.getElementById("matches-empty");
  if (!grid) return;

  grid.querySelectorAll(".match-profile-card").forEach((card) => card.remove());

  const accepted = getAccepted();
  if (!accepted.length) {
    if (empty) empty.style.display = "flex";
    return;
  }

  if (empty) empty.style.display = "none";

  for (const id of accepted) {
    const traveler = TRAVELERS[id];
    if (!traveler) continue;

    const sourceCard = document.querySelector(`[data-request-card="${id}"]`);
    const vehicle = sourceCard?.dataset.travelerVehicle || traveler.vehicle;
    const dates = sourceCard?.dataset.travelerDates || traveler.dates;
    const [from, to] = traveler.trip.split(" to ");

    const card = document.createElement("div");
    card.className = "match-profile-card";
    card.dataset.matchId = id;
    card.innerHTML = `
      <div class="mpc-cover" style="background-image:url('${traveler.cover}');background-size:cover;background-position:center">
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,#181818 100%)"></div>
      </div>
      <div class="mpc-body">
        <div class="mpc-face-wrap">
          <img class="mpc-face" src="${traveler.face}" alt="${traveler.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
          <div class="mpc-face-fallback">${traveler.initial}</div>
        </div>
        <div class="mpc-name">${esc(traveler.name)}</div>
        <div class="mpc-route">
          <span class="from-pill">${esc(from || "")}</span>
          <span class="route-word">to</span>
          <span class="to-pill">${esc(to || "")}</span>
        </div>
        <div class="mpc-vehicle">${esc(vehicle)} | ${esc(dates)}</div>
        <button class="mpc-chat-btn" data-open-chat="${id}">Open chat</button>
      </div>
    `;

    card.querySelector("[data-open-chat]")?.addEventListener("click", () => openChat(id));
    grid.appendChild(card);
  }
}

function applyAccepted(card, id, openNow) {
  card.classList.add("is-accepted");
  card.classList.remove("is-rejected");

  const actions = card.querySelector(".request-actions");
  if (actions) {
    actions.innerHTML = `
      <p class="request-status-text">Matched</p>
      <button class="open-chat-btn" data-open-chat="${id}">Open chat</button>
    `;
    actions.querySelector("[data-open-chat]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      openChat(id);
    });
  }

  updateRequestBadge();
  updateNavBtn();
  rebuildMatchesGrid();
  if (openNow) openChat(id);
}

function applyRejected(card) {
  card.classList.add("is-rejected");
  card.classList.remove("is-accepted");

  const actions = card.querySelector(".request-actions");
  if (actions) actions.innerHTML = `<p class="request-status-text" style="color:#727272">Declined</p>`;

  updateRequestBadge();
  updateNavBtn();
  rebuildMatchesGrid();
}

function wireCards() {
  const states = loadRequests();

  document.querySelectorAll("[data-request-card]").forEach((card) => {
    const id = card.dataset.requestCard;

    if (states[id] === "accept") applyAccepted(card, id, false);
    if (states[id] === "reject") applyRejected(card);

    card.querySelector(".request-actions")?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-request-action]");
      if (!button) return;

      const action = button.dataset.requestAction;
      saveRequest(id, action);

      if (action === "accept") applyAccepted(card, id, true);
      else applyRejected(card);
    });
  });
}

function wireInput() {
  const input = document.getElementById("chat-input");
  const sendButton = document.getElementById("chat-send");
  const shareButton = document.getElementById("chat-share-route");
  if (!input || !sendButton) return;

  function doSend() {
    const text = input.value.trim();
    if (!text || !activeThread) return;

    sendMsg(activeThread, text);
    input.value = "";
    input.style.height = "auto";
    sendButton.disabled = true;
  }

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
    sendButton.disabled = !input.value.trim();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      doSend();
    }
  });

  sendButton.addEventListener("click", doSend);

  shareButton?.addEventListener("click", () => {
    if (!activeThread) return;
    const from = document.getElementById("source")?.value || "Source";
    const to = document.getElementById("destination")?.value || "Destination";
    const meetpoints = document.getElementById("meetpoints")?.value || "";

    sendMsg(activeThread, "Shared the trip route", "route", {
      title: `${from} to ${to}`,
      sub: meetpoints ? `Meet-up points: ${meetpoints}` : "Route shared"
    });
  });
}

function wireNav() {
  document.getElementById("nav-chat-btn")?.addEventListener("click", () => {
    const accepted = getAccepted();
    if (!accepted.length) {
      const section = document.getElementById("requests-section");
      section?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (section) {
        section.style.outline = "2px solid #1DB954";
        section.style.outlineOffset = "8px";
        setTimeout(() => {
          section.style.outline = "";
          section.style.outlineOffset = "";
        }, 1800);
      }
      return;
    }

    openChat(accepted[0]);
  });

  document.getElementById("chat-close")?.addEventListener("click", closeChat);
  document.getElementById("chat-overlay")?.addEventListener("click", closeChat);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeThread) closeChat();
  });
}

function wireTripForm() {
  const form = document.getElementById("trip-form");
  if (!form) return;

  const today = new Date();
  const end = new Date(today);
  end.setDate(today.getDate() + 30);
  const startDate = document.getElementById("start-date");
  const endDate = document.getElementById("end-date");
  if (startDate && !startDate.value) startDate.value = today.toISOString().slice(0, 10);
  if (endDate && !endDate.value) endDate.value = end.toISOString().slice(0, 10);

  form.addEventListener("submit", () => {
    const from = document.getElementById("source")?.value.trim() || "From";
    const to = document.getElementById("destination")?.value.trim() || "To";
    const start = document.getElementById("start-date")?.value || "";
    const finish = document.getElementById("end-date")?.value || "";
    const tripType = document.getElementById("trip-type");
    const vehicle = document.getElementById("vehicle")?.value.trim() || "Vehicle / gear";
    const habits = document.getElementById("habits")?.value.trim() || "";
    const meetpoints = document.getElementById("meetpoints")?.value.trim() || "Add meet-up points";

    const fromEl = document.getElementById("tc-from");
    const toEl = document.getElementById("tc-to");
    const datesEl = document.getElementById("tc-dates");
    const typeEl = document.getElementById("tc-type");
    const vehicleEl = document.getElementById("tc-vehicle");
    const meetpointsEl = document.getElementById("tc-meetpoints");
    const habitsEl = document.getElementById("tc-habits");
    const statusEl = document.getElementById("trip-status");
    const card = document.getElementById("my-trip-card");

    if (fromEl) fromEl.textContent = from;
    if (toEl) toEl.textContent = to;
    if (datesEl) datesEl.textContent = start && finish ? `${start} - ${finish}` : "Dates not set";
    if (typeEl && tripType) typeEl.textContent = tripType.options[tripType.selectedIndex].text;
    if (vehicleEl) vehicleEl.textContent = vehicle;
    if (meetpointsEl) meetpointsEl.textContent = meetpoints;
    if (habitsEl) {
      habitsEl.innerHTML = habits
        .split(/[,\.]+/)
        .slice(0, 6)
        .map((habit) => habit.trim())
        .filter(Boolean)
        .map((habit) => `<div class="habit-tag">${esc(habit)}</div>`)
        .join("");
    }
    if (statusEl) statusEl.textContent = "Trip published. Riders on matching routes can now find you.";
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireCards();
  wireInput();
  wireNav();
  wireTripForm();
  updateRequestBadge();
  updateNavBtn();
  rebuildMatchesGrid();
});
