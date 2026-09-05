# RoamAround

**Find compatible travel partners for motorcycle rides, road trips, hikes and more.**

Publish your trip, get matched by route / pace / habits, chat in real time, and ride together.
Prepared as a **Razorpay AI Buildathon 2026 — Open Track** submission: real product, real AI with measured metrics, honest failure handling.

---

## Quick start

### 1. Prerequisites
- Node.js v18+ (`node -v`)
- MongoDB (local or Atlas free tier)

```bash
# Mac
brew services start mongodb-community
# Linux
sudo systemctl start mongod
# Windows (separate terminal)
mongod --dbpath C:\data\db
```

### 2. Install
```bash
npm install
```

### 3. Environment + start
Copy `.env.example` to `.env`, set `JWT_SECRET` (long random string) and optionally `GEMINI_API_KEY`.

`server.js` loads `.env` automatically. `npm start` is enough — you do not need `node -r dotenv/config`.

```powershell
# Windows PowerShell (optional overrides)
$env:MONGODB_URI    = "mongodb://127.0.0.1:27017"
$env:JWT_SECRET     = "any-long-random-string-here"
$env:GEMINI_API_KEY = "your-gemini-key-here"        # enables AI planner + AI matcher
$env:GEMINI_MODEL   = "gemini-2.0-flash"            # optional
npm start
```
```bash
# Mac / Linux
MONGODB_URI="mongodb://127.0.0.1:27017" \
JWT_SECRET="any-long-random-string-here" \
GEMINI_API_KEY="your-gemini-key-here" \
npm start
```

Set `TRUST_PROXY=true` only when a reverse proxy overwrites `X-Forwarded-For`. Otherwise rate limits use the socket address so clients cannot spoof the limiter.

> ⚠️ Never commit real keys. Put secrets only in `.env` (gitignored). If this copy still had a Gemini key in `.env` or `.env.example`, treat it as burned and issue a new key.

### 4. Open the app
`http://localhost:3000` → `/signup.html` → create two accounts to demo matching.

---

## File structure

| File | Purpose |
| --- | --- |
| `server.js` | Node HTTP server — all API routes, WS push, static serving |
| `scoring.js` | Deterministic compatibility scorer (extracted from server.js) |
| `ai_matcher.js` | AI vibe matcher — schema-enforced Gemini + deterministic fallback + audit log |
| `deposits.js` | Razorpay Trip Treasurer (bounded, audited) — wiring in progress |
| `chat.js` | Client: chat panel, matches grid, request cards, ride history drawer |
| `realtime.js` | WebSocket client + notification bell |
| `ratings.js` | Rider ratings + review modal |
| `script.js` | AI trip planner (Gemini, rich day cards, demo fallback) |
| `animate.js` | Scroll reveals, badge bumps, tilt, ripple, page transitions |
| `theme.js` / `theme-light.css` | Light/dark theme system |
| `trip-covers.js` | Verified cover-photo pools + per-user fallbacks |
| `styles.css` / `dashboard.css` | Global + dashboard styles |
| `eval/run_eval.js` | Honest eval harness: deterministic vs AI, precision/recall on labeled pairs |
| `eval/profiles.json` / `eval/pairs.json` | Seed riders + hand-labeled compatibility pairs |
| `eval/ai_cache.json` | Versioned answer cache (never re-burns quota for identical prompts) |

---

## MongoDB collections

| Collection | What's stored |
| --- | --- |
| `users` | Name, email, bcrypt hash, trip type, gender, bio, lookingFor, avatar |
| `trips` | One live trip per user (upserted), `toLower` normalized, `isLive` flag |
| `matches` | Accept/reject state per user + requester pair |
| `messages` | Chat messages, indexed by threadId + createdAt |
| `reviews` | Post-match rider reviews (one per reviewer, unique index) |
| `rides` | **Archived past trips** with crew snapshot (ride history) |
| `match_decisions` | **AI matcher audit trail** — tier, model, score, reasoning, timestamp |

---

## API routes

