/**
 * RoamCircle server.js — Step 3 (fully fixed)
 *
 * Fixes applied:
 *  #1  Step 3 route handlers moved above main() — no hoisting confusion
 *  #4  handleMutualMatches — N+1 replaced with single $in query
 *  #7  trips.to indexes removed; toLower indexes kept (only field queried)
 *  #9  buildThreadId dead code removed
 *  #10 Password not trimmed before storage — spaces preserved, check on raw
 */

"use strict";
const http      = require("node:http");
const fs        = require("node:fs/promises");
const path      = require("node:path");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const cookieLib = require("cookie");
const { MongoClient } = require("mongodb");

// ── Config ───────────────────────────────────────────────────
const PORT        = Number(process.env.PORT        || 3000);
const MONGODB_URI = process.env.MONGODB_URI        || "mongodb://127.0.0.1:27017";
const JWT_SECRET  = process.env.JWT_SECRET         || "roamcircle-dev-secret-change-in-prod";
const OPENAI_KEY  = process.env.OPENAI_API_KEY     || "";
const DB_NAME     = "roamcircle";
const PUBLIC_DIR  = __dirname;
const SALT_ROUNDS = 12;
const JWT_TTL     = "7d";

const ALLOWED_ORIGINS = new Set(
  (process.env.CORS_ORIGINS || `http://localhost:${PORT}`)
    .split(",").map(o => o.trim()).filter(Boolean)
);

const PROTECTED_PAGES = [
  "/dashboard.html",
  "/profile-arjun.html",
  "/profile-priya.html",
  "/profile-rohan.html",
  "/profile-lea.html",
  "/profile-maya.html",
  "/profile-jun.html"
];

const DEMO_PREFIX = "demo_";
const BOT_PREFIX  = "bot_";

// ── MongoDB ──────────────────────────────────────────────────
const mongo = new MongoClient(MONGODB_URI);
let db;

async function connectDB() {
  await mongo.connect();
  db = mongo.db(DB_NAME);

  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("trips").createIndex({ userId: 1 });

  // Fix #7 — only toLower is queried, drop redundant to/to+isLive indexes
  await db.collection("trips").createIndex({ toLower: 1 });
  await db.collection("trips").createIndex({ toLower: 1, isLive: 1 });

  await db.collection("matches").createIndex(
    { userId: 1, requesterId: 1 }, { unique: true }
  );
  // Fix #4 — index to support $in query in mutual matches
  await db.collection("matches").createIndex({ requesterId: 1, state: 1 });

  await db.collection("messages").createIndex({ threadId: 1, createdAt: 1 });

  console.log(`[db] MongoDB → ${MONGODB_URI}/${DB_NAME}`);
}

// ── MIME ─────────────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",   ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",  ".svg":  "image/svg+xml"
};

// ── HTTP helpers ─────────────────────────────────────────────
function setCORS(res, req) {
  const reqOrigin = req?.headers?.origin || "";
  const origin    = ALLOWED_ORIGINS.has(reqOrigin)
    ? reqOrigin
    : [...ALLOWED_ORIGINS][0];
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

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", c => {
      raw += c;
      if (raw.length > 500_000) { reject(new Error("Body too large.")); req.destroy(); }
    });
    req.on("end",   () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error("Invalid JSON body.")); }
    });
    req.on("error", reject);
  });
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
    httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 7, path: "/"
  });
}

function clearAuthCookie() {
  return cookieLib.serialize("rc_token", "", {
    httpOnly: true, sameSite: "lax", maxAge: 0, path: "/"
  });
}

// ── Thread ownership ─────────────────────────────────────────
function validateThreadOwnership(threadId, userId) {
  if (!threadId || !userId) return false;
  const sep = threadId.indexOf("_");
  if (sep === -1) return false;
  return threadId.slice(0, sep) === userId;
}

// ════════════════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════════════════

