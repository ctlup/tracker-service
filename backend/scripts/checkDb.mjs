// scripts/checkDb.mjs
//
// Connects directly to MongoDB (bypassing the HTTP layer) and prints all
// registered devices plus the most recent 10 locations for each one.
//
// Usage: node scripts/checkDb.mjs
// Env:
//   MONGO_URI  default mongodb://localhost:27017/tracker

import mongoose from 'mongoose';
import Device from '../src/models/Device.mjs';
import Location from '../src/models/Location.mjs';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/tracker';

async function main() {
  await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  console.log(`Connected to ${MONGO_URI}`);
  console.log('='.repeat(70));

  const devices = await Device.find({}).sort({ createdAt: 1 }).lean();
  console.log(`\nDEVICES (${devices.length})`);
  console.log('-'.repeat(70));

  if (devices.length === 0) {
    console.log('  (none registered yet)');
  }

  for (const d of devices) {
    console.log(
      `  • ${d.deviceId}  name="${d.name}"  type=${d.type}  ` +
        `created=${new Date(d.createdAt).toISOString()}  ` +
        `apiKey=${d.apiKey.slice(0, 8)}...`
    );
  }

  for (const d of devices) {
    const locs = await Location.find({ deviceId: d.deviceId })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    const total = await Location.countDocuments({ deviceId: d.deviceId });

    console.log(`\nLOCATIONS for ${d.deviceId}  (showing ${locs.length} of ${total})`);
    console.log('-'.repeat(70));

    if (locs.length === 0) {
      console.log('  (no pings yet)');
      continue;
    }

    for (const l of locs) {
      const place = l.city || l.country
        ? `  [${[l.city, l.country].filter(Boolean).join(', ')}]`
        : '';
      console.log(
        `  ${new Date(l.timestamp).toISOString()}  ` +
          `lat=${l.lat.toFixed(6)}  lng=${l.lng.toFixed(6)}  speed=${(l.speed || 0).toFixed(2)}${place}`
      );
    }
  }

  console.log('\n' + '='.repeat(70));
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(`checkDb failed: ${err.message}`);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
