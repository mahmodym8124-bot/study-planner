import Productivity from '../models/Productivity.js';
import { recordActivity } from '../utils/activity.js';

export async function getProductivity(req, res) {
  const productivity = await Productivity.findOneAndUpdate({ user: req.user._id }, { $setOnInsert: { todos: [], reminders: [] } }, { new: true, upsert: true });
  res.json({ productivity });
}
export async function saveProductivity(req, res) {
  const productivity = await Productivity.findOneAndUpdate({ user: req.user._id }, req.body, { new: true, upsert: true, runValidators: true });
  await recordActivity(req.user._id, 'Updated focus system', 'Productivity', 'productivity', productivity._id);
  res.json({ productivity });
}
