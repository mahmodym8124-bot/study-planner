import Note from '../models/Note.js';
import Idea from '../models/Idea.js';
import { operationTimeoutMS } from '../config/db.js';

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSearchFilter(userId, searchRegex, fields) {
  return {
    user: userId,
    $or: fields.map((field) => ({ [field]: searchRegex }))
  };
}

export async function search(req, res) {
  const { q } = req.query;
  let limit = parseInt(req.query.limit) || 20;
  const skip = Math.max(0, parseInt(req.query.skip) || 0);
  // cap limit to a reasonable max for performance/tests
  const MAX_LIMIT = 50;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  if (!q || q.trim().length === 0) {
    return res.json({ data: [], total: 0, limit, skip });
  }

  const searchRegex = new RegExp(escapeRegex(q.trim()), 'i');
  const noteFilter = buildSearchFilter(req.user._id, searchRegex, ['title', 'content', 'tags', 'folder']);
  const ideaFilter = buildSearchFilter(req.user._id, searchRegex, ['title', 'description', 'tags', 'category']);

  const notePromise = Note.find(
    noteFilter,
    { content: 0 }
  )
    .sort({ updatedAt: -1 })
    .limit(limit)
    .skip(skip)
    .maxTimeMS(operationTimeoutMS())
    .lean();

  const ideaPromise = Idea.find(
    ideaFilter
  )
    .sort({ updatedAt: -1 })
    .limit(limit)
    .skip(skip)
    .maxTimeMS(operationTimeoutMS())
    .lean();

  const [
    notes,
    ideas,
    totalNotes,
    totalIdeas
  ] = await Promise.all([
    notePromise,
    ideaPromise,
    Note.countDocuments(noteFilter).maxTimeMS(operationTimeoutMS()),
    Idea.countDocuments(ideaFilter).maxTimeMS(operationTimeoutMS())
  ]);

  const results = [
    ...notes.map(n => ({ ...n, type: 'note' })),
    ...ideas.map(i => ({ ...i, type: 'idea' }))
  ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  res.json({
    data: results.slice(0, limit),
    total: totalNotes + totalIdeas,
    limit,
    skip,
    query: q
  });
}
