/**
 * RoamCircle server.js — fully hardened
 *
 * Fixes:
 *  #1  All route handlers wrapped in try/catch around DB calls
 *  #2  ObjectId validation before use — never throws raw
 *  #3  Rate limiting on auth + token endpoints (in-memory)
 *  #4  /api/users/:id endpoint so realtime.js can hydrate realUserCache
 *  #6  toLower normalized on trip upsert (trim + lowercase)
 *  #8  /api/users/:id returns safe public profile for cache hydration
 *  #11 engines field added to package.json
 */

"use strict";
const http      = require("node:http");
const fs        = require("node:fs/promises");
const path      = require("node:path");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const cookieLib = require("cookie");
const { MongoClient, ObjectId } = require("mongodb");
const { WebSocketServer, WebSocket } = require("ws");

// ── Config ───────────────────────────────────────────────────
const PORT        = Number(process.env.PORT        || 3000);
const MONGODB_URI = process.env.MONGODB_URI        || "mongodb://127.0.0.1:27017";
const JWT_SECRET  = process.env.JWT_SECRET         || "roamcircle-dev-secret-change-in-prod";
const GEMINI_KEY  = process.env.GEMINI_API_KEY      || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL        || "gemini-2.0-flash";
const DB_NAME     = "roamcircle";
const PUBLIC_DIR  = __dirname;
const SALT_ROUNDS = 12;
const JWT_TTL     = "7d";
const WS_TTL      = "24h";
const WS_HEARTBEAT_MS = 30_000;

const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ORIGINS || `http://localhost:${PORT}`)
    .split(",").map(o => o.trim()).filter(Boolean)
);

const PROTECTED_PAGES = [
  "/dashboard.html", "/profile-arjun.html", "/profile-priya.html",
  "/profile-rohan.html", "/profile.html"
];

const DEMO_PREFIX = "demo_";
const BOT_PREFIX  = "bot_";

// ── Fix #3 — In-memory rate limiter ─────────────────────────
// Map<ip, { count, resetAt }>
const rateLimitStore = new Map();

function rateLimit(req, res, maxRequests, windowMs) {
  const ip  = req.headers["x-forwarded-for"]?.split(",")[0].trim()
             || req.socket.remoteAddress
             || "unknown";
  const key = `${ip}:${req.url}`;
  const now = Date.now();
  const rec = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > rec.resetAt) {
    rec.count   = 0;
    rec.resetAt = now + windowMs;
  }

  rec.count++;
  rateLimitStore.set(key, rec);

  // Prune old entries every 500 requests to prevent memory leak
  if (rateLimitStore.size > 5000) {
    for (const [k, v] of rateLimitStore) {
      if (now > v.resetAt) rateLimitStore.delete(k);
    }
  }

  if (rec.count > maxRequests) {
    sendJson(res, 429, {
      error: "Too many requests. Please wait and try again.",
      retryAfter: Math.ceil((rec.resetAt - now) / 1000)
    });
    return false; // blocked
  }
  return true; // allowed
}

// ── Fix #2 — Safe ObjectId helper ───────────────────────────
function toObjectId(str) {
  try {
    if (!str || typeof str !== "string" || str.length !== 24) return null;
    return new ObjectId(str);
  } catch { return null; }
}

// ── MongoDB ──────────────────────────────────────────────────
const mongo = new MongoClient(MONGODB_URI);
let db;

async function connectDB() {
  await mongo.connect();
  db = mongo.db(DB_NAME);
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("trips").createIndex({ userId: 1 });
  await db.collection("trips").createIndex({ toLower: 1 });
  await db.collection("trips").createIndex({ toLower: 1, isLive: 1 });
  await db.collection("matches").createIndex(
    { userId: 1, requesterId: 1 }, { unique: true }
  );
  await db.collection("matches").createIndex({ requesterId: 1, state: 1 });
  await db.collection("messages").createIndex({ threadId: 1, createdAt: 1 });
  await db.collection("reviews").createIndex({ reviewedUserId: 1, createdAt: -1 });
  await db.collection("reviews").createIndex(
    { reviewedUserId: 1, reviewerId: 1 }, { unique: true }
  );
  console.log(`[db] MongoDB → ${MONGODB_URI}/${DB_NAME}`);
}

async function getRatingSummary(reviewedUserId) {
  const rows = await db.collection("reviews")
    .find({ reviewedUserId })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  if (!rows.length) {
    return { average: null, count: 0, reviews: [] };
  }

  const sum = rows.reduce((n, r) => n + (Number(r.rating) || 0), 0);
  const average = Math.round((sum / rows.length) * 10) / 10;

  return {
    average,
    count: rows.length,
    reviews: rows.map(r => ({
      reviewerId:   r.reviewerId,
      reviewerName: r.reviewerName,
      rating:       r.rating,
      comment:      r.comment,
      createdAt:    r.createdAt
    }))
  };
}

// ── MIME ─────────────────────────────────────────────────────
const MIME = {
  ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8",
  ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8",
  ".png":"image/png", ".jpg":"image/jpeg", ".jpeg":"image/jpeg", ".svg":"image/svg+xml"
};

// ── HTTP helpers ─────────────────────────────────────────────
function setCORS(res, req) {
  const o      = req?.headers?.origin || "";
  const origin = ALLOWED_ORIGINS.has(o) ? o : [...ALLOWED_ORIGINS][0];
  res.setHeader("Access-Control-Allow-Origin",      origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods",     "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers",     "Content-Type");
  res.setHeader("Vary",                             "Origin");
}

function sendJson(res, status, payload, req) {
  setCORS(res, req);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendRedirect(res, loc) {
  res.writeHead(302, { Location: loc });
  res.end();
}

function readBody(req, maxBytes = 500_000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => {
      raw += c;
      if (raw.length > maxBytes) { reject(new Error("Body too large.")); req.destroy(); }
    });
    req.on("end",   () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Invalid JSON body.")); }
    });
    req.on("error", reject);
  });
}

// ── Fix #1 — Generic DB error wrapper ───────────────────────
// Wraps any route handler, catches DB/unexpected errors and returns 500
function dbRoute(handler) {
  return async (req, res, ...args) => {
    try {
      await handler(req, res, ...args);
    } catch(e) {
      console.error(`[route error] ${req.method} ${req.url}:`, e.message);
      if (!res.headersSent) {
        sendJson(res, 500, { error: "An unexpected server error occurred." }, req);
      }
    }
  };
}

