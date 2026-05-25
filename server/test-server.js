import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dist = path.resolve(__dirname, '..', 'dist');
const port = Number(process.env.PORT || '3000');
const app = express();

app.use(express.static(dist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(dist, 'index.html'));
});

const server = app.listen(port, () => {
  console.log(`MindVault Playwright test server listening on ${port}`);
});

async function shutdown(signal) {
  console.log(`\n${signal}: shutting down test server...`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
