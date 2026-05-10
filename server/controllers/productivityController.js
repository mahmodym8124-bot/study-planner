import Productivity from '../models/Productivity.js';
import { recordActivity } from '../utils/activity.js';

function productivityPayload(body) {
  const payload = {};
  for (const key of ['todos', 'reminders', 'focus', 'pomodoro']) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
}

export async function getProductivity(req, res) {
  const productivity = await Productivity.findOneAndUpdate(
    { user: req.user._id },
    { $setOnInsert: { todos: [], reminders: [] } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  res.json({ productivity });
}
export async function saveProductivity(req, res) {
  const productivity = await Productivity.findOneAndUpdate(
    { user: req.user._id },
    { $set: productivityPayload(req.body), $setOnInsert: { user: req.user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  await recordActivity(req.user._id, 'Updated focus system', 'Productivity', 'productivity', productivity._id);
  res.json({ productivity });
}
