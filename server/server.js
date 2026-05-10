import 'dotenv/config';
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
const PORT = process.env.PORT || 8080;
const allowedOrigins = process.env.CLIENT_URL?.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean) || [];

await connectDB(process.env.MONGODB_URI).catch((error) => {
  console.error('MongoDB connection failed:', error.message);
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) process.exit(1);
});

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
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

if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  const dist = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

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

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`MindVault API listening on ${PORT}`));
}

export default app;
