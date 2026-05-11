import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { connectDB, databaseStatus } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import noteRoutes from './routes/noteRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import ideaRoutes from './routes/ideaRoutes.js';
import workspaceRoutes from './routes/workspaceRoutes.js';
import productivityRoutes from './routes/productivityRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const dist = path.resolve(__dirname, '..', 'dist');
const serveDist = express.static(dist);
let serverInstance = null;
let requestLogger = null;

function getRequestLogger() {
  requestLogger ||= morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev');
  return requestLogger;
}

function parseAllowedOrigins(value = process.env.CLIENT_URL) {
  const list = String(value || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
  
  // Ensure the primary GitHub Pages URL is always allowed in production
  const ghPages = 'https://mahmodym8124-bot.github.io';
  if (!list.includes(ghPages)) list.push(ghPages);
  
  return list;
}

function isTrustedHostedFrontend(origin = '') {
  try {
    const parsed = new URL(origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    if (parsed.hostname.endsWith('.github.io')) return true;
    if (parsed.hostname.endsWith('.vercel.app')) return true;
    return false;
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return true;
  const normalizedOrigin = origin.trim().replace(/\/$/, '');
  
  if (process.env.NODE_ENV !== 'production') {
    const isLocal = normalizedOrigin.includes('localhost:') || normalizedOrigin.includes('127.0.0.1:');
    if (isLocal) return true;
  }

  if (!allowedOrigins.length) return true;
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  return isTrustedHostedFrontend(normalizedOrigin);
}

function sanitizeMongoUri(uri = '') {
  try {
    const isAtlas = uri.includes('mongodb+srv://') || uri.includes('.mongodb.net');
    if (isAtlas) {
      return uri.replace(/:([^@]+)@/, ':***@');
    }
    const parsed = new URL(uri);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
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
  const required = ['MONGODB_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN'];
  const missing = required.filter((key) => !String(process.env[key] || '').trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
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
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 800, standardHeaders: true, legacyHeaders: false }));
app.use(['/api/auth/login', '/api/auth/register'], rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Please wait and try again.' }
}));

async function requireDatabase(_req, res, next) {
  if (databaseStatus().connected) return next();

  try {
    await connectDB(process.env.MONGODB_URI);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
  }

  if (!databaseStatus().connected) {
    return res.status(503).json({
      message: 'Database is not connected. Check MONGODB_URI and MongoDB Atlas Network Access.'
    });
  }

  return next();
}

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'MindVault API', database: databaseStatus() }));
app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/notes', requireDatabase, noteRoutes);
app.use('/api/files', requireDatabase, fileRoutes);
app.use('/api/ideas', requireDatabase, ideaRoutes);
app.use('/api/workspace', requireDatabase, workspaceRoutes);
app.use('/api/productivity', requireDatabase, productivityRoutes);

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

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ message: error.message });
  }
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
  console.log('MindVault startup metadata:', startupMetadata(port));

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
