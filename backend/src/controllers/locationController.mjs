// Location controller — accept GPS pings and serve history.
// On each ping, queries Google Geocoding API to add city/country info
// (if GOOGLE_API_KEY is set). If geocoding fails the ping is still recorded,
// city/country will just be null — so Google being slow/down does not disrupt GPS flow.

import Location from '../models/Location.mjs';
import logger from '../logger.mjs';
import { reverseGeocode } from '../services/geocodingService.mjs';

export async function recordLocation(req, res) {
  const { lat, lng, speed, timestamp } = req.body || {};
  const device = req.device; // injected by requireApiKey middleware

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({
      error: 'lat and lng are required and must be numbers',
    });
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return res.status(400).json({ error: 'lat/lng out of range' });
  }

  try {
    const ts = timestamp ? new Date(timestamp) : new Date();

    // Fetch city/country. This is an external API call; it may fail, that's fine.
    // Results are cached, so a second ping to the same area is free.
    const place = await reverseGeocode(lat, lng);

    const loc = await Location.create({
      deviceId: device.deviceId,
      lat,
      lng,
      speed: typeof speed === 'number' ? speed : 0,
      city: place?.city || null,
      country: place?.country || null,
      timestamp: ts,
    });

    // Per spec: log every ping so data flow is visible in the terminal.
    const placeText = loc.city || loc.country
      ? ` (${[loc.city, loc.country].filter(Boolean).join(', ')})`
      : '';

    logger.info(
      `GPS ping → device=${device.deviceId} lat=${lat.toFixed(6)} lng=${lng.toFixed(6)} ` +
        `speed=${(loc.speed || 0).toFixed(2)}${placeText} ts=${ts.toISOString()}`
    );

    res.status(201).json({
      ok: true,
      id: loc._id,
      timestamp: loc.timestamp,
      city: loc.city,
      country: loc.country,
    });
  } catch (err) {
    logger.error(`recordLocation error: ${err.message}`);
    res.status(500).json({ error: 'Failed to record location' });
  }
}

export async function getHistory(req, res) {
  const { deviceId } = req.params;
  const limit = Math.min(parseInt(req.query.limit, 10) || 1000, 10000);

  try {
    const history = await Location.find({ deviceId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    res.json({
      deviceId,
      count: history.length,
      locations: history,
    });
  } catch (err) {
    logger.error(`getHistory error: ${err.message}`);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}
