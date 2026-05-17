import FocusSession from '../models/FocusSession.js';
import DailyFocus from '../models/DailyFocus.js';
import { recordActivity } from '../utils/activity.js';

export async function startFocusSession(req, res) {
  const { taskId, taskModel, taskName, workDurationMinutes, breakDurationMinutes } = req.body;

  const session = new FocusSession({
    user: req.user._id,
    taskId: taskId || null,
    taskModel: taskModel || null,
    taskName: taskName || null,
    workDurationMinutes: workDurationMinutes || 25,
    breakDurationMinutes: breakDurationMinutes || 5,
    status: 'active',
    startedAt: new Date(),
    currentPhase: 'work'
  });

  await session.save();
  await recordActivity(req.user._id, 'Started focus session', 'FocusSession', 'focus', session._id);

  res.status(201).json({ data: session });
}

export async function getFocusSessions(req, res) {
  const { limit = 30, skip = 0 } = req.query;
  const sessions = await FocusSession.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit))
    .skip(parseInt(skip))
    .lean();
  
  const total = await FocusSession.countDocuments({ user: req.user._id });
  
  res.json({ data: sessions, total, limit: parseInt(limit), skip: parseInt(skip) });
}

export async function updateFocusSession(req, res) {
  const { id } = req.params;
  const { status, elapsedSeconds, currentPhase, sessionsCompleted } = req.body;

  const session = await FocusSession.findById(id);
  if (!session || session.user.toString() !== req.user._id.toString()) {
    return res.status(404).json({ error: 'Session not found' });
  }

  if (status) session.status = status;
  if (elapsedSeconds !== undefined) session.elapsedSeconds = elapsedSeconds;
  if (currentPhase) session.currentPhase = currentPhase;
  if (sessionsCompleted !== undefined) session.sessionsCompleted = sessionsCompleted;

  if (status === 'completed' && !session.completedAt) {
    session.completedAt = new Date();
  }
  if (status === 'paused' && !session.pausedAt) {
    session.pausedAt = new Date();
  }

  await session.save();
  await recordActivity(req.user._id, `Session ${status}`, 'FocusSession', 'focus', session._id);

  res.json({ data: session });
}

export async function getDailyFocus(req, res) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyFocus = await DailyFocus.findOne({
    user: req.user._id,
    date: { $gte: today }
  }).lean();

  res.json({ data: dailyFocus || null });
}

export async function saveDailyFocus(req, res) {
  const { focusStatement } = req.body;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if one exists first
  const existing = await DailyFocus.findOne({ user: req.user._id, date: { $gte: today } });
  const isNew = !existing;

  const dailyFocus = await DailyFocus.findOneAndUpdate(
    { user: req.user._id, date: { $gte: today } },
    { $set: { focusStatement }, $setOnInsert: { user: req.user._id, date: today } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();

  await recordActivity(req.user._id, 'Updated daily focus', 'DailyFocus', 'focus', dailyFocus._id);

  res.status(isNew ? 201 : 200).json({ data: dailyFocus });
}

export async function completeDailyFocus(req, res) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedSessions = await FocusSession.countDocuments({
    user: req.user._id,
    status: 'completed',
    createdAt: { $gte: today }
  });

  const totalMinutes = await FocusSession.aggregate([
    {
      $match: {
        user: req.user._id,
        status: 'completed',
        createdAt: { $gte: today }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$workDurationMinutes' }
      }
    }
  ]);

  const dailyFocus = await DailyFocus.findOneAndUpdate(
    { user: req.user._id, date: { $gte: today } },
    {
      $set: {
        tasksCompleted: completedSessions,
        totalSessions: completedSessions,
        totalMinutes: totalMinutes[0]?.total || 0
      }
    },
    { new: true }
  ).lean();

  res.json({ data: dailyFocus });
}
