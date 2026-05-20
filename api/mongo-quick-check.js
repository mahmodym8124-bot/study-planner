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
  const uri = String(process.env.MONGODB_URI || '').trim();
  const timeoutMs = Number(process.env.MONGODB_QUICK_CHECK_TIMEOUT_MS || 3000);

  if (!uri) {
    return res.status(400).json({ ok: false, error: 'MONGODB_URI not set in environment' });
  }

  const opts = {
    serverSelectionTimeoutMS: timeoutMs,
    connectTimeoutMS: timeoutMs,
    socketTimeoutMS: timeoutMs,
    maxPoolSize: 1,
    minPoolSize: 0
  };

  const conn = mongoose.createConnection();

  try {
    const masked = maskUri(uri);
    console.log('mongo-quick-check: attempting connect to', masked, 'with timeout', timeoutMs);
    await conn.openUri(uri, opts);
    await conn.close();
    return res.status(200).json({ ok: true, connected: true, note: `connected within ${timeoutMs}ms` });
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.error('mongo-quick-check failed:', message, err && err.stack ? err.stack : 'no-stack');
    return res.status(504).json({ ok: false, connected: false, error: message });
  }
}
