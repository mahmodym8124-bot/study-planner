import { Router } from 'express';
import { databaseStatus } from '../config/db.js';
import mongoose from 'mongoose';

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

const router = Router();

// Returns booleans for presence of critical env vars and DB connection state.
router.get('/env', (_req, res) => {
  const have = (key) => Boolean(String(process.env[key] || '').trim());
  const payload = {
    env: {
      mongodb: have('MONGODB_URI'),
      jwtSecret: have('JWT_SECRET'),
      googleClientId: have('GOOGLE_CLIENT_ID') || have('VITE_GOOGLE_CLIENT_ID')
    },
    database: databaseStatus(),
    vercel: Boolean(process.env.VERCEL)
  };
  res.json(payload);
});

// Run a sequence of diagnostic steps and return logs/results.
router.get('/steps', async (_req, res) => {
  const steps = [];
  const push = (k, v) => steps.push({ step: k, at: new Date().toISOString(), info: v });

  push('env-check', {
    MONGODB_URI: Boolean(String(process.env.MONGODB_URI || '').trim()),
    VERCEL: Boolean(process.env.VERCEL)
  });

  const dbStatusBefore = databaseStatus();
  push('db-status-before', dbStatusBefore);

  // Attempt a quick direct connection using a short timeout
  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) {
    push('quick-connect', { ok: false, error: 'MONGODB_URI not set' });
    return res.json({ steps, database: dbStatusBefore });
  }

  const timeoutMs = 3000;
  const conn = mongoose.createConnection();
  const opts = { serverSelectionTimeoutMS: timeoutMs, connectTimeoutMS: timeoutMs, socketTimeoutMS: timeoutMs, maxPoolSize: 1, minPoolSize: 0 };
  push('quick-connect-start', { uri: maskUri(uri), timeoutMs });
  const start = Date.now();
  try {
    await conn.openUri(uri, opts);
    const elapsed = Date.now() - start;
    await conn.close();
    push('quick-connect-success', { elapsed });
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    push('quick-connect-failed', { error: msg });
  }

  const dbStatusAfter = databaseStatus();
  push('db-status-after', dbStatusAfter);

  return res.json({ steps, database: dbStatusAfter });
});

export default router;