// ── Auth helpers ─────────────────────────────────────────────
function getUser(req) {
  try {
    const token = cookieLib.parse(req.headers.cookie || "").rc_token;
    return token ? jwt.verify(token, JWT_SECRET) : null;
  } catch { return null; }
}

function requireUser(req, res) {
  const u = getUser(req);
  if (!u) {
    sendJson(res, 401, { error: "Login required.", redirect: "/login.html" }, req);
    return null;
  }
  return u;
}

function makeAuthCookie(token) {
  return cookieLib.serialize("rc_token", token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 7,
    path:     "/",
    secure:   process.env.NODE_ENV === "production"
  });
}

function clearAuthCookie() {
  return cookieLib.serialize("rc_token", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge:   0,
    path:     "/",
    secure:   process.env.NODE_ENV === "production"
  });
}

// Thread IDs are "{idA}_{idB}" (sorted). Demo IDs contain underscores (e.g. demo_arjun),
// so we must not split on the first "_" only.
function validateThreadOwnership(threadId, userId) {
  if (!threadId || !userId) return false;
  return threadId.startsWith(`${userId}_`) || threadId.endsWith(`_${userId}`);
}

function peerFromThread(threadId, userId) {
  if (!threadId || !userId) return null;
  if (threadId.startsWith(`${userId}_`)) return threadId.slice(userId.length + 1);
  if (threadId.endsWith(`_${userId}`)) return threadId.slice(0, threadId.length - userId.length - 1);
  return null;
}

// ── Fix #6 — Normalize destination string ───────────────────
function normalizeDestination(raw) {
  return String(raw || "").trim().toLowerCase()
    .replace(/\s+/g, " "); // collapse multiple spaces
}

// Extract all significant words from a destination for partial matching
// "Leh Ladakh" → ["leh", "ladakh"]
// "Ladakh"     → ["ladakh"]
function destinationWords(normalized) {
  const stop = new Set(["to","in","via","and","the","of","a","an"]);
  return normalized.split(" ").filter(w => w.length > 2 && !stop.has(w));
}

// Check if two normalized destinations share at least one significant word
function destinationsOverlap(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;                         // exact match
  const wa = new Set(destinationWords(a));
  const wb = destinationWords(b);
  return wb.some(w => wa.has(w));                   // any shared word
}

// ════════════════════════════════════════════════════════════
// WEBSOCKET
// ════════════════════════════════════════════════════════════

const connections = new Map();

function wsRegister(userId, ws) {
  if (!connections.has(userId)) connections.set(userId, new Set());
  connections.get(userId).add(ws);
}

function wsUnregister(userId, ws) {
  const set = connections.get(userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) connections.delete(userId);
}

function push(userId, event) {
  const set = connections.get(userId);
  if (!set) return;
  const payload = JSON.stringify(event);
  for (const ws of set) {
    if (ws.readyState === WebSocket.OPEN) ws.send(payload);
  }
}

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    const url   = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token") || "";
    let user;
    try { user = jwt.verify(token, JWT_SECRET); }
    catch { ws.close(4001, "Unauthorized"); return; }

    ws.userId  = user.userId;
    ws.isAlive = true;
    wsRegister(user.userId, ws);
    ws.send(JSON.stringify({ type: "connected", userId: user.userId, name: user.name }));
    console.log(`[ws] + ${user.name} (online: ${connections.size})`);

    ws.on("pong", () => { ws.isAlive = true; });
    ws.on("message", raw => {
      try { if (JSON.parse(raw).type === "ping") ws.send(JSON.stringify({ type: "pong" })); }
      catch {}
    });
    ws.on("close", () => {
      wsUnregister(user.userId, ws);
      console.log(`[ws] - ${user.name} (online: ${connections.size})`);
    });
    ws.on("error", err => {
      console.error("[ws] socket error:", err.message);
      wsUnregister(user.userId, ws);
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach(ws => {
      if (!ws.isAlive) { wsUnregister(ws.userId, ws); return ws.terminate(); }
      ws.isAlive = false;
      ws.ping();
    });
  }, WS_HEARTBEAT_MS);

  wss.on("close", () => clearInterval(heartbeat));
  console.log(`[ws] ready at ws://localhost:${PORT}/ws`);
}

// ════════════════════════════════════════════════════════════
// AUTH  (Fix #1 via dbRoute wrapper, Fix #3 rate limiting)
// ════════════════════════════════════════════════════════════

const handleSignup = dbRoute(async (req, res) => {
  // Fix #3 — 5 signups per IP per 15 minutes
  if (!rateLimit(req, res, 5, 15 * 60_000)) return;

  const body     = await readBody(req);
  const name     = String(body.name     || "").trim();
  const email    = String(body.email    || "").trim().toLowerCase();
  const password = String(body.password || "");
  const tripType = String(body.tripType || "motorcycle");
  const gender   = ["unspecified", "male", "female", "other"].includes(body.gender) ? body.gender : "unspecified";

  if (!name)                          return sendJson(res, 400, { error: "Name is required." }, req);
  if (!email || !email.includes("@")) return sendJson(res, 400, { error: "Valid email is required." }, req);
  if (password.length < 8)            return sendJson(res, 400, { error: "Password must be at least 8 characters." }, req);

  const hash   = await bcrypt.hash(password, SALT_ROUNDS);
  const result = await db.collection("users").insertOne({
    name, email, password: hash, tripType, gender, createdAt: new Date()
  }).catch(e => {
    if (e.code === 11000) throw Object.assign(new Error("duplicate"), { isDuplicate: true });
    throw e;
  });

  const token = jwt.sign(
    { userId: result.insertedId.toString(), name, email, tripType },
    JWT_SECRET, { expiresIn: JWT_TTL }
  );
  setCORS(res, req);
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie":   makeAuthCookie(token)
  });
  res.end(JSON.stringify({ ok: true, name, email, token }));
});

// Override dbRoute for signup to handle duplicate key gracefully
const _handleSignup = handleSignup;
async function wrappedSignup(req, res) {
  try { await _handleSignup(req, res); }
  catch(e) {
    if (e.isDuplicate || e.code === 11000)
      return sendJson(res, 409, { error: "An account with this email already exists." }, req);
    console.error("[signup]", e.message);
    sendJson(res, 500, { error: "Could not create account." }, req);
  }
}

