import mongoose from 'mongoose';

let connectionPromise = null;

function numberFromEnv(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function compactOptions(options) {
  return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined));
}

function timeoutDefaults() {
  return {
    serverSelectionTimeoutMS: numberFromEnv('MONGODB_TIMEOUT_MS', 5000),
    connectTimeoutMS: numberFromEnv('MONGODB_CONNECT_TIMEOUT_MS', 10000),
    socketTimeoutMS: numberFromEnv('MONGODB_SOCKET_TIMEOUT_MS', 45000)
  };
}

function poolDefaults() {
  return {
    maxPoolSize: numberFromEnv('MONGODB_MAX_POOL_SIZE', 10),
    minPoolSize: numberFromEnv('MONGODB_MIN_POOL_SIZE', 0)
  };
}

export async function connectDB(uri, options = {}) {
  mongoose.set('strictQuery', true);
  mongoose.set('bufferCommands', false);
  mongoose.set('autoIndex', process.env.MONGOOSE_AUTO_INDEX === 'true' || process.env.NODE_ENV !== 'production');

  if (mongoose.connection.readyState === 1) return mongoose.connection;

  if (!uri) {
    console.warn('MONGODB_URI is not set. Database-backed API routes will fail until MongoDB is configured.');
    return null;
  }

  const connectOptions = {
    ...poolDefaults(),
    ...timeoutDefaults(),
    ...compactOptions(options)
  };

  function maskUri(u = '') {
    try {
      if (!u) return '<not-set>';
      if (u.includes('mongodb+srv://') || u.includes('.mongodb.net')) {
        return u.replace(/:(?:[^@]+)@/, ':***@');
      }
      const parsed = new URL(u);
      if (parsed.password) parsed.password = '***';
      if (parsed.username) parsed.username = '***';
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch {
      return '<invalid>';
    }
  }

  if (process.env.NODE_ENV !== 'test') {
    console.log('MongoDB: attempting connection to', maskUri(uri));
  }

  connectionPromise ||= mongoose.connect(uri, connectOptions).finally(() => {
    connectionPromise = null;
  });

  try {
    await connectionPromise;
    if (process.env.NODE_ENV !== 'test') {
      console.log('MongoDB connected');
    }
    return mongoose.connection;
  } catch (error) {
    console.error('MongoDB connection failed (connectDB):', error && error.stack ? error.stack : String(error));
    throw error;
  }
}

export function databaseStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    state: ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoose.connection.readyState] || 'unknown'
  };
}
