import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { getJwtSecret } from '../config/auth.js';
import { logSecurityEvent } from './security.js';

export async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    logSecurityEvent(req, 'auth_missing_token', {}, 'warn');
    return res.status(401).json({ message: 'Authentication required' });
  }
  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (!decoded?.id) return res.status(401).json({ message: 'Invalid session' });
    const user = await User.findById(decoded.id).lean();
    if (!user || !user.verified) {
      logSecurityEvent(req, 'auth_invalid_user', { userId: decoded.id }, 'warn');
      return res.status(401).json({ message: 'Invalid session' });
    }
    req.user = user;
    next();
  } catch {
    logSecurityEvent(req, 'auth_invalid_token', {}, 'warn');
    res.status(401).json({ message: 'Invalid or expired session' });
  }
}