const handleLogin = dbRoute(async (req, res) => {
  // Fix #3 — 10 login attempts per IP per 15 minutes
  if (!rateLimit(req, res, 10, 15 * 60_000)) return;

  const body     = await readBody(req);
  const email    = String(body.email    || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!email || !password)
    return sendJson(res, 400, { error: "Email and password are required." }, req);

  const user = await db.collection("users").findOne({ email });
  if (!user || !(await bcrypt.compare(password, user.password)))
    return sendJson(res, 401, { error: "Incorrect email or password." }, req);

  const token = jwt.sign(
    { userId: user._id.toString(), name: user.name, email: user.email, tripType: user.tripType },
    JWT_SECRET, { expiresIn: JWT_TTL }
  );
  setCORS(res, req);
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie":   makeAuthCookie(token)
  });
  res.end(JSON.stringify({ ok: true, name: user.name, email: user.email, token }));
});

function handleLogout(req, res) {
  setCORS(res, req);
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie":   clearAuthCookie()
  });
  res.end(JSON.stringify({ ok: true }));
}

function handleMe(req, res) {
  const user = getUser(req);
  if (!user)
    return sendJson(res, 401, { error: "Not authenticated.", redirect: "/login.html" }, req);
  sendJson(res, 200,
    { userId: user.userId, name: user.name, email: user.email, tripType: user.tripType }, req
  );
}

const handleAuthToken = dbRoute(async (req, res) => {
  // Fix #3 — 30 token refreshes per IP per hour
  if (!rateLimit(req, res, 30, 60 * 60_000)) return;

  const user = getUser(req);
  if (!user) return sendJson(res, 401, { error: "Not authenticated." }, req);

  const token = jwt.sign(
    { userId: user.userId, name: user.name, email: user.email, tripType: user.tripType },
    JWT_SECRET, { expiresIn: WS_TTL }
  );
  sendJson(res, 200, { token }, req);
});

// ════════════════════════════════════════════════════════════
// USERS  (Fix #4 + #8 — public profile endpoint)
// ════════════════════════════════════════════════════════════

// GET /api/users/:userId — public profile for realUserCache hydration
// Returns only safe fields — never password, email, or private data
const handleUserGet = dbRoute(async (req, res, userId) => {
  const caller = requireUser(req, res); if (!caller) return;

  // Fix #2 — validate ObjectId before use
  const oid = toObjectId(userId);
  if (!oid) return sendJson(res, 400, { error: "Invalid user ID." }, req);

  const user = await db.collection("users").findOne(
    { _id: oid },
    { projection: { name: 1, displayName: 1, avatarUrl: 1, bio: 1, lookingFor: 1, tripType: 1, createdAt: 1, gender: 1 } }
  );

  if (!user) return sendJson(res, 404, { error: "User not found." }, req);

  // Also fetch their trip for route info
  const trip = await db.collection("trips").findOne(
    { userId: userId, isLive: true },
    { projection: { from: 1, to: 1, startDate: 1, endDate: 1, vehicle: 1, pace: 1, tripType: 1, meetpoints: 1, habits: 1, budget: 1, coverUrl: 1, genderPreference: 1 } }
  );

  // Enforce mutual gender matching preferences for other users
  if (caller.userId !== userId) {
    const callerAccepted = await db.collection("matches").findOne({
      userId: caller.userId, requesterId: userId, state: "accept"
    });
    const theyAccepted = await db.collection("matches").findOne({
      userId: userId, requesterId: caller.userId, state: "accept"
    });

    if (!callerAccepted && !theyAccepted) {
      const myUser   = await db.collection("users").findOne({ _id: toObjectId(caller.userId) });
      const myGender = myUser?.gender || "unspecified";

      const myTrip = await db.collection("trips").findOne({ userId: caller.userId });
      const myPref = myTrip?.genderPreference || "any";

      const theirGender = user.gender || "unspecified";
      const theirPref   = trip?.genderPreference || "any";

      // Enforce mutual gender matching preferences
      const isForbidden =
        (myPref === "male" && theirGender !== "male") ||
        (myPref === "female" && theirGender !== "female") ||
        (myPref === "same" && (myGender === "unspecified" || myGender !== theirGender)) ||
        (theirPref === "male" && myGender !== "male") ||
        (theirPref === "female" && myGender !== "female") ||
        (theirPref === "same" && (theirGender === "unspecified" || theirGender !== myGender));

      if (isForbidden) {
        return sendJson(res, 403, { error: "Access denied due to gender preferences." }, req);
      }
    }
  }

  const { average: ratingAverage, count: ratingCount } = await getRatingSummary(userId);

  sendJson(res, 200, {
    userId:     userId,
    userName:   user.name,
    displayName: user.displayName || user.name,
    avatarUrl:  user.avatarUrl   || "",
    bio:        user.bio         || "",
    lookingFor: user.lookingFor  || "",
    tripType:   user.tripType,
    gender:     user.gender      || "unspecified",
    from:       trip?.from       || "",
    to:         trip?.to         || "",
    startDate:  trip?.startDate  || "",
    endDate:    trip?.endDate    || "",
    vehicle:    trip?.vehicle    || "",
    pace:       trip?.pace       || "",
    meetpoints: trip?.meetpoints || "",
    habits:     trip?.habits     || "",
    budget:     trip?.budget     || "",
    coverUrl:   trip?.coverUrl   || "",
    ratingAverage,
    ratingCount
  }, req);
});

// GET /api/users/:userId/reviews — public rating summary + comments
const handleUserReviewsGet = dbRoute(async (req, res, userId) => {
  const caller = requireUser(req, res); if (!caller) return;

  if (userId.startsWith(DEMO_PREFIX)) {
    return sendJson(res, 400, { error: "Demo profiles use client-side reviews." }, req);
  }

  const oid = toObjectId(userId);
  if (!oid) return sendJson(res, 400, { error: "Invalid user ID." }, req);

  const user = await db.collection("users").findOne({ _id: oid }, { projection: { _id: 1 } });
  if (!user) return sendJson(res, 404, { error: "User not found." }, req);

  sendJson(res, 200, await getRatingSummary(userId), req);
});

