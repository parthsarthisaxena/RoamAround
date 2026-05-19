/**
 * RoamCircle server.js — Step 1: Real auth + MongoDB
 *
 * Routes:
 *   POST /api/auth/signup   — create account, return JWT cookie
 *   POST /api/auth/login    — verify credentials, return JWT cookie
 *   POST /api/auth/logout   — clear JWT cookie
 *   GET  /api/auth/me       — return current user (requires auth)
 *   POST /api/itinerary     — generate AI plan (requires auth)
 *   GET  /*                 — static files (dashboard protected)
 *
 * Env vars needed:
 *   MONGODB_URI    — e.g. mongodb://localhost:27017  (default used if absent)
 *   JWT_SECRET     — any long random string
 *   OPENAI_API_KEY — your OpenAI key (optional, falls back to demo)
 *   PORT           — default 3000
 */

"use strict";
const http      = require("node:http");
const fs        = require("node:fs/promises");
const path      = require("node:path");
const bcrypt    = require("bcryptjs");
const jwt       = require("jsonwebtoken");
const cookieLib = require("cookie");
const { MongoClient, ObjectId } = require("mongodb");

// ── Config ───────────────────────────────────────────────────
const PORT        = Number(process.env.PORT        || 3000);
const MONGODB_URI = process.env.MONGODB_URI        || "mongodb://127.0.0.1:27017";
const JWT_SECRET  = process.env.JWT_SECRET         || "roamcircle-dev-secret-change-in-prod";
const OPENAI_KEY  = process.env.OPENAI_API_KEY     || "";
const DB_NAME     = "roamcircle";
const PUBLIC_DIR  = __dirname;
const SALT_ROUNDS = 12;
const JWT_TTL     = "7d"; // token valid for 7 days

// ── MongoDB client ───────────────────────────────────────────
const client = new MongoClient(MONGODB_URI);
let db;

async function connectDB() {
  await client.connect();
  db = client.db(DB_NAME);
  // Unique index on email
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  console.log(`[db] Connected to MongoDB → ${MONGODB_URI}/${DB_NAME}`);
}

// ── MIME types ───────────────────────────────────────────────
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg":  "image/svg+xml"
};

// ── Helpers ──────────────────────────────────────────────────
function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  res.end(JSON.stringify(payload));
}

function sendRedirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > 500_000) { reject(new Error("Body too large.")); req.destroy(); }
    });
    req.on("end",   () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("Invalid JSON.")); } });
    req.on("error", reject);
  });
}

function parseCookies(req) {
  return cookieLib.parse(req.headers.cookie || "");
}

function makeAuthCookie(token) {
  return cookieLib.serialize("rc_token", token, {
    httpOnly: true,          // not accessible via JS — prevents XSS theft
    sameSite: "lax",         // CSRF protection
    maxAge:   60 * 60 * 24 * 7, // 7 days in seconds
    path:     "/"
  });
}

function clearAuthCookie() {
  return cookieLib.serialize("rc_token", "", {
    httpOnly: true,
    sameSite: "lax",
    maxAge:   0,
    path:     "/"
  });
}

// ── Auth middleware ──────────────────────────────────────────
// Returns the decoded user payload if the JWT cookie is valid, else null.
function getAuthUser(req) {
  try {
    const cookies = parseCookies(req);
    if (!cookies.rc_token) return null;
    return jwt.verify(cookies.rc_token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ── Protected HTML pages ─────────────────────────────────────
// These pages require a valid session. If not authed → redirect to login.
const PROTECTED_PAGES = [
  "/dashboard.html",
  "/profile-arjun.html",
  "/profile-priya.html",
  "/profile-rohan.html"
];

// ── API: POST /api/auth/signup ───────────────────────────────
async function handleSignup(req, res) {
  let body;
  try { body = await readBody(req); }
  catch(e) { return sendJson(res, 400, { error: e.message }); }

  const name     = String(body.name     || "").trim();
  const email    = String(body.email    || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  const tripType = String(body.tripType || "motorcycle");

  if (!name)                    return sendJson(res, 400, { error: "Name is required." });
  if (!email || !email.includes("@")) return sendJson(res, 400, { error: "Valid email is required." });
  if (password.length < 8)      return sendJson(res, 400, { error: "Password must be at least 8 characters." });

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    const result = await db.collection("users").insertOne({
      name,
      email,
      password: hash,
      tripType,
      createdAt: new Date()
    });

    const token = jwt.sign(
      { userId: result.insertedId.toString(), name, email, tripType },
      JWT_SECRET,
      { expiresIn: JWT_TTL }
    );

    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie":   makeAuthCookie(token)
    });
    res.end(JSON.stringify({ ok: true, name, email }));
  } catch(e) {
    if (e.code === 11000) {
      return sendJson(res, 409, { error: "An account with this email already exists." });
    }
    console.error("[signup]", e.message);
    return sendJson(res, 500, { error: "Could not create account. Please try again." });
  }
}

// ── API: POST /api/auth/login ────────────────────────────────
async function handleLogin(req, res) {
  let body;
  try { body = await readBody(req); }
  catch(e) { return sendJson(res, 400, { error: e.message }); }

  const email    = String(body.email    || "").trim().toLowerCase();
  const password = String(body.password || "").trim();

  if (!email || !password) return sendJson(res, 400, { error: "Email and password are required." });

  const user = await db.collection("users").findOne({ email });
  if (!user) return sendJson(res, 401, { error: "Incorrect email or password." });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return sendJson(res, 401, { error: "Incorrect email or password." });

  const token = jwt.sign(
    { userId: user._id.toString(), name: user.name, email: user.email, tripType: user.tripType },
    JWT_SECRET,
    { expiresIn: JWT_TTL }
  );

  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie":   makeAuthCookie(token)
  });
  res.end(JSON.stringify({ ok: true, name: user.name, email: user.email }));
}

