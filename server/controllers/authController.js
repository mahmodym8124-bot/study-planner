import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Productivity from '../models/Productivity.js';
import { getJwtExpiresIn, getJwtSecret } from '../config/auth.js';
import { recordActivity } from '../utils/activity.js';

function sign(user) { return jwt.sign({ id: user._id }, getJwtSecret(), { expiresIn: getJwtExpiresIn() }); }

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

export async function refreshToken(req, res) {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ data: { token: sign(user), user: user.toSafeJSON() } });
}

export function me(req, res) { res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, theme: req.user.theme } }); }
