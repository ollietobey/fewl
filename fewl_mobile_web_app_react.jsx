// Fewl - Production-Ready Full Stack (Secure + Auth + Caching + Deployment)

// ================= ENV SETUP =================

/*
Create .env (DO NOT COMMIT):

FUEL_API_CLIENT_ID=your_client_id
FUEL_API_SECRET=your_secret
PORT=3001
*/

require("dotenv").config();

// ================= BACKEND (Node.js + Express + Secure OAuth + Cache) =================

const express = require("express");
const fetch = require("node-fetch");
const app = express();

app.use(express.json());

let cachedToken = null;
let tokenExpiry = 0;
let stationCache = {};

// ================= OAuth Token (cached) =================

async function getAccessToken() {
  const now = Date.now();

  if (cachedToken && now < tokenExpiry) {
    return cachedToken;
  }

  const res = await fetch("https://api.fuelfinder.gov.uk/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: `grant_type=client_credentials&client_id=${process.env.FUEL_API_CLIENT_ID}&client_secret=${process.env.FUEL_API_SECRET}`,
  });

  const data = await res.json();

  cachedToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000 - 60000; // refresh 1 min early

  return cachedToken;
}

// ================= Fuel Data Fetch (cached per location) =================

async function getFuelData(lat, lng) {
  const cacheKey = `${lat}:${lng}`;
  const now = Date.now();

  if (stationCache[cacheKey] && now - stationCache[cacheKey].time < 300000) {
    return stationCache[cacheKey].data;
  }

  const token = await getAccessToken();

  const res = await fetch(
    `https://api.fuelfinder.gov.uk/v1/stations?lat=${lat}&lng=${lng}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const data = await res.json();

  const stations = data.stations.map((s) => ({
    id: s.site_id,
    name: s.brand,
    lat: s.location.latitude,
    lng: s.location.longitude,
    price: s.prices?.E10 || s.prices?.B7 || null,
    updatedAt: s.last_updated,
    inStock: true,
  }));

  stationCache[cacheKey] = { data: stations, time: now };

  return stations;
}

// ================= In-memory report system =================

let reports = {};

function applyReports(stations) {
  return stations.map((s) => {
    const r = reports[s.id] || [];

    const score = r.reduce((acc, val) => acc + (val ? 1 : -1), 0);

    return {
      ...s,
      inStock: score >= 0,
      confidence: r.length ? Math.min(Math.abs(score) / r.length, 1) : 0,
    };
  });
}

// ================= API Routes =================

app.get("/api/stations", async (req, res) => {
  const { lat, lng } = req.query;

  const stations = await getFuelData(lat, lng);
  const enriched = applyReports(stations);

  res.json(enriched);
});

app.post("/api/report", (req, res) => {
  const { stationId, inStock } = req.body;

  if (!reports[stationId]) reports[stationId] = [];

  reports[stationId].push(inStock);

  res.json({ success: true });
});

// ================= Basic Rate Limiting =================

let requestCounts = {};

app.use((req, res, next) => {
  const ip = req.ip;
  requestCounts[ip] = (requestCounts[ip] || 0) + 1;

  if (requestCounts[ip] > 100) {
    return res.status(429).send("Too many requests");
  }

  setTimeout(() => {
    requestCounts[ip]--;
  }, 60000);

  next();
});

// ================= START SERVER =================

app.listen(process.env.PORT || 3001, () => {
  console.log("Fewl API running");
});

// ================= FRONTEND NOTES =================

/*
- Keep using your existing React app
- Calls /api/stations with lat/lng
- Calls /api/report for stock updates
*/

// ================= DEPLOYMENT =================

/*
1. Backend (Railway):
   - Add environment variables in dashboard
   - Deploy from GitHub

2. Frontend (Vercel):
   - Set API URL: https://your-backend.up.railway.app

3. Security:
   - NEVER expose .env
   - Enable HTTPS (default on Vercel/Railway)
*/

// ================= NEXT LEVEL =================

/*
- Replace memory cache with Redis
- Replace reports with database (PostgreSQL)
- Add user authentication (Firebase Auth)
- Add push notifications
- Turn into PWA (installable app)
*/