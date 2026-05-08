import * as SecureStore from 'expo-secure-store';
import * as Application from 'expo-application';

export type DeviceType = 'cyclist' | 'car' | 'scooter';

export interface DeviceProfile {
  name: string;
  type: DeviceType;
  deviceId: string;
}

const KEY_DEVICE_ID = 'tracker.deviceId';
const KEY_API_KEY = 'tracker.apiKey';
const KEY_PROFILE = 'tracker.profile'; 

export async function getOrCreateDeviceId() : Promise<string> {
  const existing = await SecureStore.getItemAsync(KEY_DEVICE_ID);
  if (existing) return existing;


  const fromExpo =
    (await Application.getAndroidId?.()) ||
    (await Application.getIosIdForVendorAsync?.().catch(() => null));

  const id =
    fromExpo ||
    `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  await SecureStore.setItemAsync(KEY_DEVICE_ID, id);
  return id;
}

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_API_KEY);
}

export async function setApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(KEY_API_KEY, apiKey);
}

export async function getProfile(): Promise<DeviceProfile | null> {

  const raw = await SecureStore.getItemAsync(KEY_PROFILE);
  return raw ? JSON.parse(raw) : null;
}

export async function setProfile(profile: DeviceProfile): Promise<void> {
  await SecureStore.setItemAsync(KEY_PROFILE, JSON.stringify(profile));
}

export async function clearAll(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY_API_KEY);
  await SecureStore.deleteItemAsync(KEY_PROFILE);
}
