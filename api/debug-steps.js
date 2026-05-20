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

export default async function handler(req, res) {
  const steps = [];
  const push = (k, v) => steps.push({ step: k, time: new Date().toISOString(), info: v });

  push('env', {
    MONGODB_URI: Boolean(String(process.env.MONGODB_URI || '').trim()),
    VERCEL: Boolean(process.env.VERCEL),
    NODE_ENV: process.env.NODE_ENV || 'undefined'
  });

  const uri = String(process.env.MONGODB_URI || '').trim();
  if (!uri) {
    push('quick-connect', { ok: false, error: 'MONGODB_URI not set' });
    return res.status(400).json({ ok: false, steps });
  }

  const timeoutMs = Number(process.env.MONGODB_QUICK_CHECK_TIMEOUT_MS || 3000);
  push('quick-connect-start', { uri: maskUri(uri), timeoutMs });

  const conn = mongoose.createConnection();
  const opts = { serverSelectionTimeoutMS: timeoutMs, connectTimeoutMS: timeoutMs, socketTimeoutMS: timeoutMs, maxPoolSize: 1, minPoolSize: 0 };

  const start = Date.now();
  try {
    await conn.openUri(uri, opts);
    const elapsed = Date.now() - start;
    await conn.close();
    push('quick-connect-success', { elapsed });
    return res.status(200).json({ ok: true, steps });
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    push('quick-connect-failed', { error: msg });
    return res.status(504).json({ ok: false, steps });
  }
}
