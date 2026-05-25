import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { connectDB, databaseStatus } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import ideaRoutes from './routes/ideaRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import productivityRoutes from './routes/productivityRoutes.js';
import focusRoutes from './routes/focusRoutes.js';
import graphRoutes from './routes/graphRoutes.js';
import debugRoutes from './routes/debugRoutes.js';
import { getGraphData } from './controllers/graphController.js';
import searchRoutes from './routes/searchRoutes.js';
import { protect } from './middleware/auth.js';
import { asyncHandler } from './middleware/asyncHandler.js';
import {
  attachRequestId,
  createRateLimiter,
  detectSuspiciousTraffic,
  enforceHttps,
  logSecurityEvent,
  rejectUnsafeMongoKeys,
  requireJsonForApi
} from './middleware/security.js';
import { getJwtExpiresIn, getJwtSecret } from './config/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const dist = path.resolve(__dirname, '..', 'dist');
const serveDist = express.static(dist);
let serverInstance = null;
let requestLogger = null;

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
  integrations: [nodeProfilingIntegration()]
});

function getRequestLogger() {
  requestLogger ||= morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev');
  return requestLogger;
}

function parseAllowedOrigins() {
  const values = [
    process.env.CLIENT_URL,
    process.env.ADDITIONAL_CLIENT_URLS,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ''
  ];

  const list = values.join(',')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  // Explicit static frontend used by this project.
  const ghPages = 'https://mahmodym8124-bot.github.io';
  if (!list.includes(ghPages)) list.push(ghPages);

  return [...new Set(list)];
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return true;
  const normalizedOrigin = origin.trim().replace(/\/$/, '');
  
  if (process.env.NODE_ENV !== 'production') {
    const isLocal = normalizedOrigin.includes('localhost:') || normalizedOrigin.includes('127.0.0.1:');
    if (isLocal) return true;
  }

  if (!allowedOrigins.length) return process.env.NODE_ENV !== 'production';
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  return false;
}

function sanitizeMongoUri(uri = '') {
  try {
    const parsed = new URL(uri);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`;
  } catch {
    return '<invalid>';
  }
}

function getPort() {
  const rawPort = process.env.PORT || '8080';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535. Received: ${rawPort}`);
  }
  return port;
}

function validateEnvironment() {
  const required = ['MONGODB_URI'];
  const missing = required.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  getJwtSecret();
  getJwtExpiresIn();

  if (process.env.NODE_ENV === 'production' && process.env.PASSWORD_RESET_BASE_URL) {
    const resetBase = new URL(process.env.PASSWORD_RESET_BASE_URL);
    if (resetBase.protocol !== 'https:') throw new Error('PASSWORD_RESET_BASE_URL must use HTTPS in production');
  }
}

function startupMetadata(port) {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port,
    vercel: Boolean(process.env.VERCEL),
    apiPrefix: '/api',
    corsOrigins: parseAllowedOrigins().length,
    mongoUri: sanitizeMongoUri(process.env.MONGODB_URI)
  };
}

app.set('trust proxy', 1);
app.use(attachRequestId);
app.use(enforceHttps);
app.use(detectSuspiciousTraffic);
app.use((req, res, next) => {
  const helmetOptions = {
    crossOriginOpenerPolicy: {
      policy: 'same-origin-allow-popups'
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        frameSrc: ["'self'", 'https://accounts.google.com'],
        connectSrc: ["'self'", 'https://accounts.google.com', 'https://play.google.com']
      }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: []
    }
  };

  return helmet(helmetOptions)(req, res, next);
});
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = parseAllowedOrigins();
    if (isAllowedOrigin(origin, allowedOrigins)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(compression());
app.use((req, res, next) => getRequestLogger()(req, res, next));
app.use(express.json({ limit: '512kb' }));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', requireJsonForApi);
app.use('/api', rejectUnsafeMongoKeys);
app.use('/api', createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  event: 'rate_limit_api',
  message: { message: 'Too many API requests. Please wait and try again.' }
}));
app.use('/api/auth/login', createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  event: 'rate_limit_login',
  message: { message: 'Too many login attempts. Please wait and try again.' }
}));
app.use('/api/auth/register', createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  event: 'rate_limit_register',
  message: { message: 'Too many account creation attempts. Please wait and try again.' }
}));
app.use('/api/auth/google', createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  event: 'rate_limit_google_auth',
  message: { message: 'Too many Google sign-in attempts. Please wait and try again.' }
}));
app.use('/api/auth/reset-password', createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  event: 'rate_limit_reset_password',
  message: { message: 'Too many password reset attempts. Please wait and try again.' }
}));
app.use('/api/workspace/reset', createRateLimiter({
  windowMs: 60 * 60 * 1000,
  limit: 3,
  event: 'rate_limit_workspace_reset',
  message: { message: 'Too many workspace reset attempts. Please wait and try again.' }
}));
app.use(['/api/ai', '/api/generate', '/api/generation'], createRateLimiter({
  windowMs: 60 * 1000,
  limit: 10,
  event: 'rate_limit_ai_generation',
  message: { message: 'Too many generation requests. Please wait and try again.' }
}));

