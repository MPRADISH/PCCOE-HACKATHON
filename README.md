# JalMitra — AI Groundwater & Irrigation Advisory Platform

> **जलमित्र** · जल है तो कल है · पाण्याची काळजी, शेताची समृद्धी

An AI-powered, multilingual Progressive Web App (PWA) for Maharashtra smallholder farmers, providing real-time groundwater monitoring, soil moisture advisories, and vernacular SMS/WhatsApp irrigation recommendations — optimised for intermittent 2G rural connectivity.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🗺️ **Interactive Stress Heat Map** | Real-time taluka-level groundwater & soil moisture visualisation across 16 Maharashtra talukas across 4 regions (Marathwada, Vidarbha, Western MH, Khandesh) |
| 🌱 **AI Irrigation Advisory** | Gemini AI–generated vernacular advisories per taluka, crop, field size, and irrigation method — grounded in KVK citations |
| 📱 **SMS / WhatsApp Gateway** | One-click dispatch of bilingual advisories to individual farmers or entire taluka cohorts with delivery receipt logs |
| 🩺 **Crop Disease Diagnostic** | AI image analysis of crop photos (Gemini Vision) with multilingual diagnosis reports |
| 📅 **Crop Climate Calendar** | 14-crop Kharif/Rabi seasonal schedule with climate-adjusted sowing, irrigation, and harvest windows |
| 🌧️ **Monsoon Countdown Tracker** | IMD-calibrated monsoon arrival countdown with live probability bands |
| 🏘️ **Village Water Committee Portal** | Community-level water budget reports, PDF export, and collective advisory dispatch |
| 📶 **Offline PWA** | Full offline advisory caching via Service Worker + CacheStorage + localStorage — works at 2G / zero connectivity |
| 🌐 **Trilingual UI** | Complete English / मराठी / हिन्दी localisation across all 4 sections |

---

## 🛠️ Tech Stack

**Frontend**
- React 19 + TypeScript
- Vite 8 (bundler) + `@tailwindcss/vite` (Tailwind CSS v4)
- Recharts 3 (data visualisation)
- Motion 12 (animations)
- Lucide React (icons)
- `vite-plugin-pwa` (Service Worker + Web App Manifest)

**Backend**
- Express.js 4 (TypeScript, `tsx` runner)
- `@google/genai` SDK (Gemini 2.0 Flash — advisory generation + image analysis)
- In-memory data store (pilot; swap to Firestore/PostgreSQL for production)

**Infrastructure / PWA**
- Custom Service Worker (`public/jalmitra-sw.js`) — CacheStorage + stale-while-revalidate
- Workbox (via `vite-plugin-pwa`) — precaching + runtime caching
- Web App Manifest — installable standalone PWA on Android & iOS

---

