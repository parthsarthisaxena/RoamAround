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
    name:       "Arjun Mehta",
    initial:    "A",
    face:       "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&h=120&fit=crop&crop=face",
    cover:      "https://images.unsplash.com/photo-1558981285-6f0c94958bb6?w=600&h=200&fit=crop",
    trip:       "Pune → Ladakh",
    from:       "Pune",
    to:         "Ladakh",
    vehicle:    "Bajaj Dominar 400",
    dates:      "Jun 12–28",
    startDate:  "Jun 12",
    endDate:    "Jun 28",
    pace:       "moderate",
    budget:     "mid",
    tripType:   "motorcycle",
    meetpoints: "Pune, Nashik, Manali",
    rating:     "4.7",
    longRides:  "6",
    score:      88,
    habits:     "🌅 Early starter, 🛠️ Carries toolkit, 🏕️ Camping OK, 🍛 Dhaba lover, 🚭 Non-smoker",
    bio:        "Hey fellow riders! I'm Arjun, a rider based in Pune. I've been riding long distance for about 6 years now. Completed Spiti Valley circuit twice, Kerala coastal route, and Ladakh once. Cruiser at heart, usually cruising comfortably at 85-95 km/h. Early starts (usually 5am!) are my standard to beat highway traffic and reach the first night stop before dark. I carry a full toolkit and spare parts, happy to help with minor mechanical issues.",
    lookingFor: "Moderate-paced, safe, and reliable riders who respect road rules. Comfortable with basic guesthouses/wild camping, and don't mind starting early mornings.",
    welcome:    "Hey! Saw your Mumbai–Ladakh post. I'm starting from Pune — routes merge at Nashik on day 2. Dates work perfectly!",
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
    name:       "Priya Nair",
    initial:    "P",
    face:       "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&h=120&fit=crop&crop=face",
    cover:      "https://images.unsplash.com/photo-1596738520741-38e3cc17439f?w=600&h=200&fit=crop",
    trip:       "Nashik → Ladakh",
    from:       "Nashik",
    to:         "Ladakh",
    vehicle:    "RE Classic 350",
    dates:      "Jun 15–30",
    startDate:  "Jun 15",
    endDate:    "Jun 30",
    pace:       "relaxed",
    budget:     "mid",
    tripType:   "motorcycle",
    meetpoints: "Nashik",
    rating:     "4.5",
    longRides:  "4",
    score:      82,
    habits:     "📸 Photographer, 🏕️ Camping, 🌿 Solo rider, 🔧 Basic mechanic, 🚭 Non-smoker",
    bio:        "Hey there! I'm Priya, a solo rider and travel photographer starting from Nashik on my Royal Enfield Classic 350. Completed the Spiti circuit solo last year. I love slow travel, stopping frequently to take photographs, capture landscape shots, and explore off-beat scenic spots. Safety-conscious rider, relaxed pace, cruising at 70-80 km/h. Comfortable with basic setups, wild camping, and carried a first-aid kit.",
    lookingFor: "Patience with frequent photography stops, similar relaxed riding pace, safe riding habits, and comfortable with camping in mountain environments.",
    welcome:    "Hi! First Ladakh trip for me but I've done Spiti. I stop a lot for photos — hope that's okay for the group pace?",
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
    name:       "Rohan Das",
    initial:    "R",
    face:       "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop&crop=face",
    cover:      "https://images.unsplash.com/photo-1604537466608-109fa2f16c3b?w=600&h=200&fit=crop",
    trip:       "Delhi → Ladakh",
    from:       "Delhi",
    to:         "Ladakh",
    vehicle:    "KTM Adventure 390",
    dates:      "Jun 10–22",
    startDate:  "Jun 10",
    endDate:    "Jun 22",
    pace:       "fast",
    budget:     "mid",
    tripType:   "motorcycle",
    meetpoints: "Manali, Delhi",
    rating:     "4.8",
    longRides:  "11",
    score:      74,
    habits:     "⚡ Fast rider, 🏨 Guesthouses, 🛠️ Expert mechanic, 📡 Satellite phone",
    bio:        "Yo! I'm Rohan, a fast-paced adventurer starting from Delhi on my KTM Adventure 390. Highly experienced with 11 long rides under my belt, including Leh-Srinagar twice, Spiti, and northeastern routes. Fast cruising style (100-110 km/h), usually targeting 350-450 km per day. Expert mechanic — happy to perform quick checkups on the group bikes. I carry a satellite phone for emergency safety.",
    lookingFor: "Highly self-reliant, fast-paced riders with mountain experience. Must know basic bike maintenance. Comfortable with guesthouses or hostels.",
    welcome:    "Yo! Different source but same destination. Manali is the natural sync point. I ride fast but always wait at major stops.",
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

