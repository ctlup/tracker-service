import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

interface LocationTaskData {
  locations: Array<{
    coords: {
      latitude: number;
      longitude: number;
      speed: number | null;
      heading: number | null;
      accuracy: number | null;
      altitude: number | null;
      altitudeAccuracy: number | null;
    };
    timestamp: number;
  }>;
}

export const LOCATION_TASK_NAME = 'tracker-background-location';

const API_BASE =
  Constants.expoConfig?.extra?.apiBase ||
  Constants.manifest?.extra?.apiBase ||
  'http://10.0.2.2:8080';

TaskManager.defineTask<LocationTaskData>(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    // Internal task error — log and continue, the OS will call us again.
    console.warn('[bg-task] error:', error.message);
    return;
  }
  if (!data) return;

  const { locations } = data;
  if (!locations || locations.length === 0) return;

  // SecureStore call is async — we can await inside the task.
  let apiKey;
  try {
    apiKey = await SecureStore.getItemAsync('tracker.apiKey');
  } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[bg-task] post failed:', msg);
    }
  if (!apiKey) {
    // Not registered yet. The task should not have run, but guard just in case.
    return;
  }

  // Multiple locations can arrive at once (OS may batch them). Send sequentially.
  for (const loc of locations) {
    if (!loc?.coords) continue;

    const { latitude, longitude, speed } = loc.coords;
    const ts = new Date(loc.timestamp || Date.now()).toISOString();

    try {
      await fetch(`${API_BASE}/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
        },
        body: JSON.stringify({
          lat: latitude,
          lng: longitude,
          speed: typeof speed === 'number' && speed >= 0 ? speed : 0,
          timestamp: ts,
        }),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[bg-task] post failed:', msg);
    
    }
  }
});
