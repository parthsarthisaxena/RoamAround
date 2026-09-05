# 🏍️ RoamAround

<div align="center">

[![Live Demo](https://img.shields.io/badge/Live%20Demo-roamaround--ivory.vercel.app-brightgreen?style=for-the-badge&logo=vercel)](https://roamaround-ivory.vercel.app/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%2F%20Local-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Gemini AI](https://img.shields.io/badge/Google%20Gemini-2.0%20Flash-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Realtime-010101?style=for-the-badge&logo=socketdotio&logoColor=white)](https://github.com/websockets/ws)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)

<p align="center">
  <strong>Find compatible travel partners for motorcycle rides, road trips, hikes, and outdoor adventures.</strong><br>
  Publish your trip, get matched by route / pace / habits, coordinate in real time, split expenses, and ride together safely.
</p>

[**Explore Live Website 🚀**](https://roamaround-ivory.vercel.app/) • [**Quick Start ⚡**](#-quick-start) • [**Features ✨**](#-core-features) • [**Architecture 🏛️**](#-architecture--file-structure) • [**API Reference 📡**](#-api-routes)

</div>

---

## 🌐 Live Reference & Deployment

The latest version of **RoamAround** is deployed and accessible at:
👉 **[https://roamaround-ivory.vercel.app/](https://roamaround-ivory.vercel.app/)**

> 💡 **Tip:** You can sign up with demo accounts or test route matching between cities (e.g., Delhi/Pune to Ladakh/Manali) to experience real-time matching, AI itinerary generation, and live WebSocket chat.

---

## 🌟 What is RoamAround?

RoamAround solves the fragmented and risky experience of finding travel companions for road trips, motorcycle rides, and adventures. 

Unlike generic social apps, RoamAround pairs travelers based on **destination convergence** (even from different starting locations), **riding pace**, **budget**, **travel habits**, and **AI-analyzed personality vibes**.

Built with an emphasis on **safety**, **transparency**, and **honest AI evaluation**, RoamAround includes real-time group coordination, integrated expense splitting, emergency SOS toolkits, and post-trip reputation reviews.

---

## ✨ Core Features

### 1. 🤖 Dual Matching Engine (Deterministic + Gemini AI)
- **Deterministic Compatibility Engine (0–100 pts):** Evaluates date overlap, riding pace, budget brackets, and Jaccard similarity of travel habits.
- **AI Vibe Matcher (Gemini 2.0 Flash):** Analyzes rider bios and travel styles with schema-enforced JSON (`vibe_score`, `match`, `reasoning`).
- **Graceful Fallbacks & Audit Trails:** Every AI decision is logged in MongoDB. If quota or network limits occur, the system automatically falls back to deterministic scoring without disrupting user experience.

### 2. 🗺️ AI Trip Planner & Interactive Maps
- Day-by-day intelligent itinerary planning generated with Google Gemini 2.0.
- Interactive Leaflet route visualization, meet-up pins, and day cards.

### 3. 💬 Real-Time Chat & Coordination
- WebSocket-backed messaging (`ws`) with instant delivery, active presence, and live notification bells.
- Instant alert pushes for match requests, acceptance, and cancellation.

### 4. 🛡️ Rider Safety & SOS Toolkit
- Emergency contact alerts and one-tap SOS broadcast.
- Check-in reminders and verified community profiles.
- Strict exit rules: riders can leave a crew at any time with instant live notifications.

### 5. 💰 Trip Expenses & Good-Faith Deposits
- Built-in expense logger & splitter for fuel, food, and stays.
- Razorpay Trip Treasurer integration with HMAC-verified payment links for locking in crew commitments.

### 6. 📱 PWA & Modern UI / UX
- Progressive Web App installable on mobile and desktop devices.
- Seamless Dark & Light themes, fluid CSS micro-animations, and zero heavyweight framework bloat.

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** v18+ (`node -v`)
- **MongoDB** (Local instance or MongoDB Atlas connection string)
- **Gemini API Key** *(Optional, for AI planner & AI vibe matching)*

### 2. Installation

Clone the repository and install dependencies:
```bash
git clone https://github.com/parthsarthisaxena/RoamAround.git
cd RoamAround
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory (based on `.env.example`):
```env
PORT=3000
MONGODB_URI=mongodb://127.0.0.1:27017/roamaround
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-2.0-flash
CORS_ORIGINS=https://roamaround-ivory.vercel.app,http://localhost:3000
```

> ⚠️ **Security Notice:** Never commit secrets or API keys. Always use `.env` (which is excluded in `.gitignore`).

### 4. Run Locally

```bash
# Start server in production mode
npm start

# Or start in watch/development mode
npm run dev
```

Visit [`http://localhost:3000`](http://localhost:3000) in your browser.

---

## 🏛️ Architecture & File Structure

```
RoamAround/
├── server.js               # Express + WebSocket HTTP server & API routes
├── scoring.js              # Deterministic compatibility algorithm
├── ai_matcher.js           # Gemini AI vibe matching engine + fallback logic
├── deposits.js             # Razorpay Trip Treasurer & payment webhooks
├── script.js               # Client AI itinerary planner & UI logic
├── chat.js                 # Chat interface, matches grid, & ride history
├── realtime.js             # WebSocket client connection & notification badges
├── safety.js               # Emergency contacts, SOS alerts, & safety tools
├── expenses.js             # Expense splitter & group budgeting
├── ratings.js              # Mutual rider ratings & review modal
├── map.js                  # Leaflet map rendering & route markers
├── theme.js                # Dark / Light theme switch handler
├── pwa.js / sw.js          # Service worker & PWA manifest caching
├── styles.css              # Global styles & responsive components
├── dashboard.css           # Dashboard layout & widget styles
├── eval/                   # AI evaluation harness & calibration dataset
│   ├── run_eval.js         # Benchmark test script
│   ├── pairs.json          # Labeled rider pairs
│   └── profiles.json       # Seed evaluation profiles
└── package.json            # Dependencies & scripts
```

---

## 📡 API Routes

### 🔐 Authentication
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | Register new rider, set secure `httpOnly` JWT cookie |
| `POST` | `/api/auth/login` | Authenticate user, issue cookie |
| `POST` | `/api/auth/logout` | Clear auth session |
| `GET` | `/api/auth/me` | Fetch authenticated user data |
| `GET` | `/api/auth/token` | Obtain short-lived WebSocket auth token |

### 👤 Profile & Reviews
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/users/:id` | View public rider profile (with privacy filters) |
| `GET` / `POST` | `/api/profile` | Read or update personal profile |
| `GET` / `POST` | `/api/users/:id/reviews` | View or submit rider reviews (mutual match required) |

### 🛣️ Trips & History
| Method | Route | Description |
| :--- | :--- | :--- |
| `POST` | `/api/trips` | Publish or update live trip |
| `GET` | `/api/trips/mine` | Retrieve active trip details |
| `GET` | `/api/trips/search?to=` | Search trips by destination |
| `GET` | `/api/rides` | View archived ride history & past crews |
| `POST` | `/api/rides/end` | Manually complete and archive active trip |

### 🤝 Matching & AI
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/matches/suggestions` | Suggested route matches ranked by compatibility |
| `POST` | `/api/matches/ai-rank` | Run Gemini AI vibe ranking on candidates |
| `POST` | `/api/matches/:requesterId` | Accept, reject, or cancel match requests |
| `GET` | `/api/matches/mutual` | Fetch all mutual ride companions |
| `POST` | `/api/itinerary` | Generate AI day-by-day trip itinerary |
| `POST` | `/api/ai/suggest` | AI-assisted bio & preferences writer |

### 💬 Messages & Payments
| Method | Route | Description |
| :--- | :--- | :--- |
| `GET` / `POST` | `/api/messages/:threadId` | Paginated chat message history and sending |
| `POST` | `/api/mock/pay` | Mock checkout verification for testing |
| `POST` | `/api/razorpay/webhook` | HMAC-verified payment confirmation webhook |

---

## 📊 AI Calibration & Evaluation Harness

Run the evaluation harness to compare deterministic scoring against the AI vibe matcher:

```bash
npm run eval
```

### Benchmark Metrics (Seed Dataset)

| Model / Version | Precision | Recall | F1 Score | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Deterministic Baseline** | `0.83` | `1.00` | `0.91` | High recall; occasional safety mismatch (e.g. relaxed vs 400km/day rider) |
| **AI Prompt v1** | `1.00` | `0.60` | `0.75` | Overly restrictive |
| **AI Prompt v2** | `0.63` | `1.00` | `0.77` | Overly lenient on speed preferences |
| **AI Prompt v4 (Current)** | `1.00` | `0.80` | **`0.89`** | **Zero false positives on safety-critical constraints** |

> **Safety-First Philosophy:** On a remote mountain pass or multi-day highway tour, a false positive pairing is a physical safety concern. We prioritize high precision (`1.00`) to guarantee trusted, compatible crews.

---

## 🔒 Security & Best Practices

- **Cookie-Based JWT:** Stored in `httpOnly`, `SameSite=Lax` cookies to prevent XSS exfiltration.
- **Secure WebSockets:** Token-based handshake via `/api/auth/token` without exposing tokens in query logs or localStorage.
- **Cryptographic Timing Safety:** Webhook signatures validated using `crypto.timingSafeEqual`.
- **Input Sanitization & Validation:** Strict MongoDB query parsing, rate-limiting on sensitive endpoints, and bounded payloads.

---

## 📄 License

Distributed under the [MIT License](LICENSE). Built with ❤️ for adventurers, bikers, and road-trippers everywhere.

<div align="center">
  <sub>Check out the live app at <a href="https://roamaround-ivory.vercel.app/">roamaround-ivory.vercel.app</a></sub>
</div>