**Auth**
| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/auth/signup` | Create account, set httpOnly JWT cookie |
| POST | `/api/auth/login` | Verify credentials, set cookie |
| POST | `/api/auth/logout` | Clear cookie |
| GET | `/api/auth/me` | Current user from cookie |
| GET | `/api/auth/token` | Short-lived WS token derived from cookie |

**Users / Profile / Reviews**
| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/users/:id` | Safe public profile (gender-preference enforced) |
| GET/POST | `/api/users/:id/reviews` | Read / leave review (mutual match required) |
| GET/POST | `/api/profile` | Own profile get/update (bio, lookingFor, avatar, displayName) |

**Trips / Rides**
| Method | Route | Description |
| --- | --- | --- |
| POST | `/api/trips` | Publish/update trip (archives old trip to `rides` on change) |
| GET | `/api/trips/mine` | My saved trip |
| GET | `/api/trips/search?to=` | Search live trips by destination |
| GET | `/api/rides` | My ride history (archived + date-passed) with crew |
| POST | `/api/rides/end` | Manually end trip → archive + `isLive:false` |

**Matches**
| Method | Route | Description |
| --- | --- | --- |
| GET | `/api/matches` | All my accept/reject states |
| POST | `/api/matches/:requesterId` | Accept / reject (also cancels — exit rules) |
| GET | `/api/matches/suggestions` | Real riders on my route, ranked |
| GET | `/api/matches/mutual` | Mutual matches |
| POST | `/api/matches/ai-rank` | **AI vibe verdicts** for top candidates (registered *before* the `:requesterId` wildcard) |

**Messages / AI**
| Method | Route | Description |
| --- | --- | --- |
| GET/POST | `/api/messages/:threadId` | Thread read (paginated) / send |
| POST | `/api/itinerary` | Gemini day-by-day route plan (schema-enforced) |
| POST | `/api/ai/suggest` | Gemini bio / lookingFor writer |
| POST | `/api/deposits/skip` | Skip own good-faith deposit (logged-in, thread owner) |
| POST | `/api/mock/pay` | Mock checkout complete (logged-in; only when Razorpay keys are absent) |
| POST | `/api/razorpay/webhook` | HMAC-verified `payment_link.paid` (raw body) |

---

## Auth flow & security

- bcrypt (12 rounds); JWT in **httpOnly, sameSite=lax** cookie — never in JS storage.
- **No token in login/signup response bodies** (removed; WS uses `/api/auth/token`).
- Thread IDs ownership-validated; bot replies under `bot_` prefix; ObjectId validated before use.
- Rate limits on auth, token, reviews, AI endpoints.
- CORS configurable via `CORS_ORIGINS`; protected pages redirect server-side.

---

## Realtime (WebSocket)

`realtime.js` fetches a fresh token from `/api/auth/token` on load (cookie-derived — nothing in sessionStorage), connects to `/ws?token=…`, heartbeat 25s, exponential-backoff reconnect.

| Event | When |
| --- | --- |
| `match_request` | Someone accepts you |
| `match_accepted` | Mutual match confirmed |
| `match_cancelled` | A matched rider left the crew (live exit rules) |
| `trip_published` | New/changed trip overlaps your destination — suggestions refresh live, no refresh needed |
| `new_message` | Message in a thread |

---

## Matching — two engines, one product decision

**Deterministic scorer (0–100)** — `scoring.js`

| Factor | Max pts |
| --- | --- |
| Date overlap / proximity | 30 |
| Pace match | 25 |
| Budget match | 25 |
| Habit overlap (Jaccard) | 15 |
| lookingFor ↔ habits | 5 |

**AI vibe matcher** — `ai_matcher.js`
- Tier 1/2: deterministic (no AI by design). Tier 3: Gemini with **schema-enforced JSON** (`vibe_score`, `match`, `reasoning`), temperature 0.2.
- Every decision audited to `match_decisions`. On any AI failure → deterministic fallback, flagged in UI ("AI unavailable — deterministic score used"). Never crashes, never guesses.

### Eval harness (`npm run eval`)
12 hand-labeled rider pairs (seed), precision/recall for both engines, versioned cache (`PROMPT_VERSION`) so identical prompts never re-burn quota; 4.5s spacing + exponential backoff on 429.

**Prompt calibration ladder (honest metrics):**

