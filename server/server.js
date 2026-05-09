import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
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

await connectDB(process.env.MONGODB_URI).catch((error) => {
  console.error('MongoDB connection failed:', error.message);
  if (process.env.NODE_ENV === 'production') process.exit(1);
});

app.set('trust proxy', 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || true, credentials: true }));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 800, standardHeaders: true, legacyHeaders: false }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'MindVault API' }));
app.use('/api/auth', authRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/ideas', ideaRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/productivity', productivityRoutes);

if (process.env.NODE_ENV === 'production') {
  const dist = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((error, _req, res, next) => {
  console.error(error);
  res.status(error.status || 500).json({ message: error.message || 'Server error' });
});

app.listen(PORT, () => console.log(`MindVault API listening on ${PORT}`));
