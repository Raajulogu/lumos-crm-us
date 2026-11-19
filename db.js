import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { logger } from './utils/logger.js';

dotenv.config();

let connectionPromise = null;

export async function dbConnection() {
  const mongoUrl = process.env.MONGO_URL || process.env.MONGO_URI;

  if (!mongoUrl) {
    logger.error('❌ MONGO_URL environment variable is missing!');
    throw new Error('MONGO_URL environment variable is missing');
  }

  // If already connected
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // If connection is in flight, await existing promise
  if (connectionPromise) {
    return connectionPromise;
  }

  try {
    connectionPromise = mongoose.connect(mongoUrl, {
      serverSelectionTimeoutMS: 15000,
    });
    const m = await connectionPromise;
    logger.info('✅ MongoDB Connected Successfully');
    connectionPromise = null;
    return m.connection;
  } catch (error) {
    logger.error('❌ Error Connecting to MongoDB:', error);
    connectionPromise = null;
    throw error;
  }
}
