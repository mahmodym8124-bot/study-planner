import mongoose from 'mongoose';

export async function connectDB(uri) {
  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);
  if (!uri) {
    console.warn('MONGODB_URI is not set. Database-backed API routes will fail until MongoDB is configured.');
    return;
  }
  await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: Number(process.env.MONGODB_TIMEOUT_MS || 5000) });
  console.log('MongoDB connected');
}

export function databaseStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
  };
}
