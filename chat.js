/* ─── RoamCircle chat.js — Step 3 (all issues fixed) ────────
 *
 * Fix #2  rebuildMatchesGrid — shows real accepted users, not just demo
 * Fix #3  openChat — works for both demo and real users
 * Fix #5  buildTabs — includes real accepted users
 * Fix #6  syncNav chat count — includes real accepted users
 * Fix #8  loadAndRenderSuggestions — refreshes match states before render
 */

// ── Demo traveler registry (hardcoded demo cards only) ───────
const T = {
  arjun: {
    name:    "Arjun Mehta",
    initial: "A",
    face:    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop&crop=face",
    cover:   "https://images.unsplash.com/photo-1558981285-6f0c94958bb6?w=600&h=200&fit=crop",
    trip:    "Pune → Ladakh",
    vehicle: "Bajaj Dominar 400",
    dates:   "Jun 12–28",
    welcome: "Hey! Saw your Mumbai–Ladakh post. I'm starting from Pune — routes merge at Nashik on day 2. Dates work perfectly!",
    replies: [
      "Nashik works great for me, I can be there by 8am 🤝",
      "I've done Leh–Manali twice, happy to navigate the passes",
      "Do you carry a toolkit? I always pack spare levers and chain links",
      "What time do you usually start in the mornings? I prefer 5am",
      "Dhabas over restaurants every time — the food is better and way cheaper",
      "Keylong is a solid overnight before the final push to Leh",
      "Should we create a WhatsApp group once the crew is confirmed?",
      "I can bring extra fuel cans from Pune for the remote Ladakh stretches"
    ]
  },
  priya: {
    name:    "Priya Nair",
    initial: "P",
    face:    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&h=120&fit=crop&crop=face",
    cover:   "https://images.unsplash.com/photo-1596738520741-38e3cc17439f?w=600&h=200&fit=crop",
    trip:    "Nashik → Ladakh",
    vehicle: "RE Classic 350",
    dates:   "Jun 15–30",
    welcome: "Hi! First Ladakh trip for me but I've done Spiti. I stop a lot for photos — hope that's okay for the group pace?",
    replies: [
      "The landscapes on this route are absolutely unreal for photography 📸",
      "I'm totally fine with a 5am start — golden hour light is best anyway",
      "Do you know good camping spots near Keylong?",
      "My Classic 350 might be slightly slower on steep climbs — I'll flag it",
      "I carry a first aid kit and extra water — mountain basics",
      "Can we plan a rest day in Manali before the final push?",
      "Happy to be the group photographer if everyone's okay with that!",
      "What's the fuel situation past Manali? I've heard it can be tricky"
    ]
  },
  rohan: {
    name:    "Rohan Das",
    initial: "R",
    face:    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face",
    cover:   "https://images.unsplash.com/photo-1604537466608-109fa2f16c3b?w=600&h=200&fit=crop",
    trip:    "Delhi → Ladakh",
    vehicle: "KTM Adventure 390",
    dates:   "Jun 10–22",
    welcome: "Yo! Different source but same destination. Manali is the natural sync point. I ride fast but always wait at major stops.",
    replies: [
      "KTM vs Himalayan on the passes is always a fun conversation 😄",
      "I have a satellite phone for emergencies — useful if the group splits",
      "Manali day 5 evening works to link up and plan from there together",
      "I can dial back the pace for the group — no problem at all",
      "Rohtang should be clear in June, we'll be fine timing-wise",
      "I'm a decent mechanic — happy to do a quick bike check at Manali",
      "Let's share a live tracking link so we can see each other on the route",
      "There's a great guesthouse in Jispa — better than Keylong for the price"
    ]
  }
};

// ── Real user profile cache (populated from suggestions API) ──
// Keyed by userId — stores { name, from, to, vehicle, dates }
const realUserCache = {};

// ── Constants ─────────────────────────────────────────────────
const DEMO_PREFIX = "demo_";
const BOT_PREFIX  = "bot_";

function isDemoId(id)  { return id.startsWith(DEMO_PREFIX); }
function demoKey(id)   { return id.startsWith(DEMO_PREFIX) ? id.slice(DEMO_PREFIX.length) : id; }
function getDemoData(id) { return T[demoKey(id)] || null; }

// ── State ─────────────────────────────────────────────────────
let active      = null;
let myUserId    = null;
let replyTimers = {};

// ── Cache ─────────────────────────────────────────────────────
function cacheSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function cacheGet(k)    { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } }

// ── API helpers ───────────────────────────────────────────────
async function apiFetch(path, opts = {}) {
  try {
    const res  = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && data.redirect) { window.location.href = data.redirect; return { ok: false, status: 401, data }; }
    return { ok: res.ok, status: res.status, data };
  } catch(e) {
    console.error("[api]", path, e.message);
    return { ok: false, status: 0, data: { error: e.message } };
  }
}

const apiGet  = p      => apiFetch(p);
const apiPost = (p, b) => apiFetch(p, { method: "POST", body: JSON.stringify(b) });