// ── API: POST /api/auth/logout ───────────────────────────────
function handleLogout(req, res) {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Set-Cookie":   clearAuthCookie()
  });
  res.end(JSON.stringify({ ok: true }));
}

// ── API: GET /api/auth/me ────────────────────────────────────
function handleMe(req, res) {
  const user = getAuthUser(req);
  if (!user) return sendJson(res, 401, { error: "Not authenticated." });
  sendJson(res, 200, { name: user.name, email: user.email, tripType: user.tripType });
}

// ── API: POST /api/itinerary ─────────────────────────────────
function itinerarySchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      title:   { type: "string" },
      summary: { type: "string" },
      days: {
        type: "array", minItems: 1, maxItems: 7,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            day:         { type: "integer" },
            title:       { type: "string" },
            description: { type: "string" },
            morning:     { type: "string" },
            afternoon:   { type: "string" },
            evening:     { type: "string" }
          },
          required: ["day","title","description","morning","afternoon","evening"]
        }
      }
    },
    required: ["title","summary","days"]
  };
}

async function handleItinerary(req, res) {
  // Require auth
  const user = getAuthUser(req);
  if (!user) return sendJson(res, 401, { error: "Login required to generate itineraries." });

  if (!OPENAI_KEY) return sendJson(res, 500, { error: "OPENAI_API_KEY not configured on server." });

  let body;
  try { body = await readBody(req); }
  catch(e) { return sendJson(res, 400, { error: e.message }); }

  const from    = String(body.source      || "").trim();
  const to      = String(body.destination || "").trim();
  const days    = Math.min(Math.max(Number(body.days || 5), 1), 7);
  const budget  = String(body.budget   || "mid");
  const vehicle = String(body.vehicle  || "");
  const habits  = String(body.habits   || "");
  const type    = String(body.tripType || "motorcycle");

  if (!to) return sendJson(res, 400, { error: "Destination is required." });

  const prompt = [
    "Create a realistic day-by-day travel route plan.",
    from    ? `From: ${from}` : "",
    `To: ${to}`,
    `Duration: ${days} days`,
    `Budget: ${budget}`,
    `Trip type: ${type}`,
    vehicle ? `Vehicle/gear: ${vehicle}` : "",
    habits  ? `Traveler habits: ${habits}` : "",
    "Make it practical and specific. Return only structured JSON."
  ].filter(Boolean).join("\n");

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method:  "POST",
      headers: { "Authorization": `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o",
        response_format: {
          type: "json_schema",
          json_schema: { name: "travel_plan", strict: true, schema: itinerarySchema() }
        },
        messages: [
          { role: "system", content: "You are a travel route planner. Return only valid JSON matching the schema." },
          { role: "user",   content: prompt }
        ]
      })
    });

    if (!resp.ok) {
      const msg = await resp.text();
      console.error("[openai]", resp.status, msg.slice(0,200));
      return sendJson(res, 502, { error: `OpenAI error ${resp.status}.` });
    }

    const data = await resp.json();
    const raw  = data.choices?.[0]?.message?.content;
    if (!raw) return sendJson(res, 502, { error: "OpenAI returned empty response." });

    try {
      const plan = JSON.parse(raw);
      sendJson(res, 200, plan);
    } catch {
      sendJson(res, 502, { error: "OpenAI returned invalid JSON." });
    }
  } catch(e) {
    console.error("[itinerary]", e.message);
    sendJson(res, 500, { error: e.message });
  }
}

// ── Static file handler ──────────────────────────────────────
async function handleStatic(req, res) {
  const url   = new URL(req.url, `http://${req.headers.host}`);
  const pname = url.pathname === "/" ? "/index.html" : url.pathname;

  // Block direct access to protected pages if not authenticated
  if (PROTECTED_PAGES.includes(pname)) {
    const user = getAuthUser(req);
    if (!user) return sendRedirect(res, "/login.html?reason=auth");
  }

  const fpath = path.normalize(path.join(PUBLIC_DIR, pname));
  if (!fpath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  try {
    const file = await fs.readFile(fpath);
    const ext  = path.extname(fpath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(file);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}

// ── Router ───────────────────────────────────────────────────
function router(req, res) {
  const { method, url } = req;

  if (method === "POST" && url === "/api/auth/signup")    return handleSignup(req, res);
  if (method === "POST" && url === "/api/auth/login")     return handleLogin(req, res);
  if (method === "POST" && url === "/api/auth/logout")    return handleLogout(req, res);
  if (method === "GET"  && url === "/api/auth/me")        return handleMe(req, res);
  if (method === "POST" && url === "/api/itinerary")      return handleItinerary(req, res);
  if (method === "GET"  || method === "HEAD")             return handleStatic(req, res);

  res.writeHead(405); res.end("Method not allowed");
}

// ── Boot ─────────────────────────────────────────────────────
async function main() {
  try {
    await connectDB();
  } catch(e) {
    console.error("[db] Could not connect to MongoDB:", e.message);
    console.error("     Make sure MongoDB is running: mongod --dbpath ~/data/db");
    process.exit(1);
  }

  http.createServer(router).listen(PORT, () => {
    console.log(`RoamCircle → http://localhost:${PORT}`);
    console.log(`JWT secret: ${JWT_SECRET === "roamcircle-dev-secret-change-in-prod" ? "⚠️  using default (set JWT_SECRET env var)" : "✓ custom"}`);
    console.log(`OpenAI:     ${OPENAI_KEY ? "✓ key found" : "⚠️  not set (AI planner will return error)"}`);
  });
}

main();
