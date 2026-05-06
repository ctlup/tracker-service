// API key middleware — validates x-api-key header against a registered device.

import Device from '../models/Device.mjs';
import logger from '../logger.mjs';

export async function requireApiKey(req, res, next) {
  const apiKey = req.header('x-api-key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing x-api-key header' });
  }

  try {
    const device = await Device.findOne({ apiKey });
    if (!device) {
      logger.warn(`Rejected request with invalid api key: ${apiKey.slice(0, 8)}...`);
      return res.status(401).json({ error: 'Invalid API key' });
    }

    req.device = device;
    next();
  } catch (err) {
    logger.error(`apiKey middleware error: ${err.message}`);
    res.status(500).json({ error: 'Internal error' });
  }
}
