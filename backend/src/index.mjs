// Express bootstrap — connects to MongoDB, mounts routes, starts the HTTP listener.

import express from 'express';
import cors from 'cors';
import 'dotenv/config';

import { connectDb } from './db.mjs';
import logger from './logger.mjs';
import devicesRouter from './routes/devices.mjs';
import locationsRouter from './routes/locations.mjs';

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 8080;

app.use(cors());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/devices', devicesRouter);
app.use('/location', locationsRouter);

// Final error handler — anything thrown synchronously inside a handler ends up here.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(`Unhandled: ${err.stack || err.message}`);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  await connectDb();
  app.listen(PORT, () => {
    logger.info(`Tracker service listening on port ${PORT}`);
  });
}

start().catch((err) => {
  logger.error(`Failed to start: ${err.message}`);
  process.exit(1);
});

export default app;
