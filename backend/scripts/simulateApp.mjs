// scripts/simulateApp.mjs
//
// Pure Node script that mimics what the Expo app does so the full pipeline
// (registration → API key → GPS pings → MongoDB) can be tested without a phone.
//
// Flow, mirroring the mobile app:
//   1. Generate a deviceId (or reuse one from env).
//   2. POST /devices/register with name + type + deviceId.
//   3. Keep the returned apiKey in memory (analogous to expo-secure-store).
//   4. Every 2 seconds, POST /location with x-api-key header.
//
// Usage:  node scripts/simulateApp.mjs
// Stop with Ctrl+C.
//
// Env:
//   API_BASE      default http://localhost:8080
//   APP_NAME      default Simulated Phone
//   APP_TYPE      default car
//   APP_INTERVAL  default 2000
//   APP_DEVICE_ID default sim-app-<random>

import { randomUUID } from 'node:crypto';

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const NAME = process.env.APP_NAME || 'Simulated Phone';
const TYPE = process.env.APP_TYPE || 'car';
const INTERVAL_MS = parseInt(process.env.APP_INTERVAL, 10) || 2000;
const DEVICE_ID = process.env.APP_DEVICE_ID || `sim-app-${randomUUID().slice(0, 8)}`;

// Held in memory only — same lifetime semantics as expo-secure-store on a single session.
let apiKey = null;

// Start somewhere in Rome and drift each tick. This is what watchPositionAsync
// would feed us in real life: small, frequent deltas.
let lat = 41.9028;
let lng = 12.4964;
let speed = 0;

function step() {
  // A small jitter that loosely resembles a slow car.
  const dLat = (Math.random() - 0.5) * 0.0003;
  const dLng = (Math.random() - 0.5) * 0.0003;
  lat += dLat;
  lng += dLng;
  // Convert the magnitude of movement into a rough m/s — purely for telemetry realism.
  speed = +(Math.sqrt(dLat * dLat + dLng * dLng) * 111000 / 2).toFixed(2);
}

async function register() {
  console.log(`[app] registering deviceId=${DEVICE_ID} name="${NAME}" type=${TYPE}`);
  const res = await fetch(`${API_BASE}/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: DEVICE_ID, name: NAME, type: TYPE }),
  });

  if (!res.ok) {
    throw new Error(`register failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  apiKey = body.apiKey;
  console.log(`[app] registered. apiKey=${apiKey.slice(0, 8)}... (kept in memory)`);
}

async function sendPing() {
  step();
  try {
    const res = await fetch(`${API_BASE}/location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ lat, lng, speed }),
    });

    if (!res.ok) {
      console.error(`[app] ping failed: ${res.status} ${await res.text()}`);
      return;
    }

    console.log(
      `[app] ping → lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} speed=${speed}`
    );
  } catch (err) {
    // Mirrors the mobile app's behaviour: log the failure but keep tracking.
    console.error(`[app] network error: ${err.message}`);
  }
}

async function main() {
  console.log(`[app] target=${API_BASE}, interval=${INTERVAL_MS}ms`);
  await register();

  await sendPing();
  setInterval(sendPing, INTERVAL_MS);
}

main().catch((err) => {
  console.error(`[app] fatal: ${err.message}`);
  process.exit(1);
});
