# RoamCircle

Find compatible travel partners for motorcycle rides, road trips, hikes and more.

---

## Quick start

### 1. Prerequisites

- **Node.js v18+** — check with `node -v`
- **MongoDB** — local or Atlas (free tier)

**Start MongoDB locally:**
```bash
# Mac
brew services start mongodb-community

# Linux
sudo systemctl start mongod

# Windows — run in a separate terminal
mongod --dbpath C:\data\db
```

**Or use MongoDB Atlas (cloud, free):**
1. https://www.mongodb.com/atlas → create free cluster
2. Get your connection string:
   `mongodb+srv://user:pass@cluster.mongodb.net`

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Set environment variables and start

**Windows PowerShell:**
```powershell
$env:MONGODB_URI   = "mongodb://127.0.0.1:27017"
$env:JWT_SECRET    = "any-long-random-string-here"
$env:OPENAI_API_KEY= ""          # optional
npm start
```

**Mac / Linux:**
```bash
MONGODB_URI="mongodb://127.0.0.1:27017" \
JWT_SECRET="any-long-random-string-here" \
OPENAI_API_KEY="" \
npm start
```

**Or use a .env file:**
```bash
cp .env.example .env
# Edit .env, then:
npm install dotenv
node -r dotenv/config server.js
```

---

### 4. Open the app

```
http://localhost:3000
```

Go to `/signup.html` → create an account → you're in.

---

## File structure

| File | Purpose |
|---|---|
| `server.js` | Node HTTP server — all API routes + static file serving |
| `chat.js` | Client-side chat panel, matches grid, request cards |
| `script.js` | Client-side AI trip planner |
| `styles.css` | Global Spotify-dark styles |
| `dashboard.css` | Dashboard component styles |
| `dashboard.html` | Main app — publish trip, requests, matches, chat |
| `login.html` | Real login with API call + error messages |
| `signup.html` | Real signup with API call + validation |
| `profile-arjun.html` | Arjun's rider profile |
| `profile-priya.html` | Priya's rider profile |
| `profile-rohan.html` | Rohan's rider profile |
| `.env.example` | Environment variable template |

---

## MongoDB collections

| Collection | What's stored |
|---|---|
| `users` | Name, email, bcrypt password hash, trip type, created date |
| `trips` | Published trip per user (upserted — one per account) |
| `matches` | Accept/reject state per user + requester pair |
| `messages` | All chat messages, indexed by threadId + createdAt |

---

## API routes

### Auth
| Method | Route | Description |
|---|---|---|
| POST | `/api/auth/signup` | Create account, set JWT cookie |
| POST | `/api/auth/login` | Verify credentials, set JWT cookie |
| POST | `/api/auth/logout` | Clear JWT cookie |
| GET | `/api/auth/me` | Return current user from JWT |

### Trips
| Method | Route | Description |
|---|---|---|
| POST | `/api/trips` | Publish or update my trip |
| GET | `/api/trips/mine` | Fetch my saved trip |

### Matches
| Method | Route | Description |
|---|---|---|
| GET | `/api/matches` | Get all my accept/reject states |
| POST | `/api/matches/:requesterId` | Accept or reject a request |

### Messages
| Method | Route | Description |
|---|---|---|
| GET | `/api/messages/:threadId` | Get all messages in a thread |
| POST | `/api/messages/:threadId` | Send a message |

### AI
| Method | Route | Description |
|---|---|---|
| POST | `/api/itinerary` | Generate AI trip plan (auth required) |

---

## Auth flow

```
Signup/Login
  → bcrypt hash verified
  → JWT signed (7 day expiry)
  → httpOnly cookie set (not readable by JS)

Every page load
  → Server reads JWT from cookie
  → Protected pages redirect to /login.html if no valid token

Logout
  → Cookie cleared
  → Client redirects to index
```

---

## Security notes

- Passwords hashed with bcrypt (12 salt rounds)
- JWT stored in `httpOnly` cookie — XSS safe
- `sameSite: lax` on cookie — CSRF protected
- Thread IDs validated by ownership — users can only read their own messages
- Bot/demo replies stored under `bot_{id}` prefix — never collide with real user IDs
- CORS headers set on all responses — configurable via `CORS_ORIGIN` env var
- Protected pages (`dashboard.html`, all profiles) server-side redirect if unauthenticated

---

## Bugs fixed (pre-Step 3)

