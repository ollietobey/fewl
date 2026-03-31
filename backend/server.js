require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let cachedToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiry) return cachedToken;

  const res = await fetch("https://api.fuelfinder.gov.uk/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${process.env.FUEL_API_CLIENT_ID}&client_secret=${process.env.FUEL_API_SECRET}`
  });

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = now + data.expires_in * 1000 - 60000;

  return cachedToken;
}

app.get("/api/stations", async (req, res) => {
  const { lat, lng } = req.query;

  try {
    const token = await getAccessToken();

    const response = await fetch(
      `https://api.fuelfinder.gov.uk/v1/stations?lat=${lat}&lng=${lng}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await response.json();

    const stations = data.stations.map((s) => ({
      id: s.site_id,
      name: s.brand,
      price: s.prices?.E10 || s.prices?.B7 || null,
      lat: s.location.latitude,
      lng: s.location.longitude,
      updatedAt: s.last_updated
    }));

    res.json(stations);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching fuel data");
  }
});

app.listen(process.env.PORT || 3001, () => {
  console.log("Fewl backend running");
});
