import Note from '../models/Note.js';
import FileAsset from '../models/FileAsset.js';
import Idea from '../models/Idea.js';
import Activity from '../models/Activity.js';
import Productivity from '../models/Productivity.js';
import FocusSession from '../models/FocusSession.js';
import DailyFocus from '../models/DailyFocus.js';
import { operationTimeoutMS } from '../config/db.js';

export async function stats(req, res) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [notes, files, ideas, productivity, focusSessions, dailyFocus, todaysSessions] = await Promise.all([
    Note.countDocuments({ user: req.user._id }).maxTimeMS(operationTimeoutMS()),
    FileAsset.countDocuments({ user: req.user._id }).maxTimeMS(operationTimeoutMS()),
    Idea.countDocuments({ user: req.user._id }).maxTimeMS(operationTimeoutMS()),
    Productivity.findOne({ user: req.user._id }).select('todos reminders focus pomodoro').maxTimeMS(operationTimeoutMS()).lean(),
    FocusSession.countDocuments({ user: req.user._id }).maxTimeMS(operationTimeoutMS()),
    DailyFocus.findOne({ user: req.user._id, date: { $gte: today } }).maxTimeMS(operationTimeoutMS()).lean(),
    FocusSession.countDocuments({ user: req.user._id, createdAt: { $gte: today } }).maxTimeMS(operationTimeoutMS())
  ]);

  const ideasInMotion = await Idea.countDocuments({
    user: req.user._id,
    status: { $in: ['active', 'review'] }
  }).maxTimeMS(operationTimeoutMS());

  const recentNotes = await Note.find({
    user: req.user._id,
  }).sort({ updatedAt: -1 }).limit(10).maxTimeMS(operationTimeoutMS()).lean();

  res.json({
    data: {
      notesCount: notes,
      filesCount: files,
      ideasCount: ideas,
      ideasInMotion,
      recentNotes,
      todos: productivity?.todos?.length || 0,
      reminders: productivity?.reminders?.length || 0,
      focusSessionsTotal: focusSessions,
      focusSessionsToday: todaysSessions,
      dailyFocusSet: !!dailyFocus?.focusStatement,
      pomodoro: productivity?.pomodoro || { work: 25, break: 5 }
    }
  });
}
export async function activity(req, res) {
  const rows = await Activity.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(25).maxTimeMS(operationTimeoutMS()).lean();
  res.json({ activity: rows });
}

export async function resetWorkspace(req, res) {
  const user = req.user._id;
  await Promise.all([
    Note.deleteMany({ user }).maxTimeMS(operationTimeoutMS()),
    FileAsset.deleteMany({ user }).maxTimeMS(operationTimeoutMS()),
    Idea.deleteMany({ user }).maxTimeMS(operationTimeoutMS()),
    Activity.deleteMany({ user }).maxTimeMS(operationTimeoutMS()),
    FocusSession.deleteMany({ user }).maxTimeMS(operationTimeoutMS()),
    DailyFocus.deleteMany({ user }).maxTimeMS(operationTimeoutMS()),
    Productivity.deleteOne({ user }).maxTimeMS(operationTimeoutMS())
  ]);
  res.json({ ok: true });
}

export async function updateSettings(req, res) {
  const { defaultFocusTime, theme } = req.body;
  // Update productivity/pomodoro work time
  const productivity = await Productivity.findOneAndUpdate(
    { user: req.user._id },
    { $set: { 'pomodoro.work': defaultFocusTime } },
    { new: true, upsert: true, setDefaultsOnInsert: true, maxTimeMS: operationTimeoutMS() }
  ).lean();

  // Update user theme if provided
  if (theme) {
    await (await import('../models/User.js')).default.findByIdAndUpdate(req.user._id, { theme }, { new: true, maxTimeMS: operationTimeoutMS() });
  }

  res.json({ data: { defaultFocusTime: productivity?.pomodoro?.work || defaultFocusTime, theme } });
}

export async function getSettings(req, res) {
  const productivity = await Productivity.findOne({ user: req.user._id }).maxTimeMS(operationTimeoutMS()).lean();
  const user = await (await import('../models/User.js')).default.findById(req.user._id).maxTimeMS(operationTimeoutMS()).lean();
  res.json({ data: { defaultFocusTime: productivity?.pomodoro?.work || 25, theme: user?.theme || 'dark' } });
}

export async function search(req, res) {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [notes, files, ideas] = await Promise.all([
    Note.find({ user: req.user._id, $or: [{ title: rx }, { content: rx }, { tags: rx }, { folder: rx }] }).sort({ updatedAt: -1 }).limit(12).maxTimeMS(operationTimeoutMS()).lean(),
    FileAsset.find({ user: req.user._id, $or: [{ originalName: rx }, { tags: rx }, { folder: rx }, { mimeType: rx }] }).sort({ updatedAt: -1 }).limit(12).maxTimeMS(operationTimeoutMS()).lean(),
    Idea.find({ user: req.user._id, $or: [{ title: rx }, { description: rx }, { tags: rx }, { category: rx }] }).sort({ updatedAt: -1 }).limit(12).maxTimeMS(operationTimeoutMS()).lean()
  ]);
  res.json({ results: [...notes.map((item) => ({ type: 'note', item })), ...files.map((item) => ({ type: 'file', item })), ...ideas.map((item) => ({ type: 'idea', item }))] });
}
