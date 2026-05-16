import Note from '../models/Note.js';
import Idea from '../models/Idea.js';

export async function getGraphNodes(req, res) {
  const notes = await Note.find({ user: req.user._id }).lean();
  const ideas = await Idea.find({ user: req.user._id }).lean();

  const nodes = [];
  const nodeMap = new Map();

  // Add notes as nodes
  notes.forEach(note => {
    const id = `note_${note._id}`;
    nodes.push({
      id,
      label: note.title || 'Untitled',
      type: 'note',
      data: {
        _id: note._id,
        title: note.title,
        tags: note.tags || [],
        folder: note.folder,
        createdAt: note.createdAt
      }
    });
    nodeMap.set(id, note);
  });

  // Add ideas as nodes
  ideas.forEach(idea => {
    const id = `idea_${idea._id}`;
    nodes.push({
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
    });
    nodeMap.set(id, idea);
  });

  // Generate edges based on shared tags
  const edges = [];
  const edgeSet = new Set();

  nodes.forEach(node1 => {
    nodes.forEach(node2 => {
      if (node1.id === node2.id) return;

      const tags1 = node1.data.tags || [];
      const tags2 = node2.data.tags || [];
      
      const sharedTags = tags1.filter(t => tags2.includes(t));
      if (sharedTags.length > 0) {
        const edgeId = [node1.id, node2.id].sort().join('_');
        if (!edgeSet.has(edgeId)) {
          edges.push({
            source: node1.id,
            target: node2.id,
            label: sharedTags.join(', '),
            weight: sharedTags.length
          });
          edgeSet.add(edgeId);
        }
      }
    });
  });

  // Sort by weight and limit to top N edges for performance
  edges.sort((a, b) => b.weight - a.weight);
  const maxEdges = Math.min(edges.length, nodes.length * 3);
  const limitedEdges = edges.slice(0, maxEdges);

  res.json({ nodes, edges: limitedEdges, count: { notes: notes.length, ideas: ideas.length } });
}

export async function getGraphNode(req, res) {
  const { id } = req.params;

  let node;
  if (id.startsWith('note_')) {
    const noteId = id.replace('note_', '');
    node = await Note.findById(noteId).lean();
    if (!node || node.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Note not found' });
    }
    return res.json({ node: { ...node, type: 'note' } });
  }

  if (id.startsWith('idea_')) {
    const ideaId = id.replace('idea_', '');
    node = await Idea.findById(ideaId).lean();
    if (!node || node.user.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: 'Idea not found' });
    }
    return res.json({ node: { ...node, type: 'idea' } });
  }

  res.status(400).json({ error: 'Invalid node ID format' });
}