// ── Get current user ID ───────────────────────────────────────
async function getMyUserId() {
  if (myUserId) return myUserId;
  const { ok, data } = await apiGet("/api/auth/me");
  if (ok) { myUserId = data.userId; return myUserId; }
  return null;
}

// ── Thread ID ─────────────────────────────────────────────────
async function threadId(requesterId) {
  const uid = await getMyUserId();
  return uid ? `${uid}_${requesterId}` : null;
}

// ── Time helpers ──────────────────────────────────────────────
function fmtTime(iso) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function fmtDate(iso) {
  const d = new Date(iso), t = new Date();
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}
function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Match state helpers ───────────────────────────────────────
async function loadMatchStates() {
  const { ok, data } = await apiGet("/api/matches");
  if (ok) { cacheSet("rc_matches", data.matches); return data.matches; }
  return cacheGet("rc_matches") || {};
}

async function saveMatchState(requesterId, action) {
  const cached = cacheGet("rc_matches") || {};
  cached[requesterId] = action;
  cacheSet("rc_matches", cached);
  const { ok, data } = await apiPost(`/api/matches/${requesterId}`, { action });
  if (!ok) console.error("[match save]", data.error);
}

function getAccepted(states) {
  return Object.entries(states || {}).filter(([, v]) => v === "accept").map(([k]) => k);
}

// ── Message helpers ───────────────────────────────────────────
async function loadMessages(tid) {
  const { ok, data } = await apiGet(`/api/messages/${encodeURIComponent(tid)}`);
  if (ok) { cacheSet(`rc_msgs_${tid}`, data.messages); return data.messages; }
  return cacheGet(`rc_msgs_${tid}`) || [];
}

async function postMessage(tid, payload) {
  const { ok, data } = await apiPost(`/api/messages/${encodeURIComponent(tid)}`, payload);
  if (!ok) { console.error("[msg post]", data.error); return null; }
  const cached = cacheGet(`rc_msgs_${tid}`) || [];
  cached.push(data.message);
  cacheSet(`rc_msgs_${tid}`, cached);
  return data.message;
}

function getBotReplyIndex(msgs, requesterId) {
  const botId = `${BOT_PREFIX}${demoKey(requesterId)}`;
  return msgs.filter(m => m.from === botId).length;
}

// ── Render messages ───────────────────────────────────────────
function renderMsgs(msgs, requesterId) {
  const box = document.getElementById("chat-messages");
  const typ = document.getElementById("typing-indicator");
  if (!box) return;

  if (!msgs || !msgs.length) {
    box.innerHTML = `<div class="chat-empty"><div class="chat-empty-icon">💬</div><p>No messages yet — say hi!</p></div>`;
    typ?.classList.remove("visible");
    return;
  }

  // For demo chats, bot messages come from "bot_{key}"
  // For real user chats, their messages come from their userId
  const botId = requesterId ? `${BOT_PREFIX}${demoKey(requesterId)}` : null;

  let html = "", lastDate = "";
  msgs.forEach(m => {
    const ts = m.createdAt || new Date().toISOString();
    const dl = fmtDate(ts);
    if (dl !== lastDate) {
      html += `<div class="chat-date-divider"><span>${dl}</span></div>`;
      lastDate = dl;
    }
    if (m.type === "route") {
      html += `
        <div class="chat-msg mine">
          <div class="chat-bubble route-share">
            <div class="route-share-label">🏍️ Shared route</div>
            <div class="route-share-title">${esc(m.meta?.title || "Route")}</div>
            <div class="route-share-sub">${esc(m.meta?.sub || "")}</div>
          </div>
          <div class="chat-ts">${fmtTime(ts)}</div>
        </div>`;
    } else {
      // A message is "mine" if it came from me (myUserId)
      // or from neither the bot nor any other user's userId
      const isMine = m.from === myUserId;
      const side   = isMine ? "mine" : "theirs";
      html += `
        <div class="chat-msg ${side}">
          <div class="chat-bubble">${esc(m.text)}</div>
          <div class="chat-ts">${fmtTime(ts)}</div>
        </div>`;
    }
  });

  box.innerHTML = html;
  if (typ) box.appendChild(typ);
  scrollBottom(false);
}

function showChatLoading() {
  const box = document.getElementById("chat-messages");
  if (box) box.innerHTML = `
    <div class="chat-empty">
      <div style="display:flex;gap:5px;align-items:center;justify-content:center">
        <div class="typing-dot"></div>
        <div class="typing-dot" style="animation-delay:0.2s"></div>
        <div class="typing-dot" style="animation-delay:0.4s"></div>
      </div>
      <p style="margin-top:10px">Loading messages…</p>
    </div>`;
}

function scrollBottom(smooth = true) {
  const box = document.getElementById("chat-messages");
  if (box) box.scrollTo({ top: box.scrollHeight, behavior: smooth ? "smooth" : "instant" });
}

