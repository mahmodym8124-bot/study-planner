import {
  createTestUser,
  createTestNote,
  createTestIdea,
  makeAuthenticatedRequest
} from '../utils.js';
import { testNote, testIdea } from '../fixtures/data.fixture.js';

describe('Graph APIs', () => {
  let user;
  let req;

  beforeEach(async () => {
    user = await createTestUser();
    req = await makeAuthenticatedRequest();
  });

  describe('GET /api/graph/nodes', () => {
    it('should return empty nodes initially', async () => {
      const res = await req.get('/api/graph/nodes');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('nodes');
      expect(res.body.data.nodes.length).toBe(0);
    });

    it('should return notes and ideas as nodes', async () => {
      await createTestNote(user, testNote);
      await createTestIdea(user, testIdea);

      const res = await req.get('/api/graph/nodes');

      expect(res.status).toBe(200);
      expect(res.body.data.nodes.length).toBe(2);
    });

    it('should include node metadata', async () => {
      const note = await createTestNote(user, { title: 'Tagged Note', tags: ['test', 'example'] });

      const res = await req.get('/api/graph/nodes');

      const nodeData = res.body.data.nodes[0];
      expect(nodeData).toHaveProperty('id');
      expect(nodeData).toHaveProperty('label');
      expect(nodeData).toHaveProperty('type');
      expect(nodeData).toHaveProperty('data');
    });

    it('should include edge information', async () => {
      await createTestNote(user, { title: 'Note 1', tags: ['shared'] });
      await createTestNote(user, { title: 'Note 2', tags: ['shared'] });

      const res = await req.get('/api/graph/nodes');

      expect(res.body.data).toHaveProperty('edges');
      expect(Array.isArray(res.body.data.edges)).toBe(true);
    });

    it('should generate edges for shared tags', async () => {
      await createTestNote(user, { title: 'Note 1', tags: ['design', 'ux'] });
      await createTestNote(user, { title: 'Note 2', tags: ['design', 'research'] });

      const res = await req.get('/api/graph/nodes');

      expect(res.body.data.edges.length).toBeGreaterThan(0);
    });

    it('should include metadata count', async () => {
      await createTestNote(user, testNote);
      await createTestIdea(user, testIdea);

      const res = await req.get('/api/graph/nodes');

      expect(res.body.data).toHaveProperty('count');
      expect(res.body.data.count.notes).toBe(1);
      expect(res.body.data.count.ideas).toBe(1);
    });
  });

  describe('GET /api/graph/nodes/:id', () => {
    it('should return note detail by ID', async () => {
      const note = await createTestNote(user, testNote);

      const res = await req.get(`/api/graph/nodes/note_${note._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.node).toHaveProperty('_id');
      expect(res.body.data.node.type).toBe('note');
    });

    it('should return idea detail by ID', async () => {
      const idea = await createTestIdea(user, testIdea);

      const res = await req.get(`/api/graph/nodes/idea_${idea._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.node.type).toBe('idea');
    });

    it('should return 404 for non-existent node', async () => {
      const res = await req.get('/api/graph/nodes/note_000000000000000000000000');

      expect(res.status).toBe(404);
    });

    it('should prevent accessing other user\'s data', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com', username: 'other' });
      const note = await createTestNote(otherUser, testNote);

      const res = await req.get(`/api/graph/nodes/note_${note._id}`);

      expect(res.status).toBe(404);
    });
  });
});

describe('Search API', () => {
  let user;
  let req;

  beforeEach(async () => {
    user = await createTestUser();
    req = await makeAuthenticatedRequest();
  });

  describe('GET /api/search', () => {
    beforeEach(async () => {
      await createTestNote(user, { title: 'Database Design', content: 'Schema planning' });
      await createTestNote(user, { title: 'UI Components', content: 'React components' });
      await createTestIdea(user, { title: 'API Architecture', description: 'REST endpoints' });
    });

    it('should search notes by title', async () => {
      const res = await req.get('/api/search?q=Database');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should search content with regex', async () => {
      const res = await req.get('/api/search?q=Schema');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should support case-insensitive search', async () => {
      const res1 = await req.get('/api/search?q=database');
      const res2 = await req.get('/api/search?q=DATABASE');

      expect(res1.body.data.length).toBeGreaterThan(0);
      expect(res2.body.data.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const res = await req.get('/api/search?q=&limit=2&skip=0');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });

    it('should return empty for no matches', async () => {
      const res = await req.get('/api/search?q=XYZ123NOTFOUND');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(0);
    });

    it('should search across multiple models', async () => {
      const res = await req.get('/api/search?q=API');

      expect(res.status).toBe(200);
      // Should find the idea with "API Architecture"
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('should include type in results', async () => {
      const res = await req.get('/api/search?q=Database');

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('type');
      }
    });
  });

  describe('Search Query Validation', () => {
    it('should handle empty query', async () => {
      const res = await req.get('/api/search?q=');

      expect(res.status).toBe(200);
    });

    it('should enforce limit bounds', async () => {
      const res = await req.get('/api/search?q=test&limit=1000');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(50); // Assuming max is 50
    });

    it('should validate skip parameter', async () => {
      const res = await req.get('/api/search?q=test&skip=abc');

      expect([200, 400]).toContain(res.status);
    });
  });
});