// POST /api/users/:userId/reviews — leave a review (mutual match required)
const handleUserReviewPost = dbRoute(async (req, res, userId) => {
  const caller = requireUser(req, res); if (!caller) return;
  if (!rateLimit(req, res, 10, 60 * 60_000)) return;

  if (userId.startsWith(DEMO_PREFIX)) {
    return sendJson(res, 400, { error: "Cannot review demo profiles." }, req);
  }
  if (caller.userId === userId) {
    return sendJson(res, 400, { error: "You cannot review yourself." }, req);
  }

  const oid = toObjectId(userId);
  if (!oid) return sendJson(res, 400, { error: "Invalid user ID." }, req);

  const theyAccepted = await db.collection("matches").findOne({
    userId, requesterId: caller.userId, state: "accept"
  });
  const iAccepted = await db.collection("matches").findOne({
    userId: caller.userId, requesterId: userId, state: "accept"
  });
  if (!theyAccepted || !iAccepted) {
    return sendJson(res, 403, { error: "You can only review riders you mutually matched with." }, req);
  }

  const body    = await readBody(req);
  const rating  = Number(body.rating);
  const comment = String(body.comment || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return sendJson(res, 400, { error: "Rating must be an integer from 1 to 5." }, req);
  }
  if (comment.length < 10) {
    return sendJson(res, 400, { error: "Comment must be at least 10 characters." }, req);
  }
  if (comment.length > 500) {
    return sendJson(res, 400, { error: "Comment must be under 500 characters." }, req);
  }

  const doc = {
    reviewedUserId: userId,
    reviewerId:     caller.userId,
    reviewerName:   caller.name,
    rating,
    comment,
    createdAt:      new Date()
  };

  try {
    await db.collection("reviews").insertOne(doc);
  } catch (e) {
    if (e.code === 11000) {
      return sendJson(res, 409, { error: "You already reviewed this rider." }, req);
    }
    throw e;
  }

  sendJson(res, 201, { ok: true, ...(await getRatingSummary(userId)) }, req);
});

// ════════════════════════════════════════════════════════════
// TRIPS  (Fix #1 + #6)
// ════════════════════════════════════════════════════════════

const handleTripPost = dbRoute(async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const body = await readBody(req);

  const destination = String(body.destination || "").trim();
  if (!destination) return sendJson(res, 400, { error: "Destination is required." }, req);

  const tripDoc = {
    userId:     user.userId,
    userName:   user.name,
    from:       String(body.source      || "").trim(),
    to:         destination,
    toLower:    normalizeDestination(destination),  // Fix #6
    startDate:  String(body.startDate   || "").trim(),
    endDate:    String(body.endDate     || "").trim(),
    tripType:   String(body.tripType    || "motorcycle"),
    vehicle:    String(body.vehicle     || "").trim(),
    pace:       String(body.pace        || "moderate"),
    budget:     String(body.budget      || "mid"),
    habits:     String(body.habits      || "").trim(),
    meetpoints: String(body.meetpoints  || "").trim(),
    coverUrl:   String(body.coverUrl    || "").trim(),
    genderPreference: ["any", "same", "male", "female"].includes(body.genderPreference) ? body.genderPreference : "any",
    updatedAt:  new Date(),
    isLive:     true
  };

  await db.collection("trips").updateOne(
    { userId: user.userId },
    { $set: tripDoc, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  sendJson(res, 200, { ok: true, trip: tripDoc }, req);
});

// Fix #1 — wrapped in dbRoute
const handleTripGet = dbRoute(async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const trip = await db.collection("trips").findOne({ userId: user.userId });
  sendJson(res, 200, { trip: trip || null }, req);
});

// ════════════════════════════════════════════════════════════
// MATCHES  (Fix #1 + #2)
// ════════════════════════════════════════════════════════════

// Fix #1 — wrapped in dbRoute
const handleMatchesGet = dbRoute(async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const rows = await db.collection("matches").find({ userId: user.userId }).toArray();
  const map  = {};
  rows.forEach(m => { map[m.requesterId] = m.state; });
  sendJson(res, 200, { matches: map }, req);
});

