import FocusSession from '../models/FocusSession.js';
import DailyFocus from '../models/DailyFocus.js';
import { operationTimeoutMS } from '../config/db.js';
import { recordActivitySoon } from '../utils/activity.js';

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
  recordActivitySoon(req.user._id, 'Started focus session', 'FocusSession', 'focus', session._id);

  res.status(201).json({ data: session });
}

export async function getFocusSessions(req, res) {
  const normalizeQueryValue = (value, fallback) => {
    const rawValue = Array.isArray(value) ? value[0] : value;
    return rawValue === undefined ? fallback : rawValue;
  };
  const limitValue = Number.parseInt(normalizeQueryValue(req.query.limit, 30), 10);
  const skipValue = Number.parseInt(normalizeQueryValue(req.query.skip, 0), 10);
  const status = normalizeQueryValue(req.query.status, null);
  const safeSkip = Number.isNaN(skipValue) ? 0 : Math.max(0, skipValue);
  const safeLimit = Number.isNaN(limitValue) ? 30 : Math.min(Math.max(1, limitValue), 100);
  const filter = {
    user: req.user._id,
    ...(status ? { status } : {})
  };

  const sessions = await FocusSession.find(filter)
    .sort({ createdAt: -1 })
    .skip(safeSkip)
    .limit(safeLimit)
    .maxTimeMS(operationTimeoutMS())
    .lean();

  const total = await FocusSession.countDocuments(filter).maxTimeMS(operationTimeoutMS());

  res.json({ data: sessions, total, limit: safeLimit, skip: safeSkip });
}

export async function updateFocusSession(req, res) {
  const { id } = req.params;
  const { status, elapsedSeconds, currentPhase, sessionsCompleted } = req.body;

  const update = {};
  if (status) update.status = status;
  if (elapsedSeconds !== undefined) update.elapsedSeconds = elapsedSeconds;
  if (currentPhase) update.currentPhase = currentPhase;
  if (sessionsCompleted !== undefined) update.sessionsCompleted = sessionsCompleted;

  if (status === 'completed') {
    update.completedAt = new Date();
  }
  if (status === 'paused') {
    update.pausedAt = new Date();
  }

  const session = await FocusSession.findOneAndUpdate(
    { _id: id, user: req.user._id },
    { $set: update },
    { new: true, runValidators: true, maxTimeMS: operationTimeoutMS() }
  );

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  recordActivitySoon(req.user._id, status ? `Session ${status}` : 'Updated focus session', 'FocusSession', 'focus', session._id);

  res.json({ data: session });
}

export async function getDailyFocus(req, res) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyFocus = await DailyFocus.findOne({
    user: req.user._id,
    date: { $gte: today }
  }).maxTimeMS(operationTimeoutMS()).lean();

  res.json({ data: dailyFocus || null });
}

export async function saveDailyFocus(req, res) {
  const focusStatement = req.body.focusStatement || req.body.statement;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if one exists first
  const existing = await DailyFocus.findOne({ user: req.user._id, date: { $gte: today } }).maxTimeMS(operationTimeoutMS());
  const isNew = !existing;

  const dailyFocus = await DailyFocus.findOneAndUpdate(
    { user: req.user._id, date: { $gte: today } },
    { $set: { focusStatement }, $setOnInsert: { user: req.user._id, date: today } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true, maxTimeMS: operationTimeoutMS() }
  ).lean();

  recordActivitySoon(req.user._id, 'Updated daily focus', 'DailyFocus', 'focus', dailyFocus._id);

  res.status(isNew ? 201 : 200).json({ data: dailyFocus });
}

export async function completeDailyFocus(req, res) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const completedSessions = await FocusSession.countDocuments({
    user: req.user._id,
    status: 'completed',
    createdAt: { $gte: today }
  }).maxTimeMS(operationTimeoutMS());

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
  ]).option({ maxTimeMS: operationTimeoutMS() });

  const dailyFocus = await DailyFocus.findOneAndUpdate(
    { user: req.user._id, date: { $gte: today } },
    {
      $set: {
        tasksCompleted: completedSessions,
        totalSessions: completedSessions,
        totalMinutes: totalMinutes[0]?.total || 0
      }
    },
    { new: true, maxTimeMS: operationTimeoutMS() }
  ).lean();

  res.json({ data: dailyFocus });
}