function coverImageStyle(url) {
  const light = document.documentElement.getAttribute("data-theme") === "light";
  const grad = light
    ? "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(229,241,248,0.94) 100%)"
    : "linear-gradient(to bottom, rgba(0,0,0,0.12) 0%, rgba(18,18,18,0.88) 100%)";
  return `${grad}, url('${url}')`;
}
function demoKey(id)   { return id.startsWith(DEMO_PREFIX) ? id.slice(DEMO_PREFIX.length) : id; }
function getDemoData(id) { return T[demoKey(id)] || null; }

function canChatWith(requesterId) {
  if (isDemoId(requesterId)) return true;
  return !!(window.rcMutualMatches && window.rcMutualMatches.has(requesterId));
}

// Parse the other participant from a threadId (handles demo_arjun in the id)
function peerFromThread(threadId, myId) {
  if (!threadId || !myId) return null;
  if (threadId.startsWith(`${myId}_`)) return threadId.slice(myId.length + 1);
  if (threadId.endsWith(`_${myId}`)) return threadId.slice(0, threadId.length - myId.length - 1);
  return null;
}

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
  if (!uid) return null;
  const sorted = [uid, requesterId].sort();
  return `${sorted[0]}_${sorted[1]}`;
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
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── Match state helpers ───────────────────────────────────────
window.rcMutualMatches = new Set();
async function loadMutualMatches() {
  const { ok, data } = await apiGet("/api/matches/mutual");
  if (ok && data.mutual) {
    window.rcMutualMatches = new Set(data.mutual.map(m => m.requesterId));
  }
}

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
  await loadMutualMatches();
}

function getAccepted(states) {
  return Object.entries(states || {}).filter(([, v]) => v === "accept").map(([k]) => k);
}