const handleMatchPost = dbRoute(async (req, res, requesterId) => {
  const user = requireUser(req, res); if (!user) return;
  const body  = await readBody(req);
  const state = String(body.action || "").trim();

  if (!["accept","reject"].includes(state))
    return sendJson(res, 400, { error: "action must be 'accept' or 'reject'." }, req);

  const requesterType = requesterId.startsWith(DEMO_PREFIX) ? "demo" : "user";

  await db.collection("matches").updateOne(
    { userId: user.userId, requesterId },
    {
      $set: { state, requesterType, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );

  if (state === "accept" && !requesterId.startsWith(DEMO_PREFIX)) {
    const theyAccepted = await db.collection("matches").findOne({
      userId: requesterId, requesterId: user.userId, state: "accept"
    });

    if (theyAccepted) {
      // Fix #2 — safe ObjectId conversion
      const oid       = toObjectId(requesterId);
      const otherUser = oid
        ? await db.collection("users").findOne({ _id: oid }, { projection: { name: 1 } })
        : null;
      const otherName = otherUser?.name || "Your match";

      push(user.userId,   { type: "match_accepted", from: requesterId,   fromName: otherName,  requesterId });
      push(requesterId,   { type: "match_accepted", from: user.userId,   fromName: user.name,  requesterId: user.userId });
    } else {
      push(requesterId, {
        type: "match_request", from: user.userId, fromName: user.name, requesterId: user.userId
      });
    }
  }

  sendJson(res, 200, { ok: true, requesterId, state }, req);
});

// ════════════════════════════════════════════════════════════
// MESSAGES  (Fix #1)
// ════════════════════════════════════════════════════════════

const handleMessagesGet = dbRoute(async (req, res, threadId) => {
  const user = requireUser(req, res); if (!user) return;
  if (!validateThreadOwnership(threadId, user.userId))
    return sendJson(res, 403, { error: "Access denied." }, req);

  // Pagination: ?limit=N (default 50, max 200) + ?before=<ISO timestamp>
  const url    = new URL(req.url, `http://${req.headers.host}`);
  const limit  = Math.min(Math.max(Number(url.searchParams.get("limit") || 50), 1), 200);
  const before = url.searchParams.get("before");

  const filter = { threadId };
  if (before) {
    const ts = new Date(before);
    if (!isNaN(ts)) filter.createdAt = { $lt: ts };
  }

  const messages = await db.collection("messages")
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  // Return in ascending order so the client sees oldest-first
  messages.reverse();

  sendJson(res, 200, { messages, hasMore: messages.length === limit }, req);
});

const handleMessagePost = dbRoute(async (req, res, threadId) => {
  const user = requireUser(req, res); if (!user) return;
  if (!validateThreadOwnership(threadId, user.userId))
    return sendJson(res, 403, { error: "Access denied." }, req);

  const body      = await readBody(req);
  const text      = String(body.text || "").trim();
  const type      = String(body.type || "text");
  const meta      = (typeof body.meta === "object" && body.meta !== null) ? body.meta : {};
  const rawSender = body.botSender
    ? `${BOT_PREFIX}${String(body.botSender).replace(/^bot_/, "")}`
    : null;
  const from      = rawSender || user.userId;
  const fromName  = rawSender ? String(body.botName || "Traveler").trim() : user.name;

  if (type === "text" && !text)
    return sendJson(res, 400, { error: "Message text is required." }, req);

  const msg    = { threadId, from, fromName, text, type, meta, createdAt: new Date() };
  const result = await db.collection("messages").insertOne(msg);

  // Push notification to the other participant (real users only)
  let notifyUserId = null;
  if (from.startsWith(BOT_PREFIX)) {
    notifyUserId = user.userId;
  } else {
    notifyUserId = peerFromThread(threadId, from);
    if (notifyUserId?.startsWith(DEMO_PREFIX) || notifyUserId?.startsWith(BOT_PREFIX)) {
      notifyUserId = null;
    }
  }
  if (notifyUserId && notifyUserId !== from) {
    push(notifyUserId, {
      type: "new_message", threadId, from, fromName,
      text: type === "text" ? text : `[${type}]`,
      msgType: type, meta, ts: msg.createdAt.toISOString()
    });
  }

  sendJson(res, 201, { ok: true, message: { ...msg, _id: result.insertedId } }, req);
});

// ════════════════════════════════════════════════════════════
// MATCHING  (Fix #1 + #5 destination normalization)
// ════════════════════════════════════════════════════════════

const PACE_RANK   = { relaxed: 0, moderate: 1, fast: 2 };
const BUDGET_RANK = { budget: 0, mid: 1, comfort: 2 };

function extractHabitWords(habits) {
  const stop = new Set(["and","the","a","i","to","in","with","for","is","am","are","im","its","of","on","at"]);
  return new Set(
    habits.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/)
      .filter(w => w.length > 2 && !stop.has(w))
  );
}

function scoreCompatibility(myTrip, theirTrip) {
  let score = 0;
  try {
    const ms = new Date(myTrip.startDate), me = new Date(myTrip.endDate);
    const ts = new Date(theirTrip.startDate), te = new Date(theirTrip.endDate);
    if (!isNaN(ms) && !isNaN(me) && !isNaN(ts) && !isNaN(te)) {
      const overlapMs   = Math.min(me,te) - Math.max(ms,ts);
      const overlapDays = overlapMs / 86_400_000;

      if (overlapDays >= 0) {
        // Dates overlap — score proportionally (max 30 pts)
        score += Math.min(30, Math.round((overlapDays / Math.max(1,(me-ms)/86_400_000)) * 30));
      } else {
        // Dates don't overlap — give partial credit based on proximity
        // Within 3 days gap  → 15 pts (easily adjustable, great meet-up candidates)
        // Within 7 days gap  → 8 pts  (worth showing, can plan early/late arrival)
        // Within 14 days gap → 3 pts  (stretch, but still show them)
        // Beyond 14 days     → 0 pts
        const gapDays = Math.abs(overlapDays);
        if      (gapDays <= 3)  score += 15;
        else if (gapDays <= 7)  score += 8;
        else if (gapDays <= 14) score += 3;
        // else 0 — too far apart
      }
    }
  } catch {}
  const pd = Math.abs((PACE_RANK[myTrip.pace]??1)   - (PACE_RANK[theirTrip.pace]??1));
  score += pd===0 ? 25 : pd===1 ? 12 : 0;
  const bd = Math.abs((BUDGET_RANK[myTrip.budget]??1) - (BUDGET_RANK[theirTrip.budget]??1));
  score += bd===0 ? 25 : bd===1 ? 12 : 0;
  // Habits overlap — 0-15 pts
  // Only score if both users have filled in habits — no free bonus for empty fields
  const myW = extractHabitWords(myTrip.habits||""), thW = extractHabitWords(theirTrip.habits||"");
  if (myW.size > 0 && thW.size > 0) {
    const shared = [...myW].filter(w=>thW.has(w)).length;
    score += Math.round((shared / new Set([...myW,...thW]).size) * 15);
  }

  // lookingFor compatibility — 0-5 pts
  // If their habits match what I'm looking for, or vice versa — bonus
  const myLooking  = extractHabitWords(myTrip.lookingFor  || "");
  const theirHabits= extractHabitWords(theirTrip.habits   || "");
  const thLooking  = extractHabitWords(theirTrip.lookingFor|| "");
  const myHabits   = extractHabitWords(myTrip.habits      || "");

  let lfScore = 0;
  if (myLooking.size > 0 && theirHabits.size > 0) {
    const match = [...myLooking].filter(w => theirHabits.has(w)).length;
    lfScore += Math.round((match / myLooking.size) * 3);
  }
  if (thLooking.size > 0 && myHabits.size > 0) {
    const match = [...thLooking].filter(w => myHabits.has(w)).length;
    lfScore += Math.round((match / thLooking.size) * 2);
  }
  score += Math.min(5, lfScore);

  return Math.min(100, score);
}

// Fix #1 — all wrapped in dbRoute
const handleMatchSuggestions = dbRoute(async (req, res) => {
  const user = requireUser(req, res); if (!user) return;

  const myUser   = await db.collection("users").findOne({ _id: toObjectId(user.userId) });
  const myGender = myUser?.gender || "unspecified";

  const myTrip = await db.collection("trips").findOne({ userId: user.userId });
  if (!myTrip?.toLower)
    return sendJson(res, 200, { suggestions: [], reason: "Publish your trip first." }, req);

  const myPref = myTrip.genderPreference || "any";

  const myMatches  = await db.collection("matches").find({ userId: user.userId }).toArray();
  const decidedIds = new Set(myMatches.map(m => m.requesterId));

  // Step 1: exact destination match
  const exactCandidates = await db.collection("trips").find({
    toLower: myTrip.toLower, isLive: true, userId: { $ne: user.userId }
  }).limit(100).toArray();

  // Step 2: fuzzy destination match — find trips sharing at least one
  // significant word with the user's destination (e.g. "Ladakh" matches "Leh Ladakh")
  const myWords    = destinationWords(myTrip.toLower);
  let allCandidates = exactCandidates;

  if (myWords.length > 0) {
    // Build regex: any trip whose toLower contains any of my destination words
    const wordPattern = myWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const fuzzyRegex  = new RegExp(wordPattern, "i");

    const fuzzyCandidates = await db.collection("trips").find({
      toLower: { $regex: fuzzyRegex },
      isLive:  true,
      userId:  { $ne: user.userId }
    }).limit(100).toArray();

    // Merge — deduplicate by userId
    const seen = new Set(exactCandidates.map(t => t.userId));
    for (const t of fuzzyCandidates) {
      if (!seen.has(t.userId)) {
        allCandidates.push(t);
        seen.add(t.userId);
      }
    }
  }

  const candidateList = allCandidates.filter(t => !decidedIds.has(t.userId));

  const enrichedSuggestions = (await Promise.all(
    candidateList.map(async t => {
      const uDoc = await db.collection("users").findOne(
        { _id: toObjectId(t.userId) },
        { projection: { displayName: 1, avatarUrl: 1, bio: 1, lookingFor: 1, gender: 1 } }
      ).catch(() => null);

      const theirGender = uDoc?.gender || "unspecified";
      const theirPref   = t.genderPreference || "any";

      // Enforce mutual gender matching preferences
      if (myPref === "male" && theirGender !== "male") return null;
      if (myPref === "female" && theirGender !== "female") return null;
      if (myPref === "same" && (myGender === "unspecified" || myGender !== theirGender)) return null;

      if (theirPref === "male" && myGender !== "male") return null;
      if (theirPref === "female" && myGender !== "female") return null;
      if (theirPref === "same" && (theirGender === "unspecified" || theirGender !== myGender)) return null;

      return {
        userId:      t.userId,
        userName:    t.userName,
        displayName: uDoc?.displayName || t.userName,
        avatarUrl:   uDoc?.avatarUrl   || "",
        bio:         uDoc?.bio         || "",
        lookingFor:  uDoc?.lookingFor  || "",
        gender:      theirGender,
        from:        t.from,
        to:          t.to,
        startDate:   t.startDate,
        endDate:     t.endDate,
        tripType:    t.tripType,
        vehicle:     t.vehicle,
        pace:        t.pace,
        budget:      t.budget,
        habits:      t.habits,
        meetpoints:  t.meetpoints,
        coverUrl:    t.coverUrl        || "",
        score:       scoreCompatibility(myTrip, t),
        destinationMatch: t.toLower === myTrip.toLower ? "exact" : "nearby"
      };
    })
  )).filter(Boolean);

  const suggestions = enrichedSuggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  sendJson(res, 200, { suggestions, myTrip }, req);
});

const handleTripSearch = dbRoute(async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const url  = new URL(req.url, `http://${req.headers.host}`);
  // Fix #6 — normalize search term same way as stored
  const to   = normalizeDestination(url.searchParams.get("to") || "");
  if (!to) return sendJson(res, 400, { error: "'to' query param required." }, req);

  const myUser   = await db.collection("users").findOne({ _id: toObjectId(user.userId) });
  const myGender = myUser?.gender || "unspecified";
  const myTrip   = await db.collection("trips").findOne({ userId: user.userId });
  const myPref   = myTrip?.genderPreference || "any";

  const trips = await db.collection("trips").find({
    toLower: to, isLive: true, userId: { $ne: user.userId }
  }).limit(100).toArray();

  const filteredTrips = (await Promise.all(
    trips.map(async t => {
      const uDoc = await db.collection("users").findOne(
        { _id: toObjectId(t.userId) },
        { projection: { gender: 1 } }
      ).catch(() => null);

      const theirGender = uDoc?.gender || "unspecified";
      const theirPref   = t.genderPreference || "any";

      // Enforce mutual gender matching preferences
      if (myPref === "male" && theirGender !== "male") return null;
      if (myPref === "female" && theirGender !== "female") return null;
      if (myPref === "same" && (myGender === "unspecified" || myGender !== theirGender)) return null;

      if (theirPref === "male" && myGender !== "male") return null;
      if (theirPref === "female" && myGender !== "female") return null;
      if (theirPref === "same" && (theirGender === "unspecified" || theirGender !== myGender)) return null;

      return t;
    })
  )).filter(Boolean);

  sendJson(res, 200, { trips: filteredTrips }, req);
});

