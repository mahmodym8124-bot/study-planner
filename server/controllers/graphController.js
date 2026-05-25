import Note from '../models/Note.js';
import Idea from '../models/Idea.js';
import { operationTimeoutMS } from '../config/db.js';

const GRAPH_ITEMS_PER_TYPE_LIMIT = 150;
const GRAPH_EDGE_LIMIT_MULTIPLIER = 3;

function addTagEdges(tagIndex, edgesById, maxEdges) {
  for (const [tag, nodeIds] of tagIndex.entries()) {
    for (let i = 0; i < nodeIds.length; i += 1) {
      for (let j = i + 1; j < nodeIds.length; j += 1) {
        const [source, target] = [nodeIds[i], nodeIds[j]].sort();
        const edgeId = `${source}_${target}`;
        const existing = edgesById.get(edgeId);

        if (!existing && edgesById.size >= maxEdges) continue;

        if (existing) {
          existing.labels.add(tag);
          existing.weight = existing.labels.size;
        } else {
          edgesById.set(edgeId, {
            source,
            target,
            labels: new Set([tag]),
            weight: 1
          });
        }
      }
    }
  }
}

async function buildGraphData(userId) {
  const [
    notes,
    ideas,
    totalNotes,
    totalIdeas
  ] = await Promise.all([
    Note.find({ user: userId })
      .select('title tags folder thumbnail content createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(GRAPH_ITEMS_PER_TYPE_LIMIT)
      .maxTimeMS(operationTimeoutMS())
      .lean(),
    Idea.find({ user: userId })
      .select('title status priority tags createdAt updatedAt')
      .sort({ updatedAt: -1 })
      .limit(GRAPH_ITEMS_PER_TYPE_LIMIT)
      .maxTimeMS(operationTimeoutMS())
      .lean(),
    Note.countDocuments({ user: userId }).maxTimeMS(operationTimeoutMS()),
    Idea.countDocuments({ user: userId }).maxTimeMS(operationTimeoutMS())
  ]);

  const nodes = [];
  const tagIndex = new Map();

  function indexTags(node) {
    const tags = Array.isArray(node.data.tags) ? node.data.tags : [];
    tags.forEach((tag) => {
      const normalized = String(tag || '').trim();
      if (!normalized) return;
      const ids = tagIndex.get(normalized) || [];
      ids.push(node.id);
      tagIndex.set(normalized, ids);
    });
  }

  notes.forEach(note => {
    const id = `note_${note._id}`;
    const node = {
      id,
      label: note.title || 'Untitled',
      type: 'note',
      data: {
        _id: note._id,
        title: note.title,
        tags: note.tags || [],
        folder: note.folder,
        thumbnail: note.thumbnail || '',
        content: note.content || '',
        createdAt: note.createdAt
      }
    };
    nodes.push(node);
    indexTags(node);
  });

  ideas.forEach(idea => {
    const id = `idea_${idea._id}`;
    const node = {
      id,
      label: idea.title || 'Untitled',
      type: 'idea',
      data: {
        _id: idea._id,
        title: idea.title,
        status: idea.status,
        priority: idea.priority,
        tags: idea.tags || [],
        createdAt: idea.createdAt
      }
    };
    nodes.push(node);
    indexTags(node);
  });

  const edgesById = new Map();
  const maxEdges = Math.max(nodes.length * GRAPH_EDGE_LIMIT_MULTIPLIER, 0);
  addTagEdges(tagIndex, edgesById, maxEdges);

  const limitedEdges = [...edgesById.values()]
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      label: [...edge.labels].join(', '),
      weight: edge.weight
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, maxEdges);

  return {
    nodes,
    edges: limitedEdges,
    count: {
      notes: totalNotes,
      ideas: totalIdeas,
      visibleNotes: notes.length,
      visibleIdeas: ideas.length
    }
  };
}

export async function getGraphNodes(req, res) {
  const graph = await buildGraphData(req.user._id);
  res.json({ data: graph });
}

export async function getGraphData(req, res) {
  const graph = await buildGraphData(req.user._id);
  res.json(graph);
}

export async function getGraphNode(req, res) {
  const { id } = req.params;

  let node;
  if (id.startsWith('note_')) {
    const noteId = id.replace('note_', '');
    node = await Note.findOne({ _id: noteId, user: req.user._id }).lean();
    if (!node) {
      return res.status(404).json({ error: 'Note not found' });
    }
    return res.json({ data: { node: { ...node, type: 'note' } } });
  }

  if (id.startsWith('idea_')) {
    const ideaId = id.replace('idea_', '');
    node = await Idea.findOne({ _id: ideaId, user: req.user._id }).lean();
    if (!node) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    return res.json({ data: { node: { ...node, type: 'idea' } } });
  }

  res.status(400).json({ error: 'Invalid node ID format' });
}
