// MongoDB connection bootstrap.
// Single connect call invoked from index.mjs; mongoose maintains the pool internally.
import mongoose from 'mongoose';
import logger from './logger.mjs';

export async function connectDb() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/tracker';

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    logger.info(`MongoDB connected: ${uri}`);
  } catch (err) {
    logger.error(`MongoDB connection failed: ${err.message}`);
    throw err;
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB error: ${err.message}`);
  });
}

export default mongoose;