const handleMutualMatches = dbRoute(async (req, res) => {
  const user = requireUser(req, res); if (!user) return;

  const iAccepted = await db.collection("matches")
    .find({ userId: user.userId, state: "accept" })
    .toArray();

  if (!iAccepted.length) return sendJson(res, 200, { mutual: [] }, req);

  const demoAccepted = iAccepted.filter(m =>  m.requesterId.startsWith(DEMO_PREFIX));
  const realAccepted = iAccepted.filter(m => !m.requesterId.startsWith(DEMO_PREFIX));
  const realIds      = realAccepted.map(m => m.requesterId);

  const theyAccepted = realIds.length
    ? await db.collection("matches").find({
        userId: { $in: realIds }, requesterId: user.userId, state: "accept"
      }).toArray()
    : [];

  const mutualRealIds = new Set(theyAccepted.map(m => m.userId));

  const mutual = [
    ...demoAccepted.map(m => ({ requesterId: m.requesterId, type: "demo" })),
    ...realAccepted
        .filter(m => mutualRealIds.has(m.requesterId))
        .map(m => ({ requesterId: m.requesterId, type: "user" }))
  ];

  sendJson(res, 200, { mutual }, req);
});

// ════════════════════════════════════════════════════════════
// AI ITINERARY
// ════════════════════════════════════════════════════════════

function itinerarySchema() {
  return {
    type: "object", additionalProperties: false,
    properties: {
      title:          { type: "string" },
      summary:        { type: "string" },
      insiderTip:     { type: "string" },
      days: {
        type: "array", minItems: 1, maxItems: 14,
        items: {
          type: "object", additionalProperties: false,
          properties: {
            day:            { type: "integer" },
            title:          { type: "string" },
            from:           { type: "string" },
            to:             { type: "string" },
            distance:       { type: "string" },
            rideCondition:  { type: "string" },
            fuelStop:       { type: "string" },
            sleepAt:        { type: "string" },
            sleepType:      { type: "string" },
            hiddenGem:      { type: "string" },
            watchOut:       { type: "string" },
            localFood:      { type: "string" },
            permits:        { type: "string" },
            altRoute:       { type: "string" }
          },
          required: [
            "day","title","from","to","distance",
            "rideCondition","fuelStop","sleepAt","sleepType",
            "hiddenGem","watchOut","localFood"
          ]
        }
      }
    },
    required: ["title","summary","insiderTip","days"]
  };
}

