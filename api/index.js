import app from '../server/server.js';
import { normalizeVercelRequest } from './request-url.js';

export default function vercelHandler(req, res) {
  normalizeVercelRequest(req);
  return app(req, res);
}