// ── Send + bot reply ──────────────────────────────────────────
async function sendMsg(requesterId, text, type = "text", meta = {}) {
  if (type === "text" && !text.trim()) return;
  const tid = await threadId(requesterId);
  if (!tid) return;

  const optimistic = { from: myUserId, text: text.trim(), type, meta, createdAt: new Date().toISOString() };
  const cached = cacheGet(`rc_msgs_${tid}`) || [];
  cached.push(optimistic);
  cacheSet(`rc_msgs_${tid}`, cached);
  if (requesterId === active) renderMsgs(cached, requesterId);

  await postMessage(tid, { text: text.trim(), type, meta });

  // Only schedule bot replies for demo travelers
  if (isDemoId(requesterId)) scheduleReply(requesterId, tid);
}

function scheduleReply(requesterId, tid) {
  if (replyTimers[requesterId]) return;
  const tv    = getDemoData(requesterId); if (!tv) return;
  const typ   = document.getElementById("typing-indicator");
  const delay = 1800 + Math.random() * 1600;

  setTimeout(() => {
    if (requesterId === active && typ) { typ.classList.add("visible"); scrollBottom(); }
  }, 600);

  replyTimers[requesterId] = setTimeout(async () => {
    const currentMsgs = await loadMessages(tid);
    const idx         = getBotReplyIndex(currentMsgs, requesterId);
    const text        = tv.replies[idx % tv.replies.length];

    await postMessage(tid, {
      text, type: "text", meta: {},
      botSender: demoKey(requesterId),
      botName:   tv.name
    });

    delete replyTimers[requesterId];
    const updatedMsgs = await loadMessages(tid);

    if (requesterId === active) {
      typ?.classList.remove("visible");
      renderMsgs(updatedMsgs, requesterId);
      scrollBottom();
    } else {
      document.querySelector(`.chat-tab[data-thread="${requesterId}"]`)?.classList.add("has-unread");
    }
  }, delay);
}

