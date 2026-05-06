// services/storage.js
//
// Thin wrapper around expo-secure-store. Two values live here:
//   - deviceId: stable per-install identifier we send to the backend on register.
//   - apiKey:   per-device key the backend issued; required on every /location ping.
//
// Both keys are namespaced so they don't collide with anything else the app might use.

import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';

const KEY_DEVICE_ID = 'tracker.deviceId';
const KEY_API_KEY = 'tracker.apiKey';
const KEY_PROFILE = 'tracker.profile'; // {name, type}

export async function getOrCreateDeviceId() {
  const existing = await SecureStore.getItemAsync(KEY_DEVICE_ID);
  if (existing) return existing;

  // Prefer Expo's native install ID when available; fall back to a random one
  // so the simulator/dev build always has something usable.
  const fromExpo =
    (await Application.getAndroidId?.()) ||
    (await Application.getIosIdForVendorAsync?.().catch(() => null));

  const id =
    fromExpo ||
    `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  await SecureStore.setItemAsync(KEY_DEVICE_ID, id);
  return id;
}

export async function getApiKey() {
  return SecureStore.getItemAsync(KEY_API_KEY);
}

export async function setApiKey(apiKey) {
  await SecureStore.setItemAsync(KEY_API_KEY, apiKey);
}

export async function getProfile() {
  const raw = await SecureStore.getItemAsync(KEY_PROFILE);
  return raw ? JSON.parse(raw) : null;
}

export async function setProfile(profile) {
  await SecureStore.setItemAsync(KEY_PROFILE, JSON.stringify(profile));
}

// Used during development if you ever need to force re-registration.
export async function clearAll() {
  await SecureStore.deleteItemAsync(KEY_API_KEY);
  await SecureStore.deleteItemAsync(KEY_PROFILE);
  // Note: deviceId is intentionally retained — it's tied to the install, not the registration.
}
