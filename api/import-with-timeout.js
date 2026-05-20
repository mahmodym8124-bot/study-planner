export default async function handler(req, res) {
  const importPromise = import('../server/server.js');
  const timeoutMs = 10000;
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('import-timeout')), timeoutMs));

  try {
    await Promise.race([importPromise, timeout]);
    res.status(200).json({ ok: true, imported: true, note: 'server import completed within timeout' });
  } catch (err) {
    res.status(504).json({ ok: false, error: String(err), note: `failed within ${timeoutMs}ms` });
  }
}
