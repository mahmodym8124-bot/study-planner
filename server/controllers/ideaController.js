import Idea from '../models/Idea.js';
import { operationTimeoutMS } from '../config/db.js';
import { recordActivitySoon } from '../utils/activity.js';

function ideaPayload(body) {
  const payload = {};
  for (const key of ['title', 'description', 'category', 'status', 'priority', 'progress', 'tags']) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
}

export async function listIdeas(req, res) {
  const q = { user: req.user._id };
  if (req.query.status) q.status = req.query.status;
  const ideas = await Idea.find(q).sort({ updatedAt: -1 }).maxTimeMS(operationTimeoutMS()).lean();
  res.json({ data: ideas });
}
export async function createIdea(req, res) {
  if (!req.body.title || String(req.body.title).trim().length === 0) return res.status(400).json({ message: 'Title is required' });
  const idea = await Idea.create({ ...ideaPayload(req.body), user: req.user._id });
  recordActivitySoon(req.user._id, 'Created idea', idea.title, 'idea', idea._id);
  res.status(201).json({ data: idea });
}
export async function updateIdea(req, res) {
  const idea = await Idea.findOne({ _id: req.params.id, user: req.user._id }).maxTimeMS(operationTimeoutMS());
  if (!idea) return res.status(404).json({ message: 'Idea not found' });
  Object.assign(idea, ideaPayload(req.body));
  await idea.save();
  recordActivitySoon(req.user._id, 'Updated idea', idea.title, 'idea', idea._id);
  res.json({ data: idea.toObject() });
}
export async function deleteIdea(req, res) {
  const idea = await Idea.findOne({ _id: req.params.id, user: req.user._id }).maxTimeMS(operationTimeoutMS());
  if (!idea) return res.status(404).json({ message: 'Idea not found' });
  await Idea.deleteOne({ _id: req.params.id, user: req.user._id }).maxTimeMS(operationTimeoutMS());
  recordActivitySoon(req.user._id, 'Deleted idea', idea.title, 'idea', idea._id);
  res.json({ ok: true });
}
