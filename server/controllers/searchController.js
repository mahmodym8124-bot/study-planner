import Note from '../models/Note.js';
import Idea from '../models/Idea.js';

export async function search(req, res) {
  const { q, limit = 20, skip = 0 } = req.query;

  if (!q || q.trim().length === 0) {
    return res.json({ results: [], total: 0, limit, skip });
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
    .limit(parseInt(limit))
    .skip(parseInt(skip))
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
    .limit(parseInt(limit))
    .skip(parseInt(skip))
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
    results: results.slice(0, parseInt(limit)),
    total: totalNotes + totalIdeas,
    limit: parseInt(limit),
    skip: parseInt(skip),
    query: q
  });
}
