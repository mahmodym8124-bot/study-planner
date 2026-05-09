import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) {
    console.warn('MONGODB_URI is not set. API will use an in-memory demo connection only if MongoDB is unavailable.');
    return;
  }
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { autoIndex: true });
  console.log('MongoDB connected');
}
