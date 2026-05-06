// Device controller — registration + listing.
// business logic lives here, the route file is purely the HTTP wiring.
import crypto from 'node:crypto';
import Device from '../models/Device.mjs';
import logger from '../logger.mjs';

const VALID_TYPES = ['cyclist', 'car', 'scooter'];

function generateApiKey() {
  return crypto.randomBytes(32).toString('hex');
}

export async function registerDevice(req, res) {
  const { deviceId, name, type } = req.body || {};

  if (!deviceId || !name || !type) {
    return res.status(400).json({
      error: 'deviceId, name, and type are required',
    });
  }

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: `type must be one of: ${VALID_TYPES.join(', ')}`,
    });
  }

  try {
    // If the same deviceId comes back (e.g. the app reinstalled or got restarted before
    // saving the key), return the existing key rather than creating a duplicate.
    const existing = await Device.findOne({ deviceId });
    if (existing) {
      logger.info(`Device re-registered: ${deviceId} (${existing.name})`);
      return res.json({
        deviceId: existing.deviceId,
        name: existing.name,
        type: existing.type,
        apiKey: existing.apiKey,
        createdAt: existing.createdAt,
      });
    }

    const device = await Device.create({
      deviceId,
      name,
      type,
      apiKey: generateApiKey(),
    });

    logger.info(`Device registered: ${device.deviceId} (${device.name}, ${device.type})`);

    res.status(201).json({
      deviceId: device.deviceId,
      name: device.name,
      type: device.type,
      apiKey: device.apiKey,
      createdAt: device.createdAt,
    });
  } catch (err) {
    logger.error(`registerDevice error: ${err.message}`);
    res.status(500).json({ error: 'Failed to register device' });
  }
}

export async function listDevices(req, res) {
  try {
    // Don't leak api keys back through this endpoint — it's used by the dashboard.
    const devices = await Device.find({}, '-apiKey').sort({ createdAt: -1 }).lean();
    res.json(devices);
  } catch (err) {
    logger.error(`listDevices error: ${err.message}`);
    res.status(500).json({ error: 'Failed to list devices' });
  }
}