| # | Issue | Fix |
|---|---|---|
| 1 | Thread ID security hole | Strict `{ownerId}_` prefix ownership check |
| 2 | Bot replies stored as user's ID | `botSender` param → stored as `bot_{id}` |
| 3 | Reply index reset on re-login | Index derived from DB bot message count |
| 4 | Expired session showed generic error | 401 includes `{ redirect }`, client navigates |
| 5 | No loading state when chat opens | Spinner shown before DB fetch completes |
| 6 | Form fields blank after page reload | Trip data from DB repopulates form inputs |
| 7 | Race condition on userId resolution | `wireCards()` awaits `getMyUserId()` first |
| 8 | Old Bali profiles in project | `profile-lea/maya/jun.html` deleted |
| 9 | Old profiles not auth-protected | Added to `PROTECTED_PAGES` list |
| 10 | No CORS headers | `setCORS()` on all responses + OPTIONS handler |

---

## Coming next — Step 3: Real matching

- Query `trips` collection for users heading to the same destination
- Show real registered users in request cards (not demo data)
- Calculate match score from pace, budget, habits, date overlap
- Mutual matching — both sides must accept


---

## Step 3 — Real matching (current)

### New API routes

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/matches/suggestions` | Real users going same destination, ranked by score |
| `GET` | `/api/matches/mutual` | Both sides accepted each other |
| `GET` | `/api/trips/search?to=ladakh` | Search trips by destination |

### Match score algorithm (0–100 pts)

| Factor | Max pts | How |
|---|---|---|
| Date overlap | 30 | Proportional to how many days overlap with your trip |
| Pace match | 25 | Exact=25, one step apart=12, opposite=0 |
| Budget match | 25 | Exact=25, one step apart=12, opposite=0 |
| Habit overlap | 20 | Jaccard similarity of habit keywords |

### How real matching works

1. You publish your trip (destination stored as `toLower` for case-insensitive search)
2. `GET /api/matches/suggestions` queries `trips` where `toLower` matches yours
3. Scores each candidate and returns ranked list (max 20)
4. Already decided (accepted/rejected) users are excluded
5. Real rider cards appear above demo cards in the request list
6. Accepting a real user stores state in `matches` with `requesterType: "user"`
7. `GET /api/matches/mutual` checks both sides accepted — required before real chat

### Mutual matching
- Accepting a **demo** traveler opens chat immediately (they always accept back)
- Accepting a **real** user shows "Waiting for their accept" until mutual
- Both sides must accept before a shared chat thread is usable in Step 4

### New DB fields
- `trips.toLower` — lowercased destination for case-insensitive matching
- `matches.requesterType` — `"demo"` or `"user"` for easy filtering

### Coming next — Step 4
- Real-time notifications when someone accepts you back
- Real user chat (mutual matches open a live thread)
- Profile photo uploads
- Push notifications via WebSocket


---

## Step 4 — Real-time WebSocket (current)

### New dependency

```bash
npm install   # picks up "ws" from package.json
```

### How the WebSocket works

```
Login/Signup
  → server returns JWT in response body
  → client stores in sessionStorage("rc_ws_token")
  → dashboard picks it up, calls RC_setWsToken(token)
  → realtime.js opens ws://localhost:3000/ws?token=<jwt>
  → server verifies JWT, registers userId → WebSocket connection
  → heartbeat ping/pong every 25s keeps connection alive
  → auto-reconnect with exponential backoff (1s → 2s → 4s → 30s max)
```

### Events pushed from server → client

| Event | When | Payload |
|---|---|---|
| `connected` | On WS open | `{ userId, name }` |
| `match_request` | Someone accepts you | `{ from, fromName, requesterId }` |
| `match_accepted` | Mutual match confirmed | `{ from, fromName, requesterId }` |
| `new_message` | Message arrives in thread | `{ threadId, from, fromName, text, ts }` |
| `pong` | Response to client ping | `{}` |

### Notification bell

- Bell icon in topbar with unread count badge
- Green dot = connected, grey dot = reconnecting
- Dropdown lists up to 20 recent notifications
- Clicking a notification navigates to the relevant section
- Browser push notification shown if permission granted
- Badge pulses red when unread count > 0

### New file: `realtime.js`

Load order in dashboard.html:
```html
<script src="realtime.js"></script>  <!-- WS + notifications -->
<script src="script.js"></script>    <!-- AI planner -->
<script src="chat.js"></script>      <!-- Chat + matches -->
```

`realtime.js` exposes:
- `window.RC_setWsToken(token)` — called after login to start connection
- `window.RC_WS.send(event)` — send a raw event to server
- `window.RC_WS.isConnected()` — check connection state
- `window._rcActiveThread` — set by chat.js so realtime.js skips notifications for open thread

  
