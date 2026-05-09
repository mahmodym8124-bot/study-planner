import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export async function protect(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'Invalid session' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired session' });
  }
}