async function requireDatabase(_req, res, next) {
  if (!(await ensureDatabaseConnected())) {
    return res.status(503).json({
      message: 'Database is not connected. Check MONGODB_URI and MongoDB Atlas Network Access.'
    });
  }

  return next();
}

async function ensureDatabaseConnected() {
  const before = databaseStatus();
  if (before.connected) return true;
  try {
    await connectDB(process.env.MONGODB_URI);
  } catch (error) {
    console.error('ensureDatabaseConnected: MongoDB connection failed:', error && error.stack ? error.stack : String(error));
  }
  return databaseStatus().connected;
}

app.get('/api/health', async (_req, res) => {
  const configured = Boolean(String(process.env.MONGODB_URI || '').trim());
  const connected = configured && (await ensureDatabaseConnected());
  const database = databaseStatus();
  return res.status(connected ? 200 : 503).json({
    ok: connected,
    name: 'MindVault API',
    database,
    configured
  });
});
app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/notes', requireDatabase, noteRoutes);
app.use('/api/ideas', requireDatabase, ideaRoutes);
app.use('/api/workspace', requireDatabase, workspaceRoutes);
app.use('/api/productivity', requireDatabase, productivityRoutes);
app.use('/api/focus', requireDatabase, focusRoutes);
app.use('/api/graph', requireDatabase, graphRoutes);
app.get('/api/graph-data', requireDatabase, asyncHandler(protect), asyncHandler(getGraphData));
app.use('/api/search', requireDatabase, searchRoutes);
// Lightweight debug endpoints (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/_debug', debugRoutes);
}

Sentry.setupExpressErrorHandler(app);

app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    return serveDist(req, res, next);
  }
  return next();
});
app.get('*', (req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    return res.sendFile(path.join(dist, 'index.html'));
  }
  return next();
});

app.use('/api', (req, res) => res.status(404).json({
  message: `API route not found: ${req.method} ${req.originalUrl || req.url}`
}));

app.use((req, res) => res.status(404).json({
  message: `Route not found: ${req.method} ${req.originalUrl || req.url}`
}));

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, next) => {
  logSecurityEvent(_req, 'api_error', {
    name: error.name,
    code: error.code,
    status: error.status,
    message: error.message
  }, error.status && error.status < 500 ? 'warn' : 'error');
  if (error.message === 'Not allowed by CORS') return res.status(403).json({ message: 'Origin is not allowed' });
  if (error.message === 'Unsupported file type') return res.status(415).json({ message: error.message });
  if (error.code === 11000) return res.status(409).json({ message: 'A record with that value already exists' });
  if (error.name === 'ValidationError') return res.status(422).json({ message: error.message });
  if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid identifier' });
  res.status(error.status || 500).json({ message: error.message || 'Server error' });
});

export async function startServer() {
  dotenv.config();
  validateEnvironment();
  const port = getPort();
  if (process.env.NODE_ENV === 'development') {
    console.log('MindVault startup metadata:', startupMetadata(port));
  }

  await connectDB(process.env.MONGODB_URI);

  if (process.env.VERCEL) return null;
  if (serverInstance?.listening) return serverInstance;

  serverInstance = app.listen(port, () => console.log(`MindVault API listening on ${port}`));
  serverInstance.on('close', () => {
    serverInstance = null;
  });
  return serverInstance;
}

const isDirectEntry = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === __filename;
if (isDirectEntry) {
  startServer().catch((error) => {
    console.error('Failed to start MindVault API:', error.message);
    if (!process.env.VERCEL) process.exit(1);
  });
}

export default app;
