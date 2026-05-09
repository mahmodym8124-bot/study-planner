import Idea from '../models/Idea.js';
import { recordActivity } from '../utils/activity.js';

export async function listIdeas(req, res) {
  const ideas = await Idea.find({ user: req.user._id }).sort({ updatedAt: -1 });
  res.json({ ideas });
}
export async function createIdea(req, res) {
  const idea = await Idea.create({ ...req.body, user: req.user._id });
  await recordActivity(req.user._id, 'Created idea', idea.title, 'idea', idea._id);
  res.status(201).json({ idea });
}
export async function updateIdea(req, res) {
  const idea = await Idea.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true, runValidators: true });
  if (!idea) return res.status(404).json({ message: 'Idea not found' });
  await recordActivity(req.user._id, 'Updated idea', idea.title, 'idea', idea._id);
  res.json({ idea });
}
export async function deleteIdea(req, res) {
  const idea = await Idea.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!idea) return res.status(404).json({ message: 'Idea not found' });
  await recordActivity(req.user._id, 'Deleted idea', idea.title, 'idea', idea._id);
  res.json({ ok: true });
}