// ── Open chat — works for both demo and real users ────────────
async function openChat(requesterId) {
  active = requesterId;
  await getMyUserId();

  const isDemo = isDemoId(requesterId);
  const tv     = isDemo ? getDemoData(requesterId) : null;

  // Fix #4 + #8 — if real user not in cache yet, fetch from /api/users/:id
  if (!isDemo && !realUserCache[requesterId]) {
    const { ok, data } = await apiGet(`/api/users/${encodeURIComponent(requesterId)}`);
    if (ok && data.userId) {
      realUserCache[requesterId] = {
        userName:  data.userName,
        avatarUrl: data.avatarUrl  || "",
        from:      data.from,
        to:        data.to,
        vehicle:   data.vehicle,
        startDate: data.startDate,
        endDate:   data.endDate
      };
    }
  }

  const real = !isDemo ? (realUserCache[requesterId] || null) : null;

  // Determine display info — use avatarUrl for real users, face photo for demo
  const displayName  = tv?.name      || real?.userName  || "Rider";
  const displayTrip  = tv?.trip      || (real ? `${real.from || "?"} → ${real.to || "?"}` : "");
  const displayFace  = tv?.face      || real?.avatarUrl || null;
  const displayInit  = displayName[0] || "?";

  // Update header
  const img = document.getElementById("chat-avatar-img");
  const fb  = document.getElementById("chat-avatar-fallback");
  if (img) {
    if (displayFace) {
      img.src = displayFace;
      img.style.display = "block";
      img.onerror = () => { img.style.display = "none"; if (fb) { fb.style.display = "grid"; fb.textContent = displayInit; } };
    } else {
      img.style.display = "none";
    }
  }
  if (fb) { fb.style.display = displayFace ? "none" : "grid"; fb.textContent = displayInit; }

  const hn = document.getElementById("chat-header-name");
  const ht = document.getElementById("chat-header-trip");
  if (hn) hn.textContent = displayName;
  if (ht) ht.textContent = displayTrip;

  // Open panel + show spinner
  document.getElementById("chat-panel")?.classList.add("open");
  document.getElementById("chat-overlay")?.classList.add("open");
  document.body.style.overflow = "hidden";
  showChatLoading();
  // Let realtime.js know which thread is open so it skips the notification
  window._rcActiveThread = null; // will be set after threadId resolves

  const tid = await threadId(requesterId);
  if (!tid) { closeChat(); return; }
  window._rcActiveThread = tid;

  let msgs = await loadMessages(tid);

  // Seed welcome for demo travelers only
  if (!msgs.length && isDemo && tv) {
    await postMessage(tid, {
      text: tv.welcome, type: "text", meta: {},
      botSender: demoKey(requesterId), botName: tv.name
    });
    msgs = await loadMessages(tid);
  }

  // For real users with no messages, show a prompt
  if (!msgs.length && !isDemo) {
    const box = document.getElementById("chat-messages");
    if (box) box.innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">👋</div>
        <p>You matched with ${esc(displayName)}!<br>Send the first message.</p>
      </div>`;
    buildTabs(requesterId);
    setTimeout(() => document.getElementById("chat-input")?.focus(), 360);
    return;
  }

  buildTabs(requesterId);
  renderMsgs(msgs, requesterId);
  setTimeout(() => document.getElementById("chat-input")?.focus(), 360);
}

function closeChat() {
  document.getElementById("chat-panel")?.classList.remove("open");
  document.getElementById("chat-overlay")?.classList.remove("open");
  document.getElementById("typing-indicator")?.classList.remove("visible");
  document.body.style.overflow = "";
  active = null;
  window._rcActiveThread = null;
}

// ── Build tabs — Fix #5: includes real accepted users ─────────
function buildTabs(currentId) {
  const el = document.getElementById("chat-tabs"); if (!el) return;
  const states   = cacheGet("rc_matches") || {};
  const accepted = getAccepted(states); // all accepted, both demo and real

  // Only show tabs for IDs that have either a T entry OR a realUserCache entry
  const ids = [...new Set([currentId, ...accepted])].filter(id =>
    getDemoData(id) || realUserCache[id]
  );

  if (ids.length <= 1) { el.classList.remove("visible"); return; }
  el.classList.add("visible");

  el.innerHTML = ids.map(id => {
    const tv   = getDemoData(id);
    const real = realUserCache[id];
    const face = tv?.face || null;
    const name = tv?.name?.split(" ")[0] || real?.userName?.split(" ")[0] || "Rider";
    const init = name[0] || "?";
    return `
      <button class="chat-tab${id === currentId ? " active" : ""}" data-thread="${id}">
        ${face
          ? `<img class="chat-tab-face" src="${face}" alt="${init}" onerror="this.style.display='none'">`
          : `<div class="chat-tab-face" style="display:grid;place-items:center;background:linear-gradient(135deg,#1DB954,#0ea5e9);color:#000;font-weight:800;font-size:0.7rem;border-radius:50%">${init}</div>`
        }
        ${esc(name)}
      </button>`;
  }).join("");

  el.querySelectorAll(".chat-tab").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.thread;
      if (id === active) return;
      el.querySelectorAll(".chat-tab").forEach(b => {
        b.classList.toggle("active", b.dataset.thread === id);
        if (b.dataset.thread === id) b.classList.remove("has-unread");
      });
      document.getElementById("typing-indicator")?.classList.remove("visible");
      showChatLoading();
      // Update header
      const tv2   = getDemoData(id);
      const real2 = realUserCache[id];
      const img2  = document.getElementById("chat-avatar-img");
      const fb2   = document.getElementById("chat-avatar-fallback");
      const hn2   = document.getElementById("chat-header-name");
      const ht2   = document.getElementById("chat-header-trip");
      if (tv2) {
        if (img2) { img2.src = tv2.face; img2.style.display = "block"; }
        if (fb2)  fb2.style.display = "none";
        if (hn2)  hn2.textContent = tv2.name;
        if (ht2)  ht2.textContent = tv2.trip;
      } else if (real2) {
        if (img2) img2.style.display = "none";
        if (fb2)  { fb2.style.display = "grid"; fb2.textContent = real2.userName?.[0] || "?"; }
        if (hn2)  hn2.textContent = real2.userName || "Rider";
        if (ht2)  ht2.textContent = `${real2.from || "?"} → ${real2.to || "?"}`;
      }
      active = id;
      const tid2 = await threadId(id);
      const msgs = tid2 ? await loadMessages(tid2) : [];
      renderMsgs(msgs, id);
    });
  });
}

// ── Nav sync — Fix #6: counts all accepted (demo + real) ─────
function syncNav(states) {
  const btn = document.getElementById("nav-chat-btn");
  const cnt = document.getElementById("nav-chat-count");
  if (btn) {
    // Count all accepted IDs that have known data (demo or real)
    const n = getAccepted(states).filter(id =>
      getDemoData(id) || realUserCache[id]
    ).length;
    btn.classList.toggle("has-active", n > 0);
    if (cnt) { cnt.textContent = n; cnt.hidden = n === 0; }
  }
  const reqEl = document.getElementById("request-count");
  if (reqEl) {
    const pending = document.querySelectorAll(
      "[data-request-card]:not(.is-accepted):not(.is-rejected)"
    ).length;
    reqEl.textContent = pending;
    reqEl.hidden = pending === 0;
  }
}

// ── Matches grid — Fix #2: shows real users too ───────────────
function rebuildMatchesGrid(states) {
  const grid  = document.getElementById("matches-grid");
  const empty = document.getElementById("matches-empty");
  if (!grid) return;

  grid.querySelectorAll(".match-profile-card").forEach(c => c.remove());

  // Include ALL accepted IDs — both demo and real
  const accepted = getAccepted(states).filter(id =>
    getDemoData(id) || realUserCache[id]
  );

  if (!accepted.length) { if (empty) empty.style.display = "flex"; return; }
  if (empty) empty.style.display = "none";

  accepted.forEach(id => {
    const isDemo = isDemoId(id);
    const tv     = getDemoData(id);
    const real   = realUserCache[id];

    const name   = tv?.name  || real?.userName || "Rider";
    const face   = tv?.face  || null;
    const cover  = tv?.cover || null;
    const init   = name[0]   || "?";
    const from   = tv ? tv.trip.split(" → ")[0] : (real?.from || "?");
    const to     = tv ? tv.trip.split(" → ")[1] : (real?.to   || "?");
    const veh    = tv?.vehicle || real?.vehicle || "";
    const dt     = tv?.dates   || (real ? `${real.startDate || ""} – ${real.endDate || ""}` : "");

    const coverStyle = cover
      ? `background-image:url('${cover}');background-size:cover;background-position:center`
      : `background:linear-gradient(135deg,rgba(29,185,84,0.2),#1a1a2e)`;

    const card = document.createElement("div");
    card.className = "match-profile-card";
    card.innerHTML = `
      <div class="mpc-cover" style="${coverStyle};position:relative">
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 30%,#181818 100%)"></div>
      </div>
      <div class="mpc-body">
        <div class="mpc-face-wrap">
          ${face
            ? `<img class="mpc-face" src="${face}" alt="${esc(name)}"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
               <div class="mpc-face-fallback">${init}</div>`
            : `<div class="mpc-face-fallback" style="display:grid">${init}</div>`
          }
        </div>
        <div class="mpc-name">${esc(name)}</div>
        <div class="mpc-route">
          <span class="from-pill">${esc(from)}</span>
          <svg width="22" height="8" viewBox="0 0 22 8">
            <path d="M0 4h16M12 1l4 3-4 3" stroke="#1DB954" stroke-width="1.5"
                  fill="none" stroke-linecap="round"/>
          </svg>
          <span class="to-pill">${esc(to)}</span>
        </div>
        <div class="mpc-vehicle">🏍️ ${esc(veh)} · ${esc(dt)}</div>
        ${!isDemo
          ? `<div class="mpc-pending-badge">⏳ Waiting for their accept</div>`
          : ""}
        <button class="mpc-chat-btn" data-open-chat="${id}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
          </svg>
          Open chat
        </button>
      </div>`;
    card.querySelector(".mpc-chat-btn").addEventListener("click", () => openChat(id));
    grid.appendChild(card);
  });
}