const handleItinerary = dbRoute(async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  if (!GEMINI_KEY) return sendJson(res, 500, { error: "GEMINI_API_KEY not configured." }, req);

  const body    = await readBody(req);
  const from    = String(body.source      || "").trim();
  const to      = String(body.destination || "").trim();
  const days    = Math.min(Math.max(Number(body.days || 5), 1), 7);
  const budget  = String(body.budget      || "mid");
  const vehicle = String(body.vehicle     || "");
  const habits  = String(body.habits      || "");
  const type    = String(body.tripType    || "motorcycle");

  if (!to) return sendJson(res, 400, { error: "Destination is required." }, req);

  const prompt = `You are an experienced ${type} traveler who has done the ${from ? from + " to " + to : to} route multiple times. Generate an insider route plan that feels like advice from a local rider — NOT a generic travel blog.

Route: ${from ? from + " → " + to : to}
Duration: ${days} days
Budget: ${budget}
Trip type: ${type}
${vehicle ? "Vehicle: " + vehicle : ""}
${habits ? "Rider habits: " + habits : ""}

For each day provide:
- from/to: exact town names, not vague regions
- distance: realistic km estimate for this vehicle and pace
- rideCondition: actual road surface, traffic, altitude, seasonal hazards — be specific
- fuelStop: name of the best/last reliable petrol pump before remote sections — critical info
- sleepAt: specific guesthouse name or area known to riders, with reason why (e.g. "Hotel Snowland Keylong — popular with bikers, has secure parking, owner speaks English")
- sleepType: "camping" / "guesthouse" / "dhaba-stay" / "homestay" / "hotel"
- hiddenGem: one thing most tourists miss on this stretch — a viewpoint, chai spot, mechanic, shortcut, local experience
- watchOut: a specific real danger or mistake riders make on this exact stretch (e.g. "loose gravel after Baralachala, trucks don't stop, start by 6am before winds pick up")
- localFood: one specific dish or place to eat on this stretch that locals actually eat
- permits: any permit, checkpoint, or registration needed on this day (or "none")
- altRoute: an alternate road if conditions are bad or rider wants something different

Be brutally honest about difficult sections. Skip generic advice. Every field should contain something a first-timer wouldn't easily find on a travel blog. Return only valid JSON.`;

  // Gemini API — generateContent endpoint with JSON response schema
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

  const resp = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: "You are a travel route planner. Return only valid JSON matching the schema exactly." }]
      },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema:   itinerarySchema()
      }
    })
  });

  if (!resp.ok) {
    const m = await resp.text();
    return sendJson(res, 502, { error: `Gemini ${resp.status}: ${m.slice(0, 120)}` }, req);
  }

  const data = await resp.json();

  // Gemini response: candidates[0].content.parts[0].text
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) {
    const reason = data.candidates?.[0]?.finishReason || "unknown";
    return sendJson(res, 502, { error: `Gemini returned empty response (finishReason: ${reason}).` }, req);
  }

  try   { sendJson(res, 200, JSON.parse(raw), req); }
  catch { sendJson(res, 502, { error: "Gemini returned invalid JSON." }, req); }
});


// ════════════════════════════════════════════════════════════
// AI PROFILE SUGGESTIONS  (bio + lookingFor)
// ════════════════════════════════════════════════════════════

const handleAiSuggest = dbRoute(async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  // Fix 2 — rate limit: 10 AI suggestions per IP per hour
  if (!rateLimit(req, res, 10, 60 * 60_000)) return;
  if (!GEMINI_KEY) return sendJson(res, 500, { error: "GEMINI_API_KEY not configured." }, req);

  const body    = await readBody(req);
  const type    = String(body.type    || "bio");
  const context = body.context || {};

  let prompt = "";

  if (type === "bio") {
    prompt = `Write a short, honest, specific "About me" for a motorcycle rider profile on a travel partner app.
Name: ${context.name || "a rider"}
Trip type: ${context.tripType || "motorcycle"}
What they are looking for: ${context.lookingFor || "not specified"}

Rules:
- Max 3 sentences, under 400 characters
- Sound like a real person, not a travel blog
- Mention riding style, experience level, or habits
- No generic phrases like "love adventures" or "good vibes only"
- Specific details only (e.g. "done Spiti twice", "carry full toolkit", "5am starter")
Return only the bio text, no quotes, no extra formatting.`;
  } else {
    prompt = `Write a short, specific "Looking for in a ride partner" for a motorcycle rider profile.
Their bio: ${context.bio || "an experienced motorcycle rider"}
Trip type: ${context.tripType || "motorcycle"}

Rules:
- Max 3 sentences, under 350 characters
- Be specific about pace, habits, experience level, non-negotiables
- No generic phrases like "must be fun" or "good energy"
- Examples of good specifics: "non-smoker", "fine with 5am starts", "knows basic mechanics", "comfortable with camping", "experienced with high altitude"
Return only the text, no quotes, no extra formatting.`;
  }

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;

  const resp = await fetch(geminiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 150, temperature: 0.8 }
    })
  });

  if (!resp.ok) {
    const m = await resp.text();
    return sendJson(res, 502, { error: `Gemini ${resp.status}: ${m.slice(0, 100)}` }, req);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) return sendJson(res, 502, { error: "Gemini returned empty response." }, req);

  sendJson(res, 200, { text }, req);
});

// ════════════════════════════════════════════════════════════
// STATIC FILES
// ════════════════════════════════════════════════════════════

