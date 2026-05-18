import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Productivity from '../models/Productivity.js';
import { getJwtExpiresIn, getJwtSecret } from '../config/auth.js';
import { recordActivity } from '../utils/activity.js';
import { sendPasswordResetEmail } from '../utils/passwordResetEmail.js';

function sign(user) { return jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: getJwtExpiresIn() }); }
function hashResetToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }

export async function register(req, res) {
  const { name, email, password } = req.body;
  const exists = await User.findOne({ email }).select('_id').lean();
  if (exists) return res.status(409).json({ error: 'Email is already registered' });
  const user = await User.create({ name, email, password });
  await Productivity.create({ user: user._id, todos: [], reminders: [] });
  await recordActivity(user._id, 'Created vault', 'MindVault account', 'auth', user._id);
  res.status(201).json({ data: { token: sign(user), user: user.toSafeJSON() } });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) return res.status(401).json({ error: 'Invalid email or password' });
  await recordActivity(user._id, 'Unlocked vault', 'Signed in', 'auth', user._id);
  res.json({ data: { token: sign(user), user: user.toSafeJSON() } });
}

export async function requestPasswordReset(req, res) {
  const { email } = req.body;
  const genericMessage = { message: 'If that email is registered, a password reset link has been sent.' };
  const user = await User.findOne({ email }).select('_id name email');
  if (!user) return res.json(genericMessage);

  // Security-critical: generate an unpredictable cryptographic token.
  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = hashResetToken(resetToken);
  const resetExpires = new Date(Date.now() + (60 * 60 * 1000));
  await User.updateOne(
    { email: user.email },
    { $set: { resetToken: resetTokenHash, resetExpires } }
  );

  try {
    await sendPasswordResetEmail(user.email, resetToken);
  } catch (error) {
    console.error('Failed to send password reset email:', error.message);
  }

  return res.json(genericMessage);
}

export async function resetPassword(req, res) {
  const { token, password } = req.body;
  const hashedToken = hashResetToken(token);

  const user = await User.findOne({ resetToken: hashedToken }).select('_id +resetToken +resetExpires');

  if (!user) return res.status(400).json({ message: 'Reset link is invalid or expired' });
  if (!user.resetExpires || user.resetExpires <= new Date()) {
    return res.status(400).json({ message: 'Reset link is invalid or expired' });
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  await User.updateOne(
    { resetToken: hashedToken },
    { $set: { password: hashedPassword, resetToken: null, resetExpires: null } }
  );
  await recordActivity(user._id, 'Reset password', 'Password reset completed', 'auth', user._id);
  return res.json({ message: 'Password updated successfully' });
}

export async function refreshToken(req, res) {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ data: { token: sign(user), user: user.toSafeJSON() } });
}

export function me(req, res) { res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, theme: req.user.theme } }); }