// ── Apply accepted/rejected states ────────────────────────────
function applyAccepted(card, id, states) {
  card.classList.add("is-accepted");
  card.classList.remove("is-rejected");
  const act = card.querySelector(".request-actions");
  if (act) {
    act.innerHTML = `
      <p class="request-status-text">Matched ✓</p>
      <button class="open-chat-btn" data-open-chat="${id}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
        </svg>
        Open chat
      </button>`;
    act.querySelector("[data-open-chat]")
       .addEventListener("click", e => { e.stopPropagation(); openChat(id); });
  }
  syncNav(states || cacheGet("rc_matches") || {});
  rebuildMatchesGrid(states || cacheGet("rc_matches") || {});
}

function applyRejected(card, states) {
  card.classList.add("is-rejected");
  card.classList.remove("is-accepted");
  const act = card.querySelector(".request-actions");
  if (act) act.innerHTML = `<p class="request-status-text" style="color:#727272">Declined</p>`;
  syncNav(states || cacheGet("rc_matches") || {});
  rebuildMatchesGrid(states || cacheGet("rc_matches") || {});
}

function applyRealAccepted(card, userId, states) {
  card.classList.add("is-accepted");
  card.classList.remove("is-rejected");
  const act = card.querySelector(".request-actions");
  if (act) {
    act.innerHTML = `
      <p class="request-status-text">Request sent ✓</p>
      <p style="color:#b3b3b3;font-size:0.8rem;margin:4px 0 0">
        Waiting for them to accept you back
      </p>`;
  }
  if (states) { syncNav(states); rebuildMatchesGrid(states); }
}

function applyRealRejected(card, states) {
  card.classList.add("is-rejected");
  card.classList.remove("is-accepted");
  const act = card.querySelector(".request-actions");
  if (act) act.innerHTML = `<p class="request-status-text" style="color:#727272">Declined</p>`;
  if (states) { syncNav(states); rebuildMatchesGrid(states); }
}

// ── Real suggestions — Fix #8: refresh states before render ───
async function loadAndRenderSuggestions() {
  const { ok, data } = await apiGet("/api/matches/suggestions");
  if (!ok) return;

  if (data.reason) {
    const list = document.getElementById("request-list");
    if (list && !list.querySelector(".no-trip-notice")) {
      const notice = document.createElement("div");
      notice.className = "no-trip-notice";
      notice.innerHTML = `⚠️ ${data.reason} Real rider suggestions will appear here once your trip is live.`;
      list.insertBefore(notice, list.firstChild);
    }
    return;
  }

  const suggestions = data.suggestions || [];
  if (!suggestions.length) return;

  // Fix #8 — refresh match states from DB before rendering
  const matchStates = await loadMatchStates();

  if (suggestions.length > 0) {
    const label = document.getElementById("real-riders-label");
    if (label) label.style.display = "flex";
  }

  suggestions.forEach(s => {
    // Populate real user cache so grid + tabs + openChat all work
    realUserCache[s.userId] = {
      userName:  s.userName,
      avatarUrl: s.avatarUrl  || "",
      from:      s.from,
      to:        s.to,
      vehicle:   s.vehicle,
      startDate: s.startDate,
      endDate:   s.endDate
    };
    renderRealCard(s, matchStates[s.userId]);
  });

  syncNav(matchStates);
  rebuildMatchesGrid(matchStates);
}

