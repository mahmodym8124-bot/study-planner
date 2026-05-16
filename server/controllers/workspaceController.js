import Note from '../models/Note.js';
import FileAsset from '../models/FileAsset.js';
import Idea from '../models/Idea.js';
import Activity from '../models/Activity.js';
import Productivity from '../models/Productivity.js';
import FocusSession from '../models/FocusSession.js';
import DailyFocus from '../models/DailyFocus.js';

export async function stats(req, res) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [notes, files, ideas, productivity, focusSessions, dailyFocus, todaysSessions] = await Promise.all([
    Note.countDocuments({ user: req.user._id }),
    FileAsset.countDocuments({ user: req.user._id }),
    Idea.countDocuments({ user: req.user._id }),
    Productivity.findOne({ user: req.user._id }).select('todos reminders focus pomodoro').lean(),
    FocusSession.countDocuments({ user: req.user._id, status: 'completed' }),
    DailyFocus.findOne({ user: req.user._id, date: { $gte: today } }).lean(),
    FocusSession.countDocuments({ user: req.user._id, status: 'completed', createdAt: { $gte: today } })
  ]);

  const ideasInMotion = await Idea.countDocuments({
    user: req.user._id,
    status: { $in: ['Active', 'Review'] }
  });

  const recentNotes = await Note.countDocuments({
    user: req.user._id,
    updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  });

  res.json({
    stats: {
      notes,
      files,
      ideas,
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
  const rows = await Activity.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(25).lean();
  res.json({ activity: rows });
}
export async function search(req, res) {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ results: [] });
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [notes, files, ideas] = await Promise.all([
    Note.find({ user: req.user._id, $or: [{ title: rx }, { content: rx }, { tags: rx }, { folder: rx }] }).sort({ updatedAt: -1 }).limit(12).lean(),
    FileAsset.find({ user: req.user._id, $or: [{ originalName: rx }, { tags: rx }, { folder: rx }, { mimeType: rx }] }).sort({ updatedAt: -1 }).limit(12).lean(),
    Idea.find({ user: req.user._id, $or: [{ title: rx }, { description: rx }, { tags: rx }, { category: rx }] }).sort({ updatedAt: -1 }).limit(12).lean()
  ]);
  res.json({ results: [...notes.map((item) => ({ type: 'note', item })), ...files.map((item) => ({ type: 'file', item })), ...ideas.map((item) => ({ type: 'idea', item }))] });
}
