import Note from '../models/Note.js';
import { recordActivity } from '../utils/activity.js';

function notePayload(body) {
  const payload = {};
  for (const key of ['title', 'content', 'folder', 'tags', 'pinned', 'favorite', 'links']) {
    if (body[key] !== undefined) payload[key] = body[key];
  }
  return payload;
}

export async function listNotes(req, res) {
  const q = { user: req.user._id };
  if (req.query.folder) q.folder = req.query.folder;
  const notes = await Note.find(q).sort({ pinned: -1, updatedAt: -1 }).lean();
  res.json({ data: notes });
}
export async function createNote(req, res) {
  if (!req.body.title || String(req.body.title).trim().length === 0) return res.status(400).json({ message: 'Title is required' });
  const note = await Note.create({ ...notePayload(req.body), user: req.user._id });
  await recordActivity(req.user._id, 'Created note', note.title, 'note', note._id);
  res.status(201).json({ data: note });
}

export async function getNote(req, res) {
  const note = await Note.findById(req.params.id).lean();
  if (!note) return res.status(404).json({ message: 'Note not found' });
  // Hide existence of other users' notes
  if (note.user.toString() !== req.user._id.toString()) return res.status(404).json({ message: 'Note not found' });
  res.json({ data: note });
}
export async function updateNote(req, res) {
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).json({ message: 'Note not found' });
  if (note.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });
  Object.assign(note, notePayload(req.body));
  await note.save();
  await recordActivity(req.user._id, 'Updated note', note.title, 'note', note._id);
  res.json({ data: note.toObject() });
}
export async function deleteNote(req, res) {
  const note = await Note.findById(req.params.id);
  if (!note) return res.status(404).json({ message: 'Note not found' });
  if (note.user.toString() !== req.user._id.toString()) return res.status(403).json({ message: 'Forbidden' });
  await Note.findByIdAndDelete(req.params.id);
  await recordActivity(req.user._id, 'Deleted note', note.title, 'note', note._id);
  res.json({ ok: true });
}