| Prompt | Precision | Recall | F1 | Behavior |
| --- | --- | --- | --- | --- |
| v1 | 1.00 | 0.60 | 0.75 | Too strict |
| v2 | 0.63 | 1.00 | 0.77 | Too lenient — ignored explicit "fast riders only" demands |
| v3 | 0.83 | 1.00 | 0.91 | Fast demands still not enforced |
| v4 (current, `eval/results.json`) | 1.00 | 0.80 | 0.89 | Hard-reject rules; fewer false positives, some missed matches |

Deterministic baseline: **P=0.83 R=1.00 F1=0.91** — its single false positive (`rohan–sara`) pairs a relaxed rider with a 400 km/day rider: a safety risk.

> **Product decision:** in rider matching, a false positive is a safety hazard on a mountain pass; a false negative is a missed introduction. The AI matcher ships as the ranking engine because its measured failure mode is safer (P=1.00, no false positives on the labeled set) even though recall is lower than the deterministic scorer.
>
> *Data revision note (2026-08):* priya/aman seed bios were made explicit about prior long-distance experience so labels are derivable from profile text.

---

## Ride lifecycle & history

A trip ends three ways → lands in **🕰️ Ride history** drawer with its crew snapshot:
1. **By date** — `endDate` passed (computed on read).
2. **By re-publish** — new destination/dates auto-archive the old trip.
3. **Manual** — `POST /api/rides/end` (🏁 End trip) sets `isLive:false`; duplicate-archive guarded.

Ended trips stop appearing in suggestions immediately.

## Exit rules (enforced in-product)

Landing page promises *"anyone can leave the group ride at any time."* The app now enforces it:
- **Cancel request** (pending) / **Leave crew** (mutual) on match cards.
- Other side gets a live `match_cancelled` notification; their grid updates; open chat closes.

---

## Bugs fixed

| # | Issue | Fix |
| --- | --- | --- |
| 1–10 | (pre-Step-3: thread ownership, bot IDs, reply index, 401 redirect, chat loading state, form restore, race conditions, stale profiles, CORS) | See git history |
| 11 | `ai-rank` swallowed by `/api/matches/` wildcard | Route registered before wildcard |
| 12 | New matching trips needed manual refresh | `trip_published` WS push + live card flash |
| 13 | Gemini 2.5 rejects `additionalProperties` in responseSchema | Keyword removed; 4xx bodies surfaced in errors |
| 14 | Eval 429 cascade on free tier | Spacing + exponential backoff + versioned cache |
| 15 | Trips never ended; stayed matchable forever | Three end-paths + archive guards |
| 16 | No way to view previous rides | `rides` collection + history drawer |
| 17 | Leaked API key + wrong env name in README | Key rotated; `GEMINI_API_KEY` |
| 18 | WS token in sessionStorage | Removed; cookie-derived `/api/auth/token` only |
| 19 | Match card template split (empty pill, "Open chat" outside card) | Template replaced; dates humanized |
| 20 | Exit rules promised but not enforceable | Cancel/Leave + `match_cancelled` live event |
| 21 | Gemini keys in `.env` / `.env.example` | Placeholders only; keys must live in gitignored `.env` |
| 22 | Weak / default JWT secret | Server exits unless `JWT_SECRET` is 32+ chars and not a known placeholder |
| 23 | Unauthenticated `POST /api/mock/pay` | Login required; payer must own the reference and a pending deposit |
| 24 | Gemini API key in query string | Sent as `x-goog-api-key` header |
| 25 | Webhook HMAC compared with `!==` | `crypto.timingSafeEqual` + hex validation |
| 26 | Rate limit trusted client `X-Forwarded-For` | Used only when `TRUST_PROXY=true` |
| 27 | `skipDeposit` not exported / wrong handler order | Exported; all handlers defined before `router` |
| 28 | Gemini model defaults disagreed | All defaults are `gemini-2.0-flash` |
| 29 | README claimed AI F1 without current eval numbers | Documented v4 P=1.00 R=0.80 F1=0.89 vs det F1=0.91 |

---

## Coming next — Razorpay Trip Treasurer

Bounded, audited money loop on Razorpay test-mode: mutual match → ₹1,000 good-faith **Payment Links** in chat → `payment_link.paid` webhook (HMAC-verified) → "Crew locked in 🎉" → bounded nudges (≤2, 12h apart, 48h expiry) with a hard **stop rule**. AI never moves money; Python does.