// Cache my trip dates so dateProximityLabel doesn't depend on DOM timing
let _myTripStart = "";
let _myTripEnd   = "";

function cacheMyTripDates() {
  _myTripStart = document.getElementById("start-date")?.value || "";
  _myTripEnd   = document.getElementById("end-date")?.value   || "";
}

// Show a human-readable label for how close dates are
function dateProximityLabel(theirStart, theirEnd) {
  try {
    const ts      = new Date(theirStart);
    const te      = new Date(theirEnd);
    // Fix 6 — use cached dates, not live DOM read
    const myStart = new Date(_myTripStart || document.getElementById("start-date")?.value || "");
    const myEnd   = new Date(_myTripEnd   || document.getElementById("end-date")?.value   || "");
    if (isNaN(myStart) || isNaN(myEnd) || isNaN(ts) || isNaN(te)) return "";

    const overlapMs   = Math.min(myEnd, te) - Math.max(myStart, ts);
    const overlapDays = Math.round(overlapMs / 86_400_000);

    if (overlapDays >= 7)  return '<div class="date-badge good">✓ ' + overlapDays + ' days overlap</div>';
    if (overlapDays >= 1)  return '<div class="date-badge ok">' + overlapDays + ' day overlap — manageable</div>';
    if (overlapDays >= -3) return '<div class="date-badge close">⚡ Dates within 3 days — great meet-up window</div>';
    if (overlapDays >= -7) return '<div class="date-badge warn">📅 ' + Math.abs(overlapDays) + ' day date gap — worth discussing</div>';
    return '<div class="date-badge far">🗓️ ' + Math.abs(overlapDays) + ' day date gap</div>';
  } catch { return ""; }
}

function renderRealCard(s, existingState) {
  const list = document.getElementById("request-list");
  if (!list) return;
  if (document.querySelector(`[data-request-card="${s.userId}"]`)) return;

  const card = document.createElement("article");
  card.className = "request-card real-rider-card";
  card.dataset.requestCard     = s.userId;
  card.dataset.travelerName    = s.userName;
  card.dataset.travelerVehicle = s.vehicle || "";
  card.dataset.travelerDates   = `${s.startDate || ""} – ${s.endDate || ""}`;

  const typeEmoji = { motorcycle:"🏍️", roadtrip:"🚗", cycling:"🚴", hiking:"🥾", backpacking:"🎒", train:"🚆" };
  const emoji  = typeEmoji[s.tripType] || "🌍";
  const habits = (s.habits || "")
    .split(/[,\.]+/).map(h => h.trim()).filter(Boolean).slice(0, 5)
    .map(h => `<div class="habit-tag">${esc(h)}</div>`).join("");

  const proximityHtml = dateProximityLabel(s.startDate, s.endDate);
  const nearbyHtml    = s.destinationMatch === "nearby"
    ? '<span class="nearby-badge">📍 Nearby route</span>'
    : "";

  card.innerHTML = `
    <div class="rrc-inner">
      <!-- Left: avatar column -->
      <div class="rrc-avatar-col">
        ${s.avatarUrl
          ? `<img class="rrc-avatar-img" src="${s.avatarUrl}"
                  alt="${esc(s.userName?.[0] || "?")}"
                  onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"
             ><div class="rrc-avatar" style="display:none">${esc(s.userName?.[0] || "?")}</div>`
          : `<div class="rrc-avatar">${esc(s.userName?.[0] || "?")}</div>`
        }
        <div class="rrc-score">${s.score}%</div>
      </div>

      <!-- Right: content column -->
      <div class="rrc-content">
        <div class="rrc-header">
          <div class="rrc-name">${esc(s.userName)}</div>
          <div class="rrc-badges">
            <span class="match-score" style="background:rgba(56,189,248,0.1);border-color:rgba(56,189,248,0.3);color:#38bdf8;font-size:0.68rem">Real rider</span>
            ${nearbyHtml}
          </div>
        </div>

        <div class="rrc-route">
          <span class="from-pill">${esc(s.from || "?")}</span>
          <svg width="24" height="8" viewBox="0 0 24 8" style="flex-shrink:0">
            <path d="M0 4h18M14 1l4 3-4 3" stroke="#1DB954" stroke-width="1.5" fill="none" stroke-linecap="round"/>
          </svg>
          <span class="to-pill">${esc(s.to || "?")}</span>
        </div>

        <div class="rrc-meta">
          ${emoji} ${esc(s.vehicle || s.tripType || "")} &nbsp;·&nbsp;
          ${esc(s.startDate || "")} – ${esc(s.endDate || "")} &nbsp;·&nbsp;
          ${esc(s.pace || "moderate")} pace
        </div>

        ${proximityHtml}

        <div class="req-habits" style="margin:10px 0 6px">${habits}</div>

        <div class="rrc-details">
          <div><span class="rrc-detail-label">Meet-up points</span><span class="rrc-detail-val">${esc(s.meetpoints || "Not specified")}</span></div>
          <div><span class="rrc-detail-label">Budget</span><span class="rrc-detail-val">${esc(s.budget || "mid")}</span></div>
        </div>

        <div class="request-actions" id="actions-${s.userId}">
          <button class="button compact accept" type="button" data-request-action="accept">Accept</button>
          <button class="button compact reject" type="button" data-request-action="reject">Decline</button>
        </div>
      </div>
    </div>`;

  list.appendChild(card);

  if (existingState === "accept")  applyRealAccepted(card, s.userId);
  else if (existingState === "reject") applyRealRejected(card);

  card.addEventListener("click", async e => {
    const btn = e.target.closest("[data-request-action]");
    if (!btn) return;
    const action = btn.dataset.requestAction;
    await saveMatchState(s.userId, action);
    const updated = cacheGet("rc_matches") || {};
    if (action === "accept") applyRealAccepted(card, s.userId, updated);
    else applyRealRejected(card, updated);
  });
}

