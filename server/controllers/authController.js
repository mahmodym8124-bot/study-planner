import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User.js';
import Productivity from '../models/Productivity.js';
import { getJwtExpiresIn, getJwtSecret } from '../config/auth.js';
import { recordActivitySoon } from '../utils/activity.js';
import { assertMailConfigured, sendPasswordResetEmail, sendVerificationEmail } from '../services/emailService.js';

function sign(user) { return jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: getJwtExpiresIn() }); }
function hashResetToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
const googleClient = new OAuth2Client();

function getGoogleClientId() {
  return process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '';
}

function safeGoogleName(payload) {
  const name = String(payload.name || payload.given_name || payload.email?.split('@')[0] || 'MindVault User').trim();
  return (name.length >= 2 ? name : 'MindVault User').slice(0, 80);
}

async function ensureProductivity(userId) {
  await Productivity.updateOne(
    { user: userId },
    { $setOnInsert: { user: userId, todos: [], reminders: [] } },
    { upsert: true }
  );
}

function shouldCheckMailConfig() {
  return process.env.NODE_ENV !== 'test';
}

function respondMailNotConfigured(res, context) {
  try {
    if (shouldCheckMailConfig()) assertMailConfigured();
    return false;
  } catch (error) {
    console.error(`${context}:`, error.message);
    res.status(503).json({
      message: 'Email delivery is not configured. Set Gmail SMTP environment variables before using email auth.'
    });
    return true;
  }
}

export async function register(req, res) {
  const { name, email, password } = req.body;
  const existingUser = await User.findOne({ email });
  if (existingUser?.verified) return res.status(409).json({ error: 'Email is already registered' });
  if (respondMailNotConfigured(res, 'Registration email configuration failed')) return;

  const hashedPassword = await bcrypt.hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString('hex');
  const verificationTokenExpires = new Date(Date.now() + (24 * 60 * 60 * 1000));

  if (existingUser && !existingUser.verified) {
    await User.updateOne(
      { email: existingUser.email },
      {
        $set: {
          name,
          password: hashedPassword,
          verified: false,
          verificationToken,
          verificationTokenExpires,
          resetToken: null,
          resetExpires: null
        }
      }
    );
    await Productivity.updateOne(
      { user: existingUser._id },
      { $setOnInsert: { user: existingUser._id, todos: [], reminders: [] } },
      { upsert: true }
    );
    await sendVerificationEmail(existingUser.email, verificationToken);
    return res.status(201).json({ message: 'Account created. Please check your email to verify your account.' });
  }

  const user = await User.create({
    name,
    email,
    password: hashedPassword,
    verified: false,
    verificationToken,
    verificationTokenExpires
  });
  await Productivity.create({ user: user._id, todos: [], reminders: [] });
  recordActivitySoon(user._id, 'Created vault', 'MindVault account', 'auth', user._id);
  await sendVerificationEmail(user.email, verificationToken);
  res.status(201).json({ message: 'Account created. Please check your email to verify your account.' });
}

export async function verifyEmail(req, res) {
  const { token } = req.body;
  const user = await User.findOne({
    verificationToken: token,
    verificationTokenExpires: { $gt: new Date() }
  });

  if (!user) {
    return res.status(400).json({ message: 'Invalid or expired verification link.' });
  }

  user.verified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpires = undefined;
  await user.save();

  return res.json({ message: 'Email verified successfully. You can now log in.' });
}

export async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) return res.status(400).json({ error: 'Invalid credentials' });
  if (!user.verified) {
    return res.status(403).json({ error: 'Please verify your email before logging in. Check your inbox.' });
  }
  recordActivitySoon(user._id, 'Unlocked vault', 'Signed in', 'auth', user._id);
  res.json({ data: { token: sign(user), user: user.toSafeJSON() } });
}

export async function googleLogin(req, res) {
  const { credential } = req.body;
  const googleClientId = getGoogleClientId();

  if (!googleClientId) {
    return res.status(503).json({ error: 'Google sign-in is not configured' });
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: googleClientId
  });
  const payload = ticket.getPayload();
  const email = String(payload?.email || '').toLowerCase();

  if (!payload?.sub || !email || !payload.email_verified) {
    return res.status(401).json({ error: 'Google account could not be verified' });
  }

  let user = await User.findOne({ $or: [{ googleId: payload.sub }, { email }] });
  const providerUpdate = { $addToSet: { authProviders: 'google' } };

  if (user) {
    const update = {
      googleId: payload.sub,
      verified: true,
      verificationToken: null,
      verificationTokenExpires: null,
      resetToken: null,
      resetExpires: null
    };
    if (!user.name && safeGoogleName(payload)) update.name = safeGoogleName(payload);
    user = await User.findByIdAndUpdate(user._id, { $set: update, ...providerUpdate }, { new: true });
    await ensureProductivity(user._id);
    recordActivitySoon(user._id, 'Unlocked vault', 'Signed in with Google', 'auth', user._id);
    return res.json({ data: { token: sign(user), user: user.toSafeJSON() } });
  }

  user = await User.create({
    name: safeGoogleName(payload),
    email,
    password: crypto.randomBytes(32).toString('hex'),
    googleId: payload.sub,
    authProviders: ['google'],
    verified: true
  });
  await Productivity.create({ user: user._id, todos: [], reminders: [] });
  recordActivitySoon(user._id, 'Created vault', 'Google account', 'auth', user._id);
  return res.status(201).json({ data: { token: sign(user), user: user.toSafeJSON() } });
}

export async function requestPasswordReset(req, res, next) {
  const { email } = req.body;
  const genericMessage = { message: 'If an account exists, a reset email has been sent.' };

  try {
    const user = await User.findOne({ email }).select('_id name email verified');
    if (!user) return res.json(genericMessage);
    if (!user.verified) return res.json(genericMessage);
    if (shouldCheckMailConfig()) {
      try {
        assertMailConfigured();
      } catch (error) {
        console.error('Password reset email configuration failed:', error.message);
        return res.json(genericMessage);
      }
    }

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
      console.error('Password reset email failed after token creation:', error.message);
      await User.updateOne(
        { email: user.email },
        { $set: { resetToken: null, resetExpires: null } }
      );
    }

    return res.json(genericMessage);
  } catch (error) {
    console.error('Password reset request failed:', error);
    return next(error);
  }
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
  recordActivitySoon(user._id, 'Reset password', 'Password reset completed', 'auth', user._id);
  return res.json({ message: 'Password updated successfully' });
}

export async function refreshToken(req, res) {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ data: { token: sign(user), user: user.toSafeJSON() } });
}

export function me(req, res) { res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, theme: req.user.theme } }); }
