import mongoose from 'mongoose';
import { config } from './config.js';
import { StoredFile } from './models/StoredFile.js';
import { FileChunk } from './models/FileChunk.js';

interface Logger {
  info: (msg: string) => void;
}

export async function connectDb(log: Logger = console): Promise<typeof mongoose.connection> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  // Make sure the 24-hour TTL indexes exist even when autoIndex is off in production.
  await Promise.all([StoredFile.createIndexes(), FileChunk.createIndexes()]);
  log.info('MongoDB connected');
  return mongoose.connection;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}
