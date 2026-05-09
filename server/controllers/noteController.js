import Note from '../models/Note.js';
import { recordActivity } from '../utils/activity.js';

export async function listNotes(req, res) {
  const notes = await Note.find({ user: req.user._id }).sort({ pinned: -1, updatedAt: -1 });
  res.json({ notes });
}
export async function createNote(req, res) {
  const note = await Note.create({ ...req.body, user: req.user._id });
  await recordActivity(req.user._id, 'Created note', note.title, 'note', note._id);
  res.status(201).json({ note });
}
export async function updateNote(req, res) {
  const note = await Note.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, req.body, { new: true, runValidators: true });
  if (!note) return res.status(404).json({ message: 'Note not found' });
  await recordActivity(req.user._id, 'Updated note', note.title, 'note', note._id);
  res.json({ note });
}
export async function deleteNote(req, res) {
  const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!note) return res.status(404).json({ message: 'Note not found' });
  await recordActivity(req.user._id, 'Deleted note', note.title, 'note', note._id);
  res.json({ ok: true });
}