window._rcThreadHasMore = {};
async function loadMessages(tid, before = "") {
  let url = `/api/messages/${encodeURIComponent(tid)}?limit=50`;
  if (before) url += `&before=${encodeURIComponent(before)}`;
  const { ok, data } = await apiGet(url);
  if (ok) {
    if (before) {
      const existing = cacheGet(`rc_msgs_${tid}`) || [];
      const merged = [...data.messages, ...existing];
      cacheSet(`rc_msgs_${tid}`, merged);
      window._rcThreadHasMore[tid] = data.hasMore;
      return merged;
    } else {
      cacheSet(`rc_msgs_${tid}`, data.messages);
      window._rcThreadHasMore[tid] = data.hasMore;
      return data.messages;
    }
  }
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
function renderMsgs(msgs, requesterId, isLoadMore = false) {
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

  const activeTid = window._rcActiveThread;
  const hasMore = activeTid && window._rcThreadHasMore[activeTid];
  if (hasMore) {
    html = `<div class="chat-load-more-wrap" style="text-align:center;padding:15px 0 5px">
      <button class="button compact rc-load-more-btn" id="chat-load-more-btn">Load older messages</button>
    </div>` + html;
  }

  box.innerHTML = html;
  if (typ) box.appendChild(typ);

  if (hasMore) {
    const btn = document.getElementById("chat-load-more-btn");
    if (btn) {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        btn.disabled = true;
        btn.textContent = "Loading...";
        const oldest = msgs[0]?.createdAt || new Date().toISOString();
        const oldScrollHeight = box.scrollHeight;
        const merged = await loadMessages(activeTid, oldest);
        renderMsgs(merged, requesterId, true);
        box.scrollTop = box.scrollHeight - oldScrollHeight;
      });
    }
  }

  if (!isLoadMore) {
    scrollBottom(false);
  }
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
  await loadMutualMatches();
  if (!canChatWith(requesterId)) return;
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
  await getMyUserId();
  await loadMutualMatches();

  if (!canChatWith(requesterId)) {
    active = null;
    const box = document.getElementById("chat-messages");
    document.getElementById("chat-panel")?.classList.add("open");
    document.getElementById("chat-overlay")?.classList.add("open");
    document.body.style.overflow = "hidden";
    window._rcActiveThread = null;
    if (box) {
      box.innerHTML = `
        <div class="chat-empty">
          <div class="chat-empty-icon">⏳</div>
          <p>Waiting for them to accept you back.<br>Chat opens once you both accept.</p>
        </div>`;
    }
    return;
  }

  active = requesterId;

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
        endDate:   data.endDate,
        gender:    data.gender     || "unspecified"
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

  // Only show tabs for IDs that are mutually matched (or is the current active thread ID)
  const ids = [...new Set([currentId, ...accepted])].filter(id => {
    const hasData = getDemoData(id) || realUserCache[id];
    if (!hasData) return false;
    if (id === currentId) return true;
    const isDemo = isDemoId(id);
    const isMutual = isDemo || (window.rcMutualMatches && window.rcMutualMatches.has(id));
    return isMutual;
  });

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
          ? `<img class="chat-tab-face" src="${esc(face)}" alt="${init}" onerror="this.style.display='none'">`
          : `<div class="chat-tab-face rc-avatar-fallback">${init}</div>`
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
    // Count all mutual matches (both demo and real)
    const n = getAccepted(states).filter(id => {
      const isDemo = isDemoId(id);
      const isMutual = isDemo || (window.rcMutualMatches && window.rcMutualMatches.has(id));
      return isMutual && (getDemoData(id) || realUserCache[id]);
    }).length;
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
    const isDemo   = isDemoId(id);
    const tv       = getDemoData(id);
    const real     = realUserCache[id];
    const isMutual = isDemo || (window.rcMutualMatches && window.rcMutualMatches.has(id));

    const name   = tv?.name  || real?.userName || "Rider";
    const face   = tv?.face  || null;
    const cover  = tv?.cover || null;
    const init   = name[0]   || "?";
    const from   = tv ? tv.trip.split(" → ")[0] : (real?.from || "?");
    const to     = tv ? tv.trip.split(" → ")[1] : (real?.to   || "?");
    const veh    = tv?.vehicle || real?.vehicle || "";
    const dt     = tv?.dates   || (real ? `${real.startDate || ""} – ${real.endDate || ""}` : "");

    const coverStyle = cover
      ? `background-image:url('${esc(cover)}');background-size:cover;background-position:center`
      : `background:linear-gradient(135deg,rgba(29,185,84,0.2),#1a1a2e)`;

    const card = document.createElement("div");
    card.className = "match-profile-card";
    card.innerHTML = `
      <div class="mpc-cover" style="${coverStyle};position:relative">
        <div class="mpc-cover-fade"></div>
      </div>
      <div class="mpc-body">
        <div class="mpc-face-wrap">
          ${face
            ? `<img class="mpc-face" src="${esc(face)}" alt="${esc(name)}"
                    onerror="this.style.display='none';this.nextElementSibling.style.display='grid'">
               <div class="mpc-face-fallback">${init}</div>`
            : `<div class="mpc-face-fallback" style="display:grid">${init}</div>`
          }
        </div>
        <div class="mpc-name">${esc(name)}</div>
        <div class="mpc-rating-slot" data-rating-user="${esc(id)}"></div>
        <div class="mpc-route">
          <span class="from-pill">${esc(from)}</span>
          <svg width="22" height="8" viewBox="0 0 22 8">
            <path d="M0 4h16M12 1l4 3-4 3" stroke="#1DB954" stroke-width="1.5"
                  fill="none" stroke-linecap="round"/>
          </svg>
          <span class="to-pill">${esc(to)}</span>
        </div>
        <div class="mpc-vehicle">🏍️ ${esc(veh)} · ${esc(dt)}</div>
        ${!isMutual
          ? `<div class="mpc-pending-badge">⏳ Waiting for their accept</div>`
          : `<div class="mpc-mutual-badge">🎉 Mutual Match</div>`}
        <button class="mpc-chat-btn" data-open-chat="${id}" ${!isMutual ? "disabled class='mpc-chat-btn is-disabled'" : ""}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
          </svg>
          ${isMutual ? "Open chat" : "Waiting to accept"}
        </button>
      </div>`;
    card.querySelector(".mpc-chat-btn").addEventListener("click", () => {
      if (isMutual) openChat(id);
    });
    card.addEventListener("click", e => {
      if (e.target.closest("button, a")) return;
      openTravelerDrawer(id);
    });
    const mpcRating = card.querySelector(".mpc-rating-slot");
    if (mpcRating && window.RC_ratings) {
      RC_ratings.mountBadge(mpcRating, id, name);
    }
    grid.appendChild(card);
  });

  // Animate newly added match cards
  if (typeof window.RC_revealNew === "function") {
    setTimeout(() => window.RC_revealNew(grid), 50);
  }
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

function dismissCard(card, animate = true) {
  if (animate) {
    // Collapse height + fade out, then remove
    card.style.transition = "opacity 0.22s ease, transform 0.22s ease, max-height 0.3s ease 0.18s, margin 0.3s ease 0.18s, padding 0.3s ease 0.18s";
    card.style.opacity    = "0";
    card.style.transform  = "scale(0.95) translateY(-6px)";
    card.style.maxHeight  = card.offsetHeight + "px"; // lock before collapsing
    void card.offsetWidth; // flush
    setTimeout(() => {
      card.style.maxHeight = "0";
      card.style.margin    = "0";
      card.style.padding   = "0";
    }, 30);
    setTimeout(() => card.remove(), 500);
  } else {
    card.remove();
  }
}

function applyRejected(card, states) {
  dismissCard(card, true);
  syncNav(states || cacheGet("rc_matches") || {});
  rebuildMatchesGrid(states || cacheGet("rc_matches") || {});
}

