// scripts/seed.mjs
//
// Simulates a moving device by posting GPS pings every 2 seconds.
// On first run it registers a fresh device; subsequent runs reuse the same deviceId
// so the same row in the devices collection accumulates more locations.
//
// Usage:  node scripts/seed.mjs
// Stop with Ctrl+C.
//
// Env:
//   API_BASE       default http://localhost:8080
//   SEED_DEVICE_ID default seed-device-001
//   SEED_NAME      default Seed Bike
//   SEED_TYPE      default cyclist
//   SEED_INTERVAL  default 2000 (ms)

const API_BASE = process.env.API_BASE || 'http://localhost:8080';
const DEVICE_ID = process.env.SEED_DEVICE_ID || 'seed-device-001';
const NAME = process.env.SEED_NAME || 'Seed Bike';
const TYPE = process.env.SEED_TYPE || 'cyclist';
const INTERVAL_MS = parseInt(process.env.SEED_INTERVAL, 10) || 2000;

// Start in central Rome and walk slightly with each ping.
let lat = 41.9028;
let lng = 12.4964;

function nudge(value) {
  // ~1e-4 degrees ≈ 11m, so this drifts realistically for a slow vehicle.
  return value + (Math.random() - 0.5) * 0.0002;
}

async function registerDevice() {
  const res = await fetch(`${API_BASE}/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId: DEVICE_ID, name: NAME, type: TYPE }),
  });

  if (!res.ok) {
    throw new Error(`register failed: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  console.log(`[seed] registered deviceId=${body.deviceId} apiKey=${body.apiKey.slice(0, 8)}...`);
  return body.apiKey;
}

async function sendPing(apiKey) {
  lat = nudge(lat);
  lng = nudge(lng);
  const speed = +(Math.random() * 10).toFixed(2);

  const res = await fetch(`${API_BASE}/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ lat, lng, speed }),
  });

  if (!res.ok) {
    console.error(`[seed] ping failed: ${res.status} ${await res.text()}`);
    return;
  }

  console.log(
    `[seed] sent → lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} speed=${speed}`
  );
}

async function main() {
  console.log(`[seed] target=${API_BASE}, deviceId=${DEVICE_ID}, interval=${INTERVAL_MS}ms`);
  const apiKey = await registerDevice();

  // Send one immediately so the user sees something on screen right away.
  await sendPing(apiKey);

  setInterval(() => {
    sendPing(apiKey).catch((err) => console.error(`[seed] ${err.message}`));
  }, INTERVAL_MS);
}

main().catch((err) => {
  console.error(`[seed] fatal: ${err.message}`);
  process.exit(1);
});
