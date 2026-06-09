import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const CONFIG_URL =
  (process.env as Record<string, string | undefined>)['EXPO_PUBLIC_CONFIG_URL'] ||
  (Constants.expoConfig?.extra as { configUrl?: string } | undefined)?.configUrl;

const CACHE_KEY = 'tracker.apiBase';

let apiBase: string | null = null;

export async function loadConfig(): Promise<void> {
  if (!CONFIG_URL) throw new Error('CONFIG_URL not set');

  try {
    const res = await fetch(CONFIG_URL!, { headers: { 'Cache-Control': 'no-cache' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (typeof json.apiBase !== 'string') throw new Error('missing apiBase in config');
    apiBase = json.apiBase.replace(/\/+$/, '');
  } catch (e) {
    const cached = await SecureStore.getItemAsync(CACHE_KEY);
    if (!cached) throw e;
    apiBase = cached;
    return;
  }
  await SecureStore.setItemAsync(CACHE_KEY, apiBase!);
}

export function getApiBase(): string {
  if (!apiBase) throw new Error('loadConfig() not called yet');
  return apiBase;
}
