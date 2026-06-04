import Constants from 'expo-constants';

interface RegisterDeviceParams {
  deviceId: string;
  name: string;
  type: string;
}

interface RegisterDeviceResponse {
  deviceId: string;
  name: string;
  type: string;
  apiKey: string;
  createdAt: string;
}

interface PostLocationParams {
  apiKey: string;
  lat: number;
  lng: number;
  speed?: number;
  direction?: number | null;
  timestamp?: string;
}

interface PostLocationResponse {
  ok: boolean;
  id: string;
  timestamp: string;
  direction: number | null;
  city: string | null;
  country: string | null;
}

interface StoredLocation {
  _id: string;
  deviceId: string;
  lat: number;
  lng: number;
  speed: number;
  direction: number | null;
  city: string | null;
  country: string | null;
  timestamp: string;
}

interface HistoryResponse {
  deviceId: string;
  count: number;
  locations: StoredLocation[];
}
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ||
  Constants.expoConfig?.extra?.apiBase ||
  'http://10.0.2.2:8080';

class ApiError extends Error {
  status?: number;
  body?: unknown;
}

async function parseOrThrow(res: Response) {
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!res.ok) {
    const msg = body?.error || `HTTP ${res.status}`;
    const err = new ApiError(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function registerDevice({
  deviceId,
  name,
  type,
}: RegisterDeviceParams): Promise<RegisterDeviceResponse> {
  const url = `${API_BASE}/devices/register`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, name, type }),
    });
    return parseOrThrow(res);
  } catch (e) {
    const detail = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    throw new Error(`URL=${url} → ${detail}`);
  }
}

export async function postLocation({
  apiKey,
  lat,
  lng,
  speed,
  direction,
  timestamp,
}: PostLocationParams): Promise<PostLocationResponse> {
  const res = await fetch(`${API_BASE}/location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({ lat, lng, speed, direction, timestamp }),
  });
  return parseOrThrow(res);
}

export async function getHistory(
  deviceId: string,
  limit: number = 100,
): Promise<HistoryResponse> {
  const res = await fetch(
    `${API_BASE}/location/${encodeURIComponent(deviceId)}/history?limit=${limit}`
  );
  return parseOrThrow(res);
}

export { API_BASE };
