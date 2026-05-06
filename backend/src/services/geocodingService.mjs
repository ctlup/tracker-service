// services/geocodingService.mjs
//
// Sends lat/lon to Google Geocoding API and returns city/country info.
// Two important optimizations:
//
//   1) Cache: The same lat/lon area (approx. 100m) is not queried twice.
//      Sending a Google request every 2 seconds while a phone is stationary
//      is both costly and unnecessary.
//
//   2) If GOOGLE_API_KEY is not set, the function silently returns null.
//      So without a key the system still works, city/country will just be empty.
//      This lets you test the app before the manager provides the key.
//
// API key comes from the .env file (GOOGLE_API_KEY=...).

import logger from '../logger.mjs';

const API_KEY = process.env.GOOGLE_API_KEY;
const ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

// Simple in-memory cache. Key = "lat3,lon3" (3 decimal places → ~110m precision).
// Sufficient for a one-day internal tool; resets on restart, that's fine.
const cache = new Map();
const MAX_CACHE = 5000;

function cacheKey(lat, lng) {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

export async function reverseGeocode(lat, lng) {
  if (!API_KEY) {
    return null; // No key → skip silently, caller receives null.
  }

  const key = cacheKey(lat, lng);
  if (cache.has(key)) {
    return cache.get(key);
  }

  try {
    const url = `${ENDPOINT}?latlng=${lat},${lng}&key=${API_KEY}&language=en&result_type=locality|country`;
    const res = await fetch(url);

    if (!res.ok) {
      logger.warn(`Geocoding HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();

    if (data.status !== 'OK') {
      // ZERO_RESULTS can happen in the ocean etc., not always an error.
      if (data.status !== 'ZERO_RESULTS') {
        logger.warn(`Geocoding status=${data.status} ${data.error_message || ''}`);
      }
      return null;
    }

    // Extract city and country from the first suitable result.
    let city = null;
    let country = null;

    for (const result of data.results) {
      for (const comp of result.address_components) {
        if (!city && comp.types.includes('locality')) city = comp.long_name;
        if (!country && comp.types.includes('country')) country = comp.long_name;
      }
      if (city && country) break;
    }

    const out = { city, country };

    // Limit the cache — prevent unbounded growth.
    if (cache.size >= MAX_CACHE) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, out);

    return out;
  } catch (err) {
    logger.warn(`Geocoding error: ${err.message}`);
    return null;
  }
}