// ── Wire demo request cards ───────────────────────────────────
async function wireCards() {
  await getMyUserId();
  const states = await loadMatchStates();

  document.querySelectorAll("[data-request-card]").forEach(card => {
    const id = card.dataset.requestCard;
    if (states[id] === "accept")  applyAccepted(card, id, states);
    else if (states[id] === "reject") applyRejected(card, states);

    card.addEventListener("click", async e => {
      const btn = e.target.closest("[data-request-action]");
      if (!btn) return;
      const action = btn.dataset.requestAction;
      await saveMatchState(id, action);
      const updated = cacheGet("rc_matches") || {};
      if (action === "accept") { applyAccepted(card, id, updated); openChat(id); }
      else applyRejected(card, updated);
    });
  });

  syncNav(states);
  rebuildMatchesGrid(states);
}

// ── Wire input bar ────────────────────────────────────────────
function wireInput() {
  const input    = document.getElementById("chat-input");
  const sendBtn  = document.getElementById("chat-send");
  const shareBtn = document.getElementById("chat-share-route");
  if (!input || !sendBtn) return;

  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 110) + "px";
    sendBtn.disabled = !input.value.trim();
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
  });

  sendBtn.addEventListener("click", doSend);

  shareBtn?.addEventListener("click", () => {
    if (!active) return;
    const from = document.getElementById("source")?.value      || "Source";
    const to   = document.getElementById("destination")?.value || "Destination";
    const meet = document.getElementById("meetpoints")?.value  || "";
    sendMsg(active, "Shared the route", "route", {
      title: `${from} → ${to}`,
      sub:   meet ? `Meet-up points: ${meet}` : "Route shared"
    });
  });

  async function doSend() {
    const text = input.value.trim();
    if (!text || !active) return;
    input.value = ""; input.style.height = "auto"; sendBtn.disabled = true;
    await sendMsg(active, text);
  }
}

// ── Wire nav ──────────────────────────────────────────────────
function wireNav() {
  document.getElementById("nav-chat-btn")?.addEventListener("click", async () => {
    const states   = cacheGet("rc_matches") || {};
    const accepted = getAccepted(states).filter(id => getDemoData(id) || realUserCache[id]);
    if (!accepted.length) {
      const sec = document.getElementById("requests-section");
      if (sec) {
        sec.scrollIntoView({ behavior: "smooth", block: "start" });
        sec.style.outline = "2px solid #1DB954";
        sec.style.outlineOffset = "8px";
        setTimeout(() => { sec.style.outline = ""; sec.style.outlineOffset = ""; }, 1800);
      }
      return;
    }
    openChat(accepted[0]);
  });

  document.getElementById("chat-close")?.addEventListener("click", closeChat);
  document.getElementById("chat-overlay")?.addEventListener("click", closeChat);
  document.addEventListener("keydown", e => { if (e.key === "Escape" && active) closeChat(); });
}

