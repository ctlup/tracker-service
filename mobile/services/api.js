// services/api.js
//
// All HTTP communication with the tracker backend lives in this file.
// Pulls the API base URL from app.json's extra.apiBase so it can be swapped per environment
// without code changes.
//
// IMPORTANT for Android emulator users: the host machine's localhost is reachable at
// http://10.0.2.2:8080 from inside the emulator. iOS simulator uses http://localhost:8080.
// On a physical device, set extra.apiBase to your laptop's LAN IP, e.g. http://192.168.1.42:8080.

import Constants from 'expo-constants';

const API_BASE =
  Constants.expoConfig?.extra?.apiBase ||
  Constants.manifest?.extra?.apiBase ||
  'http://10.0.2.2:8080';

async function parseOrThrow(res) {
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const msg = body?.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function registerDevice({ deviceId, name, type }) {
  const res = await fetch(`${API_BASE}/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deviceId, name, type }),
  });
  return parseOrThrow(res);
}

export async function postLocation({ apiKey, lat, lng, speed, timestamp }) {
  const res = await fetch(`${API_BASE}/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ lat, lng, speed, timestamp }),
  });
  return parseOrThrow(res);
}

export async function getHistory(deviceId, limit = 100) {
  const res = await fetch(
    `${API_BASE}/location/${encodeURIComponent(deviceId)}/history?limit=${limit}`
  );
  return parseOrThrow(res);
}

export { API_BASE };
