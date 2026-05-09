import mongoose from 'mongoose';

let connectionPromise = null;

export async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);

  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!uri) {
    console.warn('MONGODB_URI is not set. Database-backed API routes will fail until MongoDB is configured.');
    return null;
  }

  connectionPromise ||= mongoose
    .connect(uri, { autoIndex: true, serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 5000) })
    .finally(() => {
      connectionPromise = null;
    });

  await connectionPromise;
  console.log('MongoDB connected');
  return mongoose.connection;
}

export function databaseStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
  };
}
