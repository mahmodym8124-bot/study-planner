import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret } from '../config/auth.js';

export async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded?.id) return res.status(401).json({ message: 'Invalid session' });
    const user = await User.findById(decoded.id).lean();
    if (!user) return res.status(401).json({ message: 'Invalid session' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session' });
  }
}