// ── Wire trip form ────────────────────────────────────────────
function wireTripForm() {
  const form = document.getElementById("trip-form"); if (!form) return;

  const today = new Date(), end = new Date(today);
  end.setDate(today.getDate() + 30);
  const sd = document.getElementById("start-date");
  const ed = document.getElementById("end-date");
  if (sd && !sd.value) sd.value = today.toISOString().slice(0, 10);
  if (ed && !ed.value) ed.value = end.toISOString().slice(0, 10);

  // Restore saved trip from DB on load — both card and form fields
  apiGet("/api/trips/mine").then(({ ok, data }) => {
    if (ok && data.trip) {
      const t = data.trip;
      const setVal = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
      setVal("source",      t.from);
      setVal("destination", t.to);
      setVal("start-date",  t.startDate);
      setVal("end-date",    t.endDate);
      setVal("trip-type",   t.tripType);
      setVal("vehicle",     t.vehicle);
      setVal("pace",        t.pace);
      setVal("budget",      t.budget);
      setVal("habits",      t.habits);
      setVal("meetpoints",  t.meetpoints);
      restoreTripCard(t);
      cacheMyTripDates(); // Fix 6 — cache dates after DB restore
    }
  });

  form.addEventListener("submit", async e => {
    e.preventDefault();
    cacheMyTripDates(); // Fix 6 — cache dates before suggestions render
    const btn = document.getElementById("publish-btn");
    if (btn) { btn.textContent = "Publishing…"; btn.disabled = true; }

    const payload = {
      source:      document.getElementById("source")?.value.trim()      || "",
      destination: document.getElementById("destination")?.value.trim() || "",
      startDate:   document.getElementById("start-date")?.value         || "",
      endDate:     document.getElementById("end-date")?.value           || "",
      tripType:    document.getElementById("trip-type")?.value          || "motorcycle",
      vehicle:     document.getElementById("vehicle")?.value.trim()     || "",
      pace:        document.getElementById("pace")?.value               || "moderate",
      budget:      document.getElementById("budget")?.value             || "mid",
      habits:      document.getElementById("habits")?.value.trim()      || "",
      meetpoints:  document.getElementById("meetpoints")?.value.trim()  || ""
    };

    const { ok, data } = await apiPost("/api/trips", payload);
    const statusEl = document.getElementById("trip-status");

    if (ok) {
      restoreTripCard(data.trip);
      if (statusEl) statusEl.textContent = "✓ Trip saved — riders on matching routes can find you.";
    } else {
      if (statusEl) statusEl.textContent = `Error: ${data.error || "Could not save trip."}`;
    }

    if (btn) { btn.textContent = "Publish my trip"; btn.disabled = false; }
  });
}

function restoreTripCard(trip) {
  if (!trip) return;
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; };
  setTxt("tc-from",       trip.from       || "");
  setTxt("tc-to",         trip.to         || "");
  setTxt("tc-dates",      `${trip.startDate || ""} – ${trip.endDate || ""}`);
  setTxt("tc-vehicle",    trip.vehicle    || "");
  setTxt("tc-meetpoints", trip.meetpoints || "");
  const typeLabels = {
    motorcycle:"🏍️ Motorcycle ride", roadtrip:"🚗 Road trip",
    cycling:"🚴 Cycling", hiking:"🥾 Hiking",
    backpacking:"🎒 Backpacking", train:"🚆 Train journey"
  };
  setTxt("tc-type", typeLabels[trip.tripType] || trip.tripType || "");
  const habEl = document.getElementById("tc-habits");
  if (habEl && trip.habits) {
    habEl.innerHTML = trip.habits
      .split(/[,\.]+/).map(h => h.trim()).filter(Boolean).slice(0, 6)
      .map(h => `<div class="habit-tag">${esc(h)}</div>`).join("");
  }
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await wireCards();
  wireInput();
  wireNav();
  wireTripForm();
  loadAndRenderSuggestions();
  wireRealtimeEvents();  // Fix #10 — wire realtime.js custom events
});

// Fix #10 — handle events dispatched by realtime.js via CustomEvent
// This guarantees chat.js is fully initialised before any handler runs
function wireRealtimeEvents() {

  // New match request arrived — refresh real suggestions list
  document.addEventListener("rc:match_request", async () => {
    await loadAndRenderSuggestions();
  });

  // Mutual match confirmed — rebuild matches grid with fresh state
  document.addEventListener("rc:match_accepted", async e => {
    const states = await loadMatchStates();
    const rid    = e.detail?.requesterId;

    // Add the new mutual match to cached states if not already there
    if (rid && !states[rid]) {
      states[rid] = "accept";
      cacheSet("rc_matches", states);
    }

    // Fix #8 — hydrate realUserCache directly from /api/users/:id
    // (suggestions API excludes already-decided users so it won't help here)
    if (rid && !realUserCache[rid] && !isDemoId(rid)) {
      const { ok, data } = await apiGet(`/api/users/${encodeURIComponent(rid)}`);
      if (ok && data.userId) {
        realUserCache[rid] = {
          userName:  data.userName,
          avatarUrl: data.avatarUrl  || "",
          from:      data.from,
          to:        data.to,
          vehicle:   data.vehicle,
          startDate: data.startDate,
          endDate:   data.endDate
        };
      }
    }

    syncNav(states);
    rebuildMatchesGrid(states);
  });

  // New message arrived in a thread
  document.addEventListener("rc:new_message", async e => {
    const event       = e.detail;
    const panelEl     = document.getElementById("chat-panel");
    const panelOpen   = panelEl?.classList.contains("open") ?? false;
    const isActive    = panelOpen && window._rcActiveThread === event.threadId;

    if (isActive) {
      // Panel is open on this thread — reload messages silently
      const requesterId = event.threadId.split("_").slice(1).join("_");
      const msgs        = await loadMessages(event.threadId);
      renderMsgs(msgs, requesterId);
    }
    // If not active, the notification bell handles it — nothing else needed here
  });

  // Open a specific chat thread (triggered by notification click)
  document.addEventListener("rc:open_chat", e => {
    const { requesterId } = e.detail || {};
    if (requesterId) openChat(requesterId);
  });
}