async function handleSignup(req, res) {
  let body;
  try { body = await readBody(req); }
  catch(e) { return sendJson(res, 400, { error: e.message }, req); }

  const name     = String(body.name     || "").trim();
  const email    = String(body.email    || "").trim().toLowerCase();
  // Fix #10 — do NOT trim password; check length on raw value
  const password = String(body.password || "");
  const tripType = String(body.tripType || "motorcycle");

  if (!name)                          return sendJson(res, 400, { error: "Name is required." }, req);
  if (!email || !email.includes("@")) return sendJson(res, 400, { error: "Valid email is required." }, req);
  if (password.length < 8)            return sendJson(res, 400, { error: "Password must be at least 8 characters." }, req);

  try {
    const hash   = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.collection("users").insertOne({
      name, email, password: hash, tripType, createdAt: new Date()
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
    res.end(JSON.stringify({ ok: true, name, email }));
  } catch(e) {
    if (e.code === 11000)
      return sendJson(res, 409, { error: "An account with this email already exists." }, req);
    console.error("[signup]", e.message);
    sendJson(res, 500, { error: "Could not create account." }, req);
  }
}

async function handleLogin(req, res) {
  let body;
  try { body = await readBody(req); }
  catch(e) { return sendJson(res, 400, { error: e.message }, req); }

  const email    = String(body.email    || "").trim().toLowerCase();
  // Fix #10 — don't trim password on login either
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
  res.end(JSON.stringify({ ok: true, name: user.name, email: user.email }));
}

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

// ════════════════════════════════════════════════════════════
// TRIPS
// ════════════════════════════════════════════════════════════

async function handleTripPost(req, res) {
  const user = requireUser(req, res); if (!user) return;
  let body;
  try { body = await readBody(req); }
  catch(e) { return sendJson(res, 400, { error: e.message }, req); }

  const tripDoc = {
    userId:     user.userId,
    userName:   user.name,
    from:       String(body.source      || "").trim(),
    to:         String(body.destination || "").trim(),
    toLower:    String(body.destination || "").trim().toLowerCase(),
    startDate:  String(body.startDate   || "").trim(),
    endDate:    String(body.endDate     || "").trim(),
    tripType:   String(body.tripType    || "motorcycle"),
    vehicle:    String(body.vehicle     || "").trim(),
    pace:       String(body.pace        || "moderate"),
    budget:     String(body.budget      || "mid"),
    habits:     String(body.habits      || "").trim(),
    meetpoints: String(body.meetpoints  || "").trim(),
    updatedAt:  new Date(),
    isLive:     true
  };

  if (!tripDoc.to) return sendJson(res, 400, { error: "Destination is required." }, req);

  await db.collection("trips").updateOne(
    { userId: user.userId },
    { $set: tripDoc, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  sendJson(res, 200, { ok: true, trip: tripDoc }, req);
}

async function handleTripGet(req, res) {
  const user = requireUser(req, res); if (!user) return;
  const trip = await db.collection("trips").findOne({ userId: user.userId });
  sendJson(res, 200, { trip: trip || null }, req);
}

// ════════════════════════════════════════════════════════════
// MATCHES
// ════════════════════════════════════════════════════════════

async function handleMatchesGet(req, res) {
  const user = requireUser(req, res); if (!user) return;
  const rows = await db.collection("matches").find({ userId: user.userId }).toArray();
  const map  = {};
  rows.forEach(m => { map[m.requesterId] = m.state; });
  sendJson(res, 200, { matches: map }, req);
}

async function handleMatchPost(req, res, requesterId) {
  const user = requireUser(req, res); if (!user) return;
  let body;
  try { body = await readBody(req); }
  catch(e) { return sendJson(res, 400, { error: e.message }, req); }

  const state = String(body.action || "").trim();
  if (!["accept", "reject"].includes(state))
    return sendJson(res, 400, { error: "action must be 'accept' or 'reject'." }, req);

  const requesterType = requesterId.startsWith(DEMO_PREFIX) ? "demo" : "user";

  await db.collection("matches").updateOne(
    { userId: user.userId, requesterId },
    {
      $set: { state, requesterType, updatedAt: new Date() },
      $setOnInsert: { userId: user.userId, requesterId, requesterType, createdAt: new Date() }
    },
    { upsert: true }
  );

  sendJson(res, 200, { ok: true, requesterId, state }, req);
}

// ════════════════════════════════════════════════════════════
// MESSAGES
// ════════════════════════════════════════════════════════════

async function handleMessagesGet(req, res, threadId) {
  const user = requireUser(req, res); if (!user) return;
  if (!validateThreadOwnership(threadId, user.userId))
    return sendJson(res, 403, { error: "Access denied." }, req);

  const messages = await db.collection("messages")
    .find({ threadId })
    .sort({ createdAt: 1 })
    .toArray();

  sendJson(res, 200, { messages }, req);
}

async function handleMessagePost(req, res, threadId) {
  const user = requireUser(req, res); if (!user) return;
  if (!validateThreadOwnership(threadId, user.userId))
    return sendJson(res, 403, { error: "Access denied." }, req);

  let body;
  try { body = await readBody(req); }
  catch(e) { return sendJson(res, 400, { error: e.message }, req); }

  const text     = String(body.text || "").trim();
  const type     = String(body.type || "text");
  const meta     = (typeof body.meta === "object" && body.meta !== null) ? body.meta : {};
  const rawSender = body.botSender
    ? `${BOT_PREFIX}${String(body.botSender).replace(/^bot_/, "")}`
    : null;
  const from     = rawSender || user.userId;
  const fromName = rawSender ? String(body.botName || "Traveler").trim() : user.name;

  if (type === "text" && !text)
    return sendJson(res, 400, { error: "Message text is required." }, req);

  const msg    = { threadId, from, fromName, text, type, meta, createdAt: new Date() };
  const result = await db.collection("messages").insertOne(msg);
  sendJson(res, 201, { ok: true, message: { ...msg, _id: result.insertedId } }, req);
}

// ════════════════════════════════════════════════════════════
// STEP 3 — MATCHING
// ════════════════════════════════════════════════════════════

const PACE_RANK   = { relaxed: 0, moderate: 1, fast: 2 };
const BUDGET_RANK = { budget: 0, mid: 1, comfort: 2 };

function extractHabitWords(habits) {
  const stop = new Set(["and","the","a","i","to","in","with","for",
                        "is","am","are","im","its","of","on","at"]);
  return new Set(
    habits.toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !stop.has(w))
  );
}

function scoreCompatibility(myTrip, theirTrip) {
  let score = 0;

  // Date overlap — 0–30 pts
  try {
    const ms = new Date(myTrip.startDate),   me = new Date(myTrip.endDate);
    const ts = new Date(theirTrip.startDate), te = new Date(theirTrip.endDate);
    if (!isNaN(ms) && !isNaN(me) && !isNaN(ts) && !isNaN(te)) {
      const overlapDays = Math.max(0,
        (Math.min(me, te) - Math.max(ms, ts)) / 86_400_000
      );
      const myDays = Math.max(1, (me - ms) / 86_400_000);
      score += Math.min(30, Math.round((overlapDays / myDays) * 30));
    }
  } catch { /* ignore */ }

  // Pace — 0–25 pts
  const paceDiff = Math.abs((PACE_RANK[myTrip.pace] ?? 1) - (PACE_RANK[theirTrip.pace] ?? 1));
  score += paceDiff === 0 ? 25 : paceDiff === 1 ? 12 : 0;

  // Budget — 0–25 pts
  const budgetDiff = Math.abs(
    (BUDGET_RANK[myTrip.budget] ?? 1) - (BUDGET_RANK[theirTrip.budget] ?? 1)
  );
  score += budgetDiff === 0 ? 25 : budgetDiff === 1 ? 12 : 0;

  // Habit overlap — 0–20 pts
  const myW = extractHabitWords(myTrip.habits || "");
  const thW = extractHabitWords(theirTrip.habits || "");
  if (myW.size > 0 && thW.size > 0) {
    const shared = [...myW].filter(w => thW.has(w)).length;
    const union  = new Set([...myW, ...thW]).size;
    score += Math.round((shared / union) * 20);
  } else {
    score += 10;
  }

  return Math.min(100, score);
}

// GET /api/matches/suggestions
async function handleMatchSuggestions(req, res) {
  const user = requireUser(req, res); if (!user) return;

  const myTrip = await db.collection("trips").findOne({ userId: user.userId });
  if (!myTrip?.toLower)
    return sendJson(res, 200, { suggestions: [], reason: "Publish your trip first." }, req);

  const myMatches  = await db.collection("matches").find({ userId: user.userId }).toArray();
  const decidedIds = new Set(myMatches.map(m => m.requesterId));

  const candidates = await db.collection("trips").find({
    toLower: myTrip.toLower,
    isLive:  true,
    userId:  { $ne: user.userId }
  }).toArray();

  const suggestions = candidates
    .filter(t => !decidedIds.has(t.userId))
    .map(t => ({
      userId: t.userId, userName: t.userName,
      from: t.from, to: t.to,
      startDate: t.startDate, endDate: t.endDate,
      tripType: t.tripType, vehicle: t.vehicle,
      pace: t.pace, budget: t.budget,
      habits: t.habits, meetpoints: t.meetpoints,
      score: scoreCompatibility(myTrip, t)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  sendJson(res, 200, { suggestions, myTrip }, req);
}

// GET /api/trips/search?to=ladakh
async function handleTripSearch(req, res) {
  const user = requireUser(req, res); if (!user) return;
  const url  = new URL(req.url, `http://${req.headers.host}`);
  const to   = (url.searchParams.get("to") || "").trim().toLowerCase();
  if (!to) return sendJson(res, 400, { error: "'to' query param required." }, req);

  const trips = await db.collection("trips").find({
    toLower: to, isLive: true, userId: { $ne: user.userId }
  }).toArray();

  sendJson(res, 200, { trips }, req);
}

// GET /api/matches/mutual — Fix #4: single $in query instead of N+1
async function handleMutualMatches(req, res) {
  const user = requireUser(req, res); if (!user) return;

  // Everyone this user has accepted
  const iAccepted = await db.collection("matches").find({
    userId: user.userId, state: "accept"
  }).toArray();

  if (!iAccepted.length) return sendJson(res, 200, { mutual: [] }, req);

  // Separate demo vs real
  const demoAccepted = iAccepted.filter(m => m.requesterId.startsWith(DEMO_PREFIX));
  const realAccepted = iAccepted.filter(m => !m.requesterId.startsWith(DEMO_PREFIX));

  // Fix #4 — one $in query instead of one findOne per match
  const realIds = realAccepted.map(m => m.requesterId);
  const theyAccepted = realIds.length
    ? await db.collection("matches").find({
        userId:      { $in: realIds },
        requesterId: user.userId,
        state:       "accept"
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
}

// ════════════════════════════════════════════════════════════
// AI ITINERARY
// ════════════════════════════════════════════════════════════

function itinerarySchema() {
  return {
    type: "object", additionalProperties: false,
    properties: {
      title: { type: "string" }, summary: { type: "string" },
      days: {
        type: "array", minItems: 1, maxItems: 7,
        items: {
          type: "object", additionalProperties: false,
          properties: {
            day: { type: "integer" }, title: { type: "string" },
            description: { type: "string" }, morning: { type: "string" },
            afternoon: { type: "string" }, evening: { type: "string" }
          },
          required: ["day","title","description","morning","afternoon","evening"]
        }
      }
    },
    required: ["title","summary","days"]
  };
}

async function handleItinerary(req, res) {
  const user = requireUser(req, res); if (!user) return;
  if (!OPENAI_KEY)
    return sendJson(res, 500, { error: "OPENAI_API_KEY not configured." }, req);

  let body;
  try { body = await readBody(req); }
  catch(e) { return sendJson(res, 400, { error: e.message }, req); }

  const from    = String(body.source      || "").trim();
  const to      = String(body.destination || "").trim();
  const days    = Math.min(Math.max(Number(body.days || 5), 1), 7);
  const budget  = String(body.budget   || "mid");
  const vehicle = String(body.vehicle  || "");
  const habits  = String(body.habits   || "");
  const type    = String(body.tripType || "motorcycle");

  if (!to) return sendJson(res, 400, { error: "Destination is required." }, req);

  const prompt = [
    "Create a realistic day-by-day travel route plan.",
    from    ? `From: ${from}` : "",
    `To: ${to}`, `Duration: ${days} days`, `Budget: ${budget}`,
    `Trip type: ${type}`,
    vehicle ? `Vehicle: ${vehicle}` : "",
    habits  ? `Habits: ${habits}`   : "",
    "Return only structured JSON matching the schema."
  ].filter(Boolean).join("\n");

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_KEY}`,
        "Content-Type":  "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        response_format: {
          type: "json_schema",
          json_schema: { name: "travel_plan", strict: true, schema: itinerarySchema() }
        },
        messages: [
          { role: "system", content: "You are a travel route planner. Return only valid JSON." },
          { role: "user",   content: prompt }
        ]
      })
    });

    if (!resp.ok) {
      const m = await resp.text();
      return sendJson(res, 502, { error: `OpenAI ${resp.status}: ${m.slice(0, 120)}` }, req);
    }
    const data = await resp.json();
    const raw  = data.choices?.[0]?.message?.content;
    if (!raw) return sendJson(res, 502, { error: "OpenAI returned empty response." }, req);
    try   { sendJson(res, 200, JSON.parse(raw), req); }
    catch { sendJson(res, 502, { error: "OpenAI returned invalid JSON." }, req); }
  } catch(e) {
    console.error("[itinerary]", e.message);
    sendJson(res, 500, { error: e.message }, req);
  }
}

// ════════════════════════════════════════════════════════════
// STATIC FILES
// ════════════════════════════════════════════════════════════

async function handleStatic(req, res) {
  const url   = new URL(req.url, `http://${req.headers.host}`);
  const pname = url.pathname === "/" ? "/index.html" : url.pathname;

  if (PROTECTED_PAGES.includes(pname) && !getUser(req))
    return sendRedirect(res, "/login.html?reason=auth");

  const fpath = path.normalize(path.join(PUBLIC_DIR, pname));
  if (!fpath.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end("Forbidden"); return; }

  try {
    const file = await fs.readFile(fpath);
    const ext  = path.extname(fpath).toLowerCase();
    setCORS(res, req);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}

// ════════════════════════════════════════════════════════════
// ROUTER — Fix #1: all handlers defined before main()
// ════════════════════════════════════════════════════════════

function router(req, res) {
  const { method, url } = req;
  const urlPath = url.split("?")[0];

  if (method === "OPTIONS") {
    setCORS(res, req); res.writeHead(204); res.end(); return;
  }

  // Auth
  if (method === "POST" && urlPath === "/api/auth/signup")  return handleSignup(req, res);
  if (method === "POST" && urlPath === "/api/auth/login")   return handleLogin(req, res);
  if (method === "POST" && urlPath === "/api/auth/logout")  return handleLogout(req, res);
  if (method === "GET"  && urlPath === "/api/auth/me")      return handleMe(req, res);

  // Trips
  if (method === "POST" && urlPath === "/api/trips")        return handleTripPost(req, res);
  if (method === "GET"  && urlPath === "/api/trips/mine")   return handleTripGet(req, res);
  if (method === "GET"  && urlPath === "/api/trips/search") return handleTripSearch(req, res);

  // Matches — specific routes BEFORE wildcard startsWith
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
  if (method === "POST" && urlPath === "/api/itinerary") return handleItinerary(req, res);

  // Static
  if (method === "GET" || method === "HEAD") return handleStatic(req, res);

  res.writeHead(405); res.end("Method not allowed");
}

// ════════════════════════════════════════════════════════════
// BOOT
// ════════════════════════════════════════════════════════════

process.on("unhandledRejection", reason => {
  console.error("[unhandledRejection]", reason);
});

process.on("uncaughtException", err => {
  console.error("[uncaughtException]", err.message);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  console.log("[shutdown] SIGTERM — closing MongoDB");
  await mongo.close().catch(() => {});
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[shutdown] SIGINT — closing MongoDB");
  await mongo.close().catch(() => {});
  process.exit(0);
});

async function main() {
  try {
    await connectDB();
  } catch(e) {
    console.error("[db] MongoDB connection failed:", e.message);
    console.error("     Start MongoDB: mongod --dbpath ~/data/db");
    process.exit(1);
  }

  http.createServer(router).listen(PORT, () => {
    console.log(`\nRoamCircle → http://localhost:${PORT}`);
    console.log(`MongoDB:    ${MONGODB_URI}`);
    console.log(`JWT:        ${JWT_SECRET === "roamcircle-dev-secret-change-in-prod" ? "⚠️  default (set JWT_SECRET)" : "✓ custom"}`);
    console.log(`OpenAI:     ${OPENAI_KEY ? "✓ key found" : "⚠️  not set"}`);
    console.log(`CORS:       ${[...ALLOWED_ORIGINS].join(", ")}\n`);
  });
}

main();
