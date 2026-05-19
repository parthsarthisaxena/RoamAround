# RoamCircle

Find compatible travel partners for motorcycle rides, road trips, hikes, and more.

---

## Step 1 — Prerequisites

- Node.js v18+ (`node -v` to check)
- MongoDB running locally **or** a free MongoDB Atlas cluster

### Start MongoDB locally (Mac/Linux)
```bash
# Install via Homebrew (Mac)
brew install mongodb-community
brew services start mongodb-community

# Or on Linux
sudo systemctl start mongod
```

### Or use MongoDB Atlas (cloud, free tier)
1. Go to https://www.mongodb.com/atlas
2. Create a free cluster
3. Get your connection string — looks like:
   `mongodb+srv://username:password@cluster.mongodb.net`

---

## Step 2 — Install dependencies

```bash
npm install
```

---

## Step 3 — Set environment variables

**Option A — inline (quick)**
```powershell
# Windows PowerShell
$env:MONGODB_URI="mongodb://127.0.0.1:27017"
$env:JWT_SECRET="any-long-random-string-here"
$env:OPENAI_API_KEY="sk-your-key-here"
npm start
```

```bash
# Mac / Linux
MONGODB_URI="mongodb://127.0.0.1:27017" \
JWT_SECRET="any-long-random-string-here" \
OPENAI_API_KEY="sk-your-key-here" \
npm start
```

**Option B — .env file**
```bash
cp .env.example .env
# Edit .env with your values
npm install dotenv
node -r dotenv/config server.js
```

---

## Step 4 — Open the app

```
http://localhost:3000
```

- Go to `/signup.html` — create an account
- Your credentials are saved to MongoDB with a hashed password
- A JWT cookie is set — you stay logged in for 7 days
- `/dashboard.html` redirects to login if you're not authenticated
- Log out clears the cookie

---

## What's stored in MongoDB

**Collection: `users`**
```json
{
  "_id": "ObjectId",
  "name": "Your Name",
  "email": "you@example.com",
  "password": "$2b$12$...(bcrypt hash)",
  "tripType": "motorcycle",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

## Auth flow summary

```
Signup/Login → bcrypt verify → JWT created → httpOnly cookie set
Every request → JWT decoded from cookie → user injected into request
Protected pages → server checks JWT → redirect to /login.html if missing
Log out → cookie cleared → JWT invalidated client-side
```

---

## Files

| File | Purpose |
|---|---|
| `server.js` | Node HTTP server — auth routes + static serving |
| `chat.js` | Chat panel, matches grid, request cards (client) |
| `script.js` | AI trip planner (client) |
| `styles.css` | Global Spotify-dark styles |
| `dashboard.css` | Dashboard component styles |
| `dashboard.html` | Main app — publish trip, requests, matches, chat |
| `login.html` | Login with real API call |
| `signup.html` | Signup with real API call |

---

## Coming next (Step 2)

- Store published trips in MongoDB
- Store accepted matches in MongoDB
- Store chat messages in MongoDB
- Real-time matching by route/destination