async function handleStatic(req, res) {
  const url   = new URL(req.url, `http://${req.headers.host}`);
  const pname = url.pathname === "/" ? "/index.html" : url.pathname;

  const user = getUser(req);
  if (user) {
    if (["/index.html", "/login.html", "/signup.html"].includes(pname)) {
      return sendRedirect(res, "/dashboard.html");
    }
  } else if (PROTECTED_PAGES.includes(pname)) {
    return sendRedirect(res, "/login.html?reason=auth");
  }

  const fpath = path.normalize(path.join(PUBLIC_DIR, pname));
  if (!fpath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end("Forbidden"); return; }

  try {
    const file = await fs.readFile(fpath);
    const ext  = path.extname(fpath).toLowerCase();
    setCORS(res, req);
    // Cache static assets: CSS/JS for 1 hour, HTML never (so auth redirects always apply)
    const isAsset = [".css", ".js", ".png", ".jpg", ".jpeg", ".svg"].includes(ext);
    const cacheControl = isAsset ? "public, max-age=3600" : "no-cache, no-store, must-revalidate";
    res.writeHead(200, {
      "Content-Type":  MIME[ext] || "application/octet-stream",
      "Cache-Control": cacheControl
    });
    res.end(file);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}

// ════════════════════════════════════════════════════════════
// ROUTER
// ════════════════════════════════════════════════════════════

function router(req, res) {
  const { method, url } = req;
  const urlPath = url.split("?")[0];

  if (method === "OPTIONS") { setCORS(res, req); res.writeHead(204); res.end(); return; }

  // Auth
  if (method === "POST" && urlPath === "/api/auth/signup")  return wrappedSignup(req, res);
  if (method === "POST" && urlPath === "/api/auth/login")   return handleLogin(req, res);
  if (method === "POST" && urlPath === "/api/auth/logout")  return handleLogout(req, res);
  if (method === "GET"  && urlPath === "/api/auth/me")      return handleMe(req, res);
  if (method === "GET"  && urlPath === "/api/auth/token")   return handleAuthToken(req, res);

  // Users — reviews before generic profile route
  if (urlPath.startsWith("/api/users/") && urlPath.endsWith("/reviews")) {
    const userId = decodeURIComponent(
      urlPath.slice("/api/users/".length, -"/reviews".length)
    );
    if (method === "GET")  return handleUserReviewsGet(req, res, userId);
    if (method === "POST") return handleUserReviewPost(req, res, userId);
  }

  if (method === "GET" && urlPath.startsWith("/api/users/")) {
    const userId = decodeURIComponent(urlPath.slice("/api/users/".length));
    return handleUserGet(req, res, userId);
  }

  // Profile — current user's own profile
  if (method === "GET"  && urlPath === "/api/profile") return handleProfileGet(req, res);
  if (method === "POST" && urlPath === "/api/profile") return handleProfileUpdate(req, res);

  // Trips
  if (method === "POST" && urlPath === "/api/trips")        return handleTripPost(req, res);
  if (method === "GET"  && urlPath === "/api/trips/mine")   return handleTripGet(req, res);
  if (method === "GET"  && urlPath === "/api/trips/search") return handleTripSearch(req, res);

  // Matches — specific before wildcard
  if (method === "GET"  && urlPath === "/api/matches")             return handleMatchesGet(req, res);
  if (method === "GET"  && urlPath === "/api/matches/suggestions") return handleMatchSuggestions(req, res);
  if (method === "GET"  && urlPath === "/api/matches/mutual")      return handleMutualMatches(req, res);
  if (method === "POST" && urlPath.startsWith("/api/matches/")) {
    const requesterId = decodeURIComponent(urlPath.slice("/api/matches/".length));
    return handleMatchPost(req, res, requesterId);
  }

  // Messages
  if (urlPath.startsWith("/api/messages/")) {
    const threadId = decodeURIComponent(urlPath.slice("/api/messages/".length));
    if (method === "GET")  return handleMessagesGet(req, res, threadId);
    if (method === "POST") return handleMessagePost(req, res, threadId);
  }

  // AI
  if (method === "POST" && urlPath === "/api/itinerary")   return handleItinerary(req, res);
  if (method === "POST" && urlPath === "/api/ai/suggest")   return handleAiSuggest(req, res);

  // Static
  if (method === "GET" || method === "HEAD") return handleStatic(req, res);

  res.writeHead(405); res.end("Method not allowed");
}

// ════════════════════════════════════════════════════════════
// PROFILE — GET + UPDATE  (bio, lookingFor, avatarUrl)
// ════════════════════════════════════════════════════════════

// GET /api/profile — current user's full profile
const handleProfileGet = dbRoute(async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  const doc  = await db.collection("users").findOne(
    { _id: toObjectId(user.userId) },
    { projection: { password: 0 } }   // never return password
  );
  if (!doc) return sendJson(res, 404, { error: "User not found." }, req);
  sendJson(res, 200, { profile: doc }, req);
});

// POST /api/profile — update bio, lookingFor, avatarUrl
const handleProfileUpdate = dbRoute(async (req, res) => {
  const user = requireUser(req, res); if (!user) return;
  // Allow up to 3MB for profile (data URI images)
  const body = await readBody(req, 3_000_000);

  const allowed = {};
  if (typeof body.bio        === "string") allowed.bio        = body.bio.slice(0, 500).trim();
  if (typeof body.lookingFor === "string") allowed.lookingFor = body.lookingFor.slice(0, 400).trim();
  if (typeof body.avatarUrl  === "string") {
    const url = body.avatarUrl.trim();
    if (url.startsWith("https://")) {
      allowed.avatarUrl = url;
    } else if (url.startsWith("data:image/") && url.length < 2_000_000) {
      allowed.avatarUrl = url;
    } else if (url.startsWith("data:image/")) {
      return sendJson(res, 413, { error: "Image too large. Use an image under 1.5MB or paste an https:// URL instead." }, req);
    }
  }
  if (typeof body.displayName === "string") allowed.displayName = body.displayName.slice(0, 60).trim();
  if (typeof body.gender      === "string" && ["unspecified", "male", "female", "other"].includes(body.gender)) allowed.gender = body.gender;

  if (!Object.keys(allowed).length)
    return sendJson(res, 400, { error: "No valid fields to update." }, req);

  allowed.updatedAt = new Date();

  await db.collection("users").updateOne(
    { _id: toObjectId(user.userId) },
    { $set: allowed }
  );

  sendJson(res, 200, { ok: true, updated: allowed }, req);
});

// ════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════

process.on("unhandledRejection", reason => console.error("[unhandledRejection]", reason));
process.on("uncaughtException",  err    => { console.error("[uncaughtException]", err.message); process.exit(1); });

async function shutdown(signal) {
  console.log(`[shutdown] ${signal}`);
  await mongo.close().catch(() => {});
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

async function main() {
  try { await connectDB(); }
  catch(e) {
    console.error("[db] MongoDB connection failed:", e.message);
    process.exit(1);
  }
  const server = http.createServer(router);
  setupWebSocket(server);
  server.listen(PORT, () => {
    console.log(`\nRoamCircle → http://localhost:${PORT}`);
    console.log(`WebSocket  → ws://localhost:${PORT}/ws`);
    console.log(`MongoDB:     ${MONGODB_URI}`);
    console.log(`JWT:         ${JWT_SECRET === "roamcircle-dev-secret-change-in-prod" ? "⚠️  default" : "✓ custom"}`);
    console.log(`Gemini:      ${GEMINI_KEY ? "✓ key found" : "⚠️  not set (AI planner disabled)"}`);
    console.log(`CORS:        ${[...ALLOWED_ORIGINS].join(", ")}\n`);
  });
}

main();