function applyRealAccepted(card, userId, states) {
  card.classList.add("is-accepted");
  card.classList.remove("is-rejected");
  const act = card.querySelector(".request-actions");
  if (act) {
    const isMutual = window.rcMutualMatches && window.rcMutualMatches.has(userId);
    if (isMutual) {
      act.innerHTML = `
        <p class="request-status-text">Mutual match! 🎉</p>
        <button class="open-chat-btn rc-open-chat-btn" data-open-chat="${userId}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/>
          </svg>
          Open chat
        </button>`;
      act.querySelector("[data-open-chat]").addEventListener("click", e => {
        e.stopPropagation();
        openChat(userId);
      });
    } else {
      act.innerHTML = `
        <p class="request-status-text">Request sent ✓</p>
        <p class="rc-pending-note">
          Waiting for them to accept you back
        </p>`;
    }
  }
  if (states) { syncNav(states); rebuildMatchesGrid(states); }
}

function applyRealRejected(card, states) {
  dismissCard(card, true);
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
      userName:    s.userName,
      displayName: s.displayName || s.userName,
      avatarUrl:   s.avatarUrl   || "",
      from:        s.from,
      to:          s.to,
      vehicle:     s.vehicle,
      startDate:   s.startDate,
      endDate:     s.endDate,
      bio:         s.bio         || "",
      lookingFor:  s.lookingFor  || "",
      pace:        s.pace        || "moderate",
      budget:      s.budget      || "mid",
      tripType:    s.tripType    || "motorcycle",
      habits:      s.habits      || "",
      meetpoints:  s.meetpoints  || "",
      coverUrl:    s.coverUrl    || "",
      score:       s.score       || 0,
      destinationMatch: s.destinationMatch || "exact"
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
          ? `<img class="rrc-avatar-img" src="${esc(s.avatarUrl)}"
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
          <div class="rrc-name-row">
            <div class="rrc-name">${esc(s.userName)}</div>
            <div class="rrc-rating-slot" data-rating-user="${esc(s.userId)}"></div>
          </div>
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

  const ratingSlot = card.querySelector(".rrc-rating-slot");
  if (ratingSlot && window.RC_ratings) {
    RC_ratings.mountBadge(ratingSlot, s.userId, s.userName);
  }

  if (existingState === "accept")  applyRealAccepted(card, s.userId);
  else if (existingState === "reject") dismissCard(card, false); // already decided — remove silently

  card.addEventListener("click", async e => {
    const btn = e.target.closest("[data-request-action]");
    if (btn) {
      const action = btn.dataset.requestAction;
      await saveMatchState(s.userId, action);
      const updated = cacheGet("rc_matches") || {};
      if (action === "accept") {
        applyRealAccepted(card, s.userId, updated);
        if (canChatWith(s.userId)) openChat(s.userId);
      } else applyRealRejected(card, updated);
    } else if (!e.target.closest("button, a")) {
      openTravelerDrawer(s.userId);
    }
  });
}

// ── Wire demo request cards ───────────────────────────────────
async function wireCards() {
  await getMyUserId();
  const states = await loadMatchStates();
  await loadMutualMatches();

  // Load profiles of all real accepted users to populate realUserCache
  const accepted = getAccepted(states);
  const realAcceptedIds = accepted.filter(id => !isDemoId(id));

  await Promise.all(realAcceptedIds.map(async id => {
    if (!realUserCache[id]) {
      const { ok, data } = await apiGet(`/api/users/${encodeURIComponent(id)}`);
      if (ok && data.userId) {
        realUserCache[id] = {
          userName:    data.userName,
          displayName: data.displayName || data.userName,
          avatarUrl:   data.avatarUrl   || "",
          from:        data.from,
          to:          data.to,
          vehicle:     data.vehicle,
          startDate:   data.startDate,
          endDate:     data.endDate,
          bio:         data.bio         || "",
          lookingFor:  data.lookingFor  || "",
          pace:        data.pace        || "moderate",
          budget:      data.budget      || "mid",
          tripType:    data.tripType    || "motorcycle",
          habits:      data.habits      || "",
          meetpoints:  data.meetpoints  || "",
          coverUrl:    data.coverUrl    || "",
          score:       data.score       || 0,
          gender:      data.gender      || "unspecified",
        };
      }
    }
  }));

  document.querySelectorAll("[data-request-card]").forEach(card => {
    const id = card.dataset.requestCard;
    const reqInfo = card.querySelector(".req-info");
    if (reqInfo && window.RC_ratings && !card.querySelector(".req-rating-slot")) {
      const slot = document.createElement("div");
      slot.className = "req-rating-slot";
      reqInfo.appendChild(slot);
      const name = card.dataset.travelerName || getDemoData(id)?.name || "Rider";
      RC_ratings.mountBadge(slot, id, name);
    }
    if (states[id] === "accept")  applyAccepted(card, id, states);
    else if (states[id] === "reject") dismissCard(card, false); // already decided — remove silently

    card.addEventListener("click", async e => {
      const btn = e.target.closest("[data-request-action]");
      if (btn) {
        const action = btn.dataset.requestAction;
        await saveMatchState(id, action);
        const updated = cacheGet("rc_matches") || {};
        if (action === "accept") { applyAccepted(card, id, updated); openChat(id); }
        else applyRejected(card, updated);
      } else if (!e.target.closest("button, a")) {
        openTravelerDrawer(id);
      }
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
        sec.style.outline = "2px solid var(--green)";
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
      setVal("gender-preference", t.genderPreference || "any");
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
      meetpoints:  document.getElementById("meetpoints")?.value.trim()  || "",
      coverUrl:    localStorage.getItem("rc_trip_cover")                || "",
      genderPreference: document.getElementById("gender-preference")?.value || "any"
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
  _currentTrip = trip; // keep a copy for the drawer
  if (trip.coverUrl) {
    try { localStorage.setItem("rc_trip_cover", trip.coverUrl); } catch {}
  }
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
  // Apply saved cover photo to the card thumbnail
  loadSavedCover();
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await wireCards();
  wireInput();
  wireNav();
  wireTripForm();
  wireTripCard();
  wireTravelerDrawer();
  loadAndRenderSuggestions();
  wireRealtimeEvents();  // Fix #10 — wire realtime.js custom events

  document.addEventListener("rc:theme-changed", () => {
    const saved = localStorage.getItem("rc_trip_cover");
    if (saved) setTripCover(saved);
  });
});

// ── Trip detail drawer ────────────────────────────────────────

let _currentTrip = null;

const COVER_PHOTOS = [
  { url: "https://images.unsplash.com/photo-1558981285-6f0c94958bb6?w=900&h=400&fit=crop",  label: "Himalayan Rd" },
  { url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&h=400&fit=crop", label: "Mountain Pass" },
  { url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=900&h=400&fit=crop", label: "Valley View" },
  { url: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=900&h=400&fit=crop", label: "Open Highway" },
  { url: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=900&h=400&fit=crop", label: "Night Ride" },
  { url: "https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=900&h=400&fit=crop", label: "Spiti Valley" },
  { url: "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=900&h=400&fit=crop", label: "Aerial View" },
  { url: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=900&h=400&fit=crop", label: "Coastal Road" },
];

function setTripCover(url) {
  if (!url) return;
  // Card thumbnail cover
  const cardCover = document.getElementById("trip-card-cover");
  if (cardCover) {
    cardCover.style.backgroundImage = coverImageStyle(url);
    cardCover.style.backgroundSize   = "cover";
    cardCover.style.backgroundPosition = "center";
  }
  // Drawer cover
  const drawerCover = document.getElementById("td-cover");
  if (drawerCover) {
    drawerCover.style.backgroundImage = coverImageStyle(url);
    drawerCover.style.backgroundSize   = "cover";
    drawerCover.style.backgroundPosition = "center";
  }
  try {
    localStorage.setItem("rc_trip_cover", url);
    if (_currentTrip) {
      _currentTrip.coverUrl = url;
      apiPost("/api/trips", {
        source:      _currentTrip.from || "",
        destination: _currentTrip.to   || "",
        startDate:   _currentTrip.startDate || "",
        endDate:     _currentTrip.endDate   || "",
        tripType:    _currentTrip.tripType  || "motorcycle",
        vehicle:     _currentTrip.vehicle   || "",
        pace:        _currentTrip.pace      || "moderate",
        budget:      _currentTrip.budget    || "mid",
        habits:      _currentTrip.habits    || "",
        meetpoints:  _currentTrip.meetpoints || "",
        coverUrl:    url
      });
    }
  } catch {}
}

function loadSavedCover() {
  try {
    const saved = localStorage.getItem("rc_trip_cover");
    if (saved) setTripCover(saved);
  } catch {}
}

function openTripDrawer() {
  if (!_currentTrip) return;
  const trip = _currentTrip;
  const el  = id => document.getElementById(id);
  const setT = (id, v) => { const e = el(id); if (e) e.textContent = v || "–"; };

  setT("td-hero-from", trip.from);
  setT("td-hero-to",   trip.to);

  // Duration in days
  let dayLabel = "–";
  if (trip.startDate && trip.endDate) {
    const ms = new Date(trip.endDate) - new Date(trip.startDate);
    if (!isNaN(ms) && ms >= 0) dayLabel = Math.round(ms / 86_400_000) + "d";
  }
  setT("td-stat-days",   dayLabel);
  setT("td-stat-pace",   trip.pace   ? trip.pace.charAt(0).toUpperCase()   + trip.pace.slice(1)   : "–");
  setT("td-stat-budget", trip.budget ? trip.budget.charAt(0).toUpperCase() + trip.budget.slice(1) : "–");
  const shortType = { motorcycle:"Moto", roadtrip:"Road", cycling:"Cycle",
                       hiking:"Hike", backpacking:"Pack", train:"Train" };
  setT("td-stat-type", shortType[trip.tripType] || trip.tripType || "–");

  // Rows
  setT("td-dates", trip.startDate && trip.endDate
    ? `${trip.startDate}  →  ${trip.endDate}` : "–");
  setT("td-vehicle-drawer",   trip.vehicle    || "–");
  setT("td-meetpoints-drawer", trip.meetpoints || "–");

  // Habits
  const habSection = el("td-habits-section");
  const habWrap    = el("td-habits-drawer");
  if (habWrap) {
    const tags = (trip.habits || "").split(/[,\.]+/).map(h => h.trim()).filter(Boolean).slice(0, 8);
    habWrap.innerHTML = tags.map(h => `<div class="habit-tag">${esc(h)}</div>`).join("");
    if (habSection) habSection.style.display = tags.length ? "" : "none";
  }

  // Apply saved cover to drawer
  loadSavedCover();

  // Open
  el("trip-drawer-overlay")?.classList.add("open");
  el("trip-drawer")?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeTripDrawer() {
  document.getElementById("trip-drawer-overlay")?.classList.remove("open");
  document.getElementById("trip-drawer")?.classList.remove("open");
  // Collapse photo picker
  const picker = document.getElementById("td-photo-picker");
  if (picker) picker.style.display = "none";
  document.body.style.overflow = "";
}

function initPhotoPicker() {
  const grid = document.getElementById("td-photo-grid");
  if (!grid || grid.dataset.ready) return; // only build once
  grid.dataset.ready = "1";

  let savedUrl = null;
  try { savedUrl = localStorage.getItem("rc_trip_cover"); } catch {}

  grid.innerHTML = COVER_PHOTOS.map(p => `
    <button class="td-photo-thumb${savedUrl === p.url ? " selected" : ""}"
            data-photo-url="${p.url}" title="${p.label}">
      <img src="${p.url.replace("w=900&h=400", "w=200&h=150")}" alt="${p.label}" loading="lazy">
      <span>${p.label}</span>
    </button>
  `).join("");

  grid.querySelectorAll(".td-photo-thumb").forEach(btn => {
    btn.addEventListener("click", () => {
      grid.querySelectorAll(".td-photo-thumb").forEach(b => b.classList.remove("selected"));
      btn.classList.add("selected");
      setTripCover(btn.dataset.photoUrl);
    });
  });

  const applyBtn = document.getElementById("td-custom-apply");
  const urlInput = document.getElementById("td-custom-url");
  const applyCustom = () => {
    const url = urlInput?.value.trim();
    if (!url) return;
    grid.querySelectorAll(".td-photo-thumb").forEach(b => b.classList.remove("selected"));
    setTripCover(url);
  };
  applyBtn?.addEventListener("click", applyCustom);
  urlInput?.addEventListener("keydown", e => { if (e.key === "Enter") applyCustom(); });
}

function wireTripCard() {
  const card = document.getElementById("my-trip-card");
  if (!card) return;

  // Open on click / keyboard
  card.addEventListener("click", e => {
    if (e.target.closest("a, button")) return;
    openTripDrawer();
  });
  card.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTripDrawer(); }
  });

  // Drawer controls
  document.getElementById("td-close-btn")?.addEventListener("click", closeTripDrawer);
  document.getElementById("trip-drawer-overlay")?.addEventListener("click", closeTripDrawer);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.getElementById("trip-drawer")?.classList.contains("open")) {
      closeTripDrawer();
    }
  });

  // Photo picker toggle
  document.getElementById("td-photo-btn")?.addEventListener("click", () => {
    const picker = document.getElementById("td-photo-picker");
    if (!picker) return;
    const open = picker.style.display !== "none" && picker.style.display !== "";
    if (open) {
      picker.style.display = "none";
    } else {
      picker.style.display = "block";
      initPhotoPicker();
      setTimeout(() => picker.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
    }
  });

  // Edit btn — close drawer so the form is visible
  document.getElementById("td-edit-btn")?.addEventListener("click", closeTripDrawer);

  // Share btn
  document.getElementById("td-share-btn")?.addEventListener("click", async () => {
    const trip = _currentTrip;
    if (!trip) return;
    const text = `My trip: ${trip.from || "?"} → ${trip.to || "?"} on RoamCircle 🏍️`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "My RoamCircle Trip", text });
      } else {
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById("td-share-btn");
        const orig = btn?.innerHTML;
        if (btn) {
          btn.textContent = "✓ Copied!";
          setTimeout(() => { if (orig) btn.innerHTML = orig; }, 2000);
        }
      }
    } catch {}
  });

  // Apply saved cover photo to card on init
  loadSavedCover();
}

// Fix #10 — handle events dispatched by realtime.js via CustomEvent
// This guarantees chat.js is fully initialised before any handler runs
function wireRealtimeEvents() {

  // New match request arrived — refresh real suggestions list
  document.addEventListener("rc:match_request", async () => {
    await loadAndRenderSuggestions();
  });

  // Mutual match confirmed — rebuild matches grid with fresh state
  document.addEventListener("rc:match_accepted", async e => {
    await loadMutualMatches();
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
          userName:    data.userName,
          displayName: data.displayName || data.userName,
          avatarUrl:   data.avatarUrl   || "",
          from:        data.from,
          to:          data.to,
          vehicle:     data.vehicle,
          startDate:   data.startDate,
          endDate:     data.endDate,
          bio:         data.bio         || "",
          lookingFor:  data.lookingFor  || "",
          pace:        data.pace        || "moderate",
          budget:      data.budget      || "mid",
          tripType:    data.tripType    || "motorcycle",
          habits:      data.habits      || "",
          meetpoints:  data.meetpoints  || "",
          coverUrl:    data.coverUrl    || "",
          score:       data.score       || 80,
          gender:      data.gender      || "unspecified"
        };
      }
    }

    syncNav(states);
    rebuildMatchesGrid(states);

    if (rid && canChatWith(rid)) openChat(rid);
  });

  // New message arrived in a thread
  document.addEventListener("rc:new_message", async e => {
    const event       = e.detail;
    const panelEl     = document.getElementById("chat-panel");
    const panelOpen   = panelEl?.classList.contains("open") ?? false;
    const isActive    = panelOpen && window._rcActiveThread === event.threadId;

    if (isActive) {
      const myId        = await getMyUserId();
      const requesterId = peerFromThread(event.threadId, myId);
      if (!requesterId) return;
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

// ── Traveler profile drawer controller ────────────────────────
async function openTravelerDrawer(id) {
  const isDemo = isDemoId(id);
  let traveler = null;

  if (isDemo) {
    traveler = getDemoData(id);
  } else {
    // If not in cache or missing bio, fetch safe public profile from backend
    if (!realUserCache[id] || realUserCache[id].bio === undefined) {
      const { ok, data } = await apiGet(`/api/users/${encodeURIComponent(id)}`);
      if (ok && data.userId) {
        realUserCache[id] = {
          userId:      data.userId,
          userName:    data.userName,
          displayName: data.displayName || data.userName,
          avatarUrl:   data.avatarUrl   || "",
          from:        data.from        || "",
          to:          data.to          || "",
          startDate:   data.startDate   || "",
          endDate:     data.endDate     || "",
          vehicle:     data.vehicle     || "",
          pace:        data.pace        || "moderate",
          budget:      data.budget      || "mid",
          tripType:    data.tripType    || "motorcycle",
          habits:      data.habits      || "",
          meetpoints:  data.meetpoints  || "",
          coverUrl:    data.coverUrl    || "",
          bio:         data.bio         || "",
          lookingFor:  data.lookingFor  || "",
          score:       data.score       || 80
        };
      }
    }
    traveler = realUserCache[id];
  }

  if (!traveler) return;

  const el = id => document.getElementById(id);
  const setT = (id, v) => { const e = el(id); if (e) e.textContent = v || "–"; };

  // Set header / title / cover
  setT("trd-hero-from", traveler.from || traveler.trip?.split(" → ")[0]);
  setT("trd-hero-to",   traveler.to   || traveler.trip?.split(" → ")[1]);

  const score = traveler.score || 80;
  const matchBadge = el("trd-match-badge");
  if (matchBadge) matchBadge.innerHTML = `<span class="status-dot"></span> ${score}% Match`;

  // Apply cover photo
  const coverEl = el("trd-cover");
  if (coverEl) {
    const coverUrl = traveler.cover || traveler.coverUrl || "https://images.unsplash.com/photo-1558981285-6f0c94958bb6?w=900&h=400&fit=crop";
    coverEl.style.backgroundImage = coverImageStyle(coverUrl);
    coverEl.style.backgroundSize = "cover";
    coverEl.style.backgroundPosition = "center";
  }

  // Set avatar & name
  const avatarImg = el("trd-avatar-img");
  const avatarFall = el("trd-avatar-fallback");
  const init = (traveler.displayName || traveler.userName || traveler.name || "?")[0].toUpperCase();

  if (avatarImg && avatarFall) {
    const url = traveler.face || traveler.avatarUrl;
    if (url) {
      avatarImg.src = url;
      avatarImg.style.display = "block";
      avatarFall.style.display = "none";
      avatarImg.onerror = () => {
        avatarImg.style.display = "none";
        avatarFall.style.display = "flex";
      };
    } else {
      avatarImg.style.display = "none";
      avatarFall.style.display = "flex";
      avatarFall.textContent = init;
    }
  }

  const displayName = traveler.displayName || traveler.userName || traveler.name;
  setT("trd-name", displayName);
  setT("trd-username", `@${(traveler.userName || traveler.name || "rider").toLowerCase().replace(/\s+/g, "")}`);

  const ratingWrap = el("trd-rating-wrap");
  if (ratingWrap) {
    ratingWrap.innerHTML = "";
    if (window.RC_ratings) {
      await RC_ratings.mountBadge(ratingWrap, id, displayName);
    }
  }

  // Duration in days
  let dayLabel = "–";
  const start = traveler.startDate || traveler.dates?.split("–")[0];
  const end = traveler.endDate || traveler.dates?.split("–")[1];
  if (start && end) {
    const ms = new Date(end) - new Date(start);
    if (!isNaN(ms) && ms >= 0) dayLabel = Math.round(ms / 86_400_000) + "d";
  }
  setT("trd-stat-days",   dayLabel);
  setT("trd-stat-pace",   traveler.pace ? traveler.pace.charAt(0).toUpperCase() + traveler.pace.slice(1) : "Moderate");
  setT("trd-stat-budget", traveler.budget ? traveler.budget.charAt(0).toUpperCase() + traveler.budget.slice(1) : "Mid");
  
  const shortType = { motorcycle: "Moto", roadtrip: "Road", cycling: "Cycle",
                       hiking: "Hike", backpacking: "Pack", train: "Train" };
  const typeVal = traveler.tripType || "motorcycle";
  setT("trd-stat-type", shortType[typeVal] || typeVal);

  // Bio and Looking for
  setT("trd-bio", traveler.bio || "No biography provided yet.");
  setT("trd-looking-for", traveler.lookingFor || "No partner preferences specified.");

  // Rows
  setT("trd-dates", start && end ? `${start} – ${end}` : traveler.dates || "–");
  
  const genderMap = { unspecified: "Prefer not to say", male: "Male", female: "Female", other: "Other / Non-binary" };
  setT("trd-gender", genderMap[traveler.gender] || traveler.gender || "Prefer not to say");

  setT("trd-vehicle", traveler.vehicle || "–");
  setT("trd-meetpoints", traveler.meetpoints || "–");

  // Habits Tags
  const habitsWrap = el("trd-habits");
  if (habitsWrap) {
    const habitsStr = traveler.habits || "";
    const tags = habitsStr.split(/[,\.]+/).map(h => h.trim()).filter(Boolean);
    if (tags.length) {
      habitsWrap.innerHTML = tags.map(h => `<div class="habit-tag">${esc(h)}</div>`).join("");
      el("trd-habits-section").style.display = "";
    } else {
      habitsWrap.innerHTML = "";
      el("trd-habits-section").style.display = "none";
    }
  }

  // Actions bar inside drawer
  const actionsWrap = el("trd-actions");
  if (actionsWrap) {
    // Check match status of this traveler
    const matchStates = cacheGet("rc_matches") || {};
    const status = matchStates[id];

    if (status === "accept") {
      if (canChatWith(id)) {
        actionsWrap.innerHTML = `
          <button class="button primary" id="trd-chat-btn">💬 Open chat</button>
        `;
        el("trd-chat-btn")?.addEventListener("click", () => {
          closeTravelerDrawer();
          openChat(id);
        });
      } else {
        actionsWrap.innerHTML = `
          <p style="color:#b3b3b3;font-size:0.9rem;text-align:center;width:100%">
            Request sent — waiting for them to accept you back
          </p>`;
      }
    } else if (status === "reject") {
      actionsWrap.innerHTML = `<p style="color:#727272;font-size:0.9rem;text-align:center;width:100%">You declined this rider.</p>`;
    } else {
      // Pending request/suggestion
      actionsWrap.innerHTML = `
        <button class="button compact accept" id="trd-accept-btn">Accept Request</button>
        <button class="button compact reject" id="trd-decline-btn">Decline</button>
      `;
      el("trd-accept-btn")?.addEventListener("click", async () => {
        closeTravelerDrawer();
        const actualCard = document.querySelector(`[data-request-card="${id}"]`);
        if (actualCard) {
          const btn = actualCard.querySelector("[data-request-action='accept']");
          if (btn) btn.click();
        } else {
          await saveMatchState(id, "accept");
          const updated = cacheGet("rc_matches") || {};
          syncNav(updated);
          rebuildMatchesGrid(updated);
          if (canChatWith(id)) openChat(id);
        }
      });
      el("trd-decline-btn")?.addEventListener("click", async () => {
        closeTravelerDrawer();
        const actualCard = document.querySelector(`[data-request-card="${id}"]`);
        if (actualCard) {
          const btn = actualCard.querySelector("[data-request-action='reject']");
          if (btn) btn.click();
        } else {
          await saveMatchState(id, "reject");
          const updated = cacheGet("rc_matches") || {};
          syncNav(updated);
          rebuildMatchesGrid(updated);
        }
      });
    }
  }

  // Open Drawer
  el("traveler-drawer-overlay")?.classList.add("open");
  el("traveler-drawer")?.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeTravelerDrawer() {
  document.getElementById("traveler-drawer-overlay")?.classList.remove("open");
  document.getElementById("traveler-drawer")?.classList.remove("open");
  document.body.style.overflow = "";
}

function wireTravelerDrawer() {
  document.getElementById("trd-close-btn")?.addEventListener("click", closeTravelerDrawer);
  document.getElementById("traveler-drawer-overlay")?.addEventListener("click", closeTravelerDrawer);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && document.getElementById("traveler-drawer")?.classList.contains("open")) {
      closeTravelerDrawer();
    }
  });
}