## 📋 Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | ≥ 20 LTS | Required |
| npm | ≥ 10 | Bundled with Node |
| Gemini API Key | — | [Get one free at Google AI Studio](https://aistudio.google.com/app/apikey) |

---

## 🚀 Setup & Running

### 1. Clone & Install

```bash
git clone https://github.com/DOCTOR-DOOM1/PCCOE-HACKATHON.git
cd PCCOE-HACKATHON
npm install
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and add your Gemini API key:

```dotenv
GEMINI_API_KEY=your_actual_gemini_api_key_here
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:3000
PORT=3001
NODE_ENV=development
```

> **Get a free Gemini API key:** https://aistudio.google.com/app/apikey

### 3. Run in Development Mode

You need **two terminals** (or use a process manager like `concurrently`):

**Terminal 1 — Express API server** (port 3001):
```bash
npm run server
```

**Terminal 2 — Vite dev server** (port 3000):
```bash
npm run dev
```

Then open **http://localhost:3000** in your browser.

### 4. Build for Production

```bash
npm run build        # Outputs to dist/
npm run preview      # Preview the production build locally
```

To run the production API server:
```bash
npm run server:start
```

---

## 🌐 API Endpoints (Express, port 3001)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/advisory` | Generate Gemini AI irrigation advisory for a taluka |
| `POST` | `/api/diagnostic` | AI crop disease diagnosis from base64 image |
| `POST` | `/api/notification/dispatch` | Dispatch SMS/WhatsApp advisory (simulated) |
| `GET`  | `/api/notification/logs` | Fetch recent dispatch delivery logs |
| `POST` | `/api/telemetry` | Record client-side events |
| `POST` | `/api/committee/report` | Generate village water committee report |
| `GET`  | `/api/committee/report/:id` | Fetch a generated committee report |

---

## 🏗️ Project Architecture

```
PCCOE-HACKATHON/
├── public/
│   ├── jalmitra-sw.js          # Custom Service Worker (offline caching)
│   ├── icon.svg                # App icon
│   └── *.png                   # PWA icons (192, 512, maskable)
│
├── src/
│   ├── App.tsx                 # Root app shell — language switcher, 4-section nav
│   ├── main.tsx                # React 19 entry point
│   ├── index.css               # Tailwind v4 + custom CSS vars (fonts, colors)
│   │
│   ├── components/
│   │   ├── HeatMapSection.tsx           # Section 1: Interactive taluka heat map + advisory + SMS gateway
│   │   ├── CropClimateCalendarSection.tsx # Section 2: Seasonal crop calendar
│   │   ├── CropDiagnosticSection.tsx    # Section 3: AI crop disease diagnostics
│   │   ├── VillageCommitteeSection.tsx  # Section 4: Village water committee portal
│   │   ├── GeminiAdvisoryPanel.tsx      # Reusable Gemini advisory fetch panel
│   │   ├── MonsoonCountdownTracker.tsx  # Monsoon arrival countdown widget
│   │   ├── NotificationLog.tsx          # SMS/WhatsApp delivery log display
│   │   └── PWAOfflineManager.tsx        # PWA install prompt + offline status banner
│   │
│   ├── data/
│   │   ├── maharashtraData.ts    # 16 taluka records with live sensor data + 3 diagnostic samples
│   │   └── translations.ts       # Full EN / MR / HI UI string catalogue
│   │
│   └── utils/
│       ├── waterEngine.ts          # Core calculation engine (1200+ lines, pure functions)
│       ├── apiClient.ts            # Frontend ↔ backend API calls
│       ├── offlineAdvisoryCache.ts # Offline snapshot builder + CacheStorage persistence
│       └── usePWAInstall.ts        # PWA install prompt hook + online status hook
│
├── server/
│   ├── index.ts                # Express entry — CORS, middleware, route mounting
│   ├── routes/
│   │   ├── advisory.ts         # POST /api/advisory
│   │   ├── diagnostic.ts       # POST /api/diagnostic
│   │   ├── notification.ts     # POST/GET /api/notification/*
│   │   ├── telemetry.ts        # POST /api/telemetry
│   │   └── committee.ts        # POST/GET /api/committee/*
│   ├── services/
│   │   ├── gemini.ts           # Gemini AI wrapper (advisory + vision)
│   │   └── notificationService.ts # Simulated SMS/WhatsApp dispatch
│   └── store/
│       └── index.ts            # In-memory log/report store
│
├── vite.config.ts              # Vite + PWA plugin config (proxy /api → :3001)
├── tsconfig.json               # TypeScript config (ESNext, bundler moduleResolution)
├── package.json
├── .env.example                # Environment variable template
└── .env                        # Your local env vars (not committed to git)
```

---

## 🌏 Supported Languages

| Code | Language | Script |
|---|---|---|
| `en` | English | Latin |
| `mr` | Marathi (मराठी) | Devanagari |
| `hi` | Hindi (हिन्दी) | Devanagari |

The language switcher in the top-right corner of the app switches all UI strings, advisories, and notification payloads simultaneously.

---

## 📡 Offline Capability

JalMitra is designed for rural India's patchy connectivity:

1. **On first load** (online): All app assets are precached by the Service Worker
2. **On taluka selection**: An advisory snapshot for all 16 talukas is saved to both `CacheStorage` and `localStorage`
3. **On subsequent visits** (offline): The Service Worker serves assets from cache; advisories load from `localStorage` instantly
4. **Cache retention**: Advisory data is retained for **30 days** offline

---

## 🔑 Environment Variables Reference

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | — | Google Gemini AI API key |
| `APP_URL` | No | `http://localhost:3000` | Frontend app URL (for CORS) |
| `FRONTEND_URL` | No | `http://localhost:3000` | Same as APP_URL |
| `PORT` | No | `3001` | Express server port |
| `NODE_ENV` | No | `development` | `development` or `production` |

---

## 🧪 Testing

Type-check the entire codebase:

```bash
npm run lint
```

Run the water engine unit tests:

```bash
# (Add a test runner like vitest if needed)
npx vitest src/utils/waterEngine.test.ts
```

---

## 📊 Covered Regions & Talukas

| Region | Talukas |
|---|---|
| **Marathwada** | Latur, Osmanabad, Nanded, Beed, Aurangabad |
| **Vidarbha** | Nagpur, Amravati, Wardha, Yavatmal |
| **Western Maharashtra** | Pune, Nashik, Kolhapur, Sangli |
| **Khandesh** | Jalgaon, Dhule, Nandurbar |

---

## 🏆 Hackathon Context

Built for **PCCOE Hackathon 2025** — Theme: *AI for Rural Livelihoods*.

**Problem statement:** Maharashtra smallholder farmers (avg. 1.5–3 acres) lack access to real-time, vernacular groundwater and soil advisory data, leading to over-irrigation, aquifer depletion, and crop losses.

**Solution:** JalMitra bridges the precision-agriculture data gap with:
- AI-generated advisories grounded in KVK (Krishi Vigyan Kendra) research citations
- SMS/WhatsApp delivery for feature-phone farmers
- Offline-first PWA for 2G/zero-connectivity rural areas
- Multilingual support (Marathi, Hindi, English)

---

## 📝 License

MIT — Free for educational and non-commercial use.

---

*Built with ❤️ for Maharashtra farmers — जलमित्र*
