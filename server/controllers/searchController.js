import Note from '../models/Note.js';
import Idea from '../models/Idea.js';

export async function search(req, res) {
  const { q } = req.query;
  let limit = parseInt(req.query.limit) || 20;
  const skip = parseInt(req.query.skip) || 0;
  // cap limit to a reasonable max for performance/tests
  const MAX_LIMIT = 50;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  if (!q || q.trim().length === 0) {
    return res.json({ data: [], total: 0, limit, skip });
  }

  const searchRegex = new RegExp(q, 'i');

  const notePromise = Note.find(
    {
      user: req.user._id,
      $or: [
        { title: searchRegex },
        { content: searchRegex },
        { tags: searchRegex },
        { folder: searchRegex }
      ]
    },
    { content: 0 }
  )
    .sort({ updatedAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();

  const ideaPromise = Idea.find(
    {
      user: req.user._id,
      $or: [
        { title: searchRegex },
        { description: searchRegex },
        { tags: searchRegex },
        { category: searchRegex }
      ]
    }
  )
    .sort({ updatedAt: -1 })
    .limit(limit)
    .skip(skip)
    .lean();

  const [notes, ideas] = await Promise.all([notePromise, ideaPromise]);

  const results = [
    ...notes.map(n => ({ ...n, type: 'note' })),
    ...ideas.map(i => ({ ...i, type: 'idea' }))
  ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  const totalNotes = await Note.countDocuments({
    user: req.user._id,
    $or: [
      { title: searchRegex },
      { content: searchRegex },
      { tags: searchRegex },
      { folder: searchRegex }
    ]
  });

  const totalIdeas = await Idea.countDocuments({
    user: req.user._id,
    $or: [
      { title: searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
      { category: searchRegex }
    ]
  });

  res.json({
    data: results.slice(0, limit),
    total: totalNotes + totalIdeas,
    limit,
    skip,
    query: q
  });
}
