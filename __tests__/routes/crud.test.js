import {
  createTestUser,
  createTestNote,
  createTestIdea,
  makeAuthenticatedRequest
} from '../utils.js';
import { testNote, testNote2, testIdea, testIdea2 } from '../fixtures/data.fixture.js';

describe('Notes CRUD', () => {
  let user;
  let req;

  beforeEach(async () => {
    user = await createTestUser();
    req = await makeAuthenticatedRequest();
  });

  describe('POST /api/notes', () => {
    it('should create a note', async () => {
      const res = await req.post('/api/notes').send(testNote);

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data.title).toBe(testNote.title);
      expect(res.body.data.user).toBe(user._id.toString());
    });

    it('should reject note without title', async () => {
      const res = await req.post('/api/notes').send({ content: 'No title' });

      expect(res.status).toBe(422);
    });

    it('should create note with tags', async () => {
      const res = await req.post('/api/notes').send(testNote);

      expect(res.body.data.tags).toEqual(testNote.tags);
    });
  });

  describe('GET /api/notes', () => {
    it('should get empty list initially', async () => {
      const res = await req.get('/api/notes');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('should get all notes for user', async () => {
      await createTestNote(user, testNote);
      await createTestNote(user, testNote2);

      const res = await req.get('/api/notes');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('should filter notes by folder', async () => {
      await createTestNote(user, testNote);
      await createTestNote(user, testNote2);

      const res = await req.get('/api/notes?folder=Work');

      expect(res.status).toBe(200);
      expect(res.body.data.every(n => n.folder === 'Work')).toBe(true);
    });
  });

  describe('GET /api/notes/:id', () => {
    it('should get a specific note', async () => {
      const note = await createTestNote(user, testNote);

      const res = await req.get(`/api/notes/${note._id}`);

      expect(res.status).toBe(200);
      expect(res.body.data._id).toBe(note._id.toString());
      expect(res.body.data.title).toBe(testNote.title);
    });

    it('should return 404 for non-existent note', async () => {
      const res = await req.get('/api/notes/000000000000000000000000');

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('should update a note', async () => {
      const note = await createTestNote(user, testNote);
      const updatedData = { title: 'Updated Title', content: 'Updated content' };

      const res = await req
        .put(`/api/notes/${note._id}`)
        .send(updatedData);

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe(updatedData.title);
      expect(res.body.data.content).toBe(updatedData.content);
    });

    it('should not allow updating another user\'s note', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com', username: 'other' });
      const note = await createTestNote(otherUser, testNote);

      const res = await req
        .put(`/api/notes/${note._id}`)
        .send({ title: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('should delete a note', async () => {
      const note = await createTestNote(user, testNote);

      const res = await req.delete(`/api/notes/${note._id}`);

      expect(res.status).toBe(200);

      const checkRes = await req.get(`/api/notes/${note._id}`);
      expect(checkRes.status).toBe(404);
    });

    it('should not allow deleting another user\'s note', async () => {
      const otherUser = await createTestUser({ email: 'other@example.com', username: 'other' });
      const note = await createTestNote(otherUser, testNote);

      const res = await req.delete(`/api/notes/${note._id}`);

      expect(res.status).toBe(403);
    });
  });
});

describe('Ideas CRUD', () => {
  let user;
  let req;

  beforeEach(async () => {
    user = await createTestUser();
    req = await makeAuthenticatedRequest();
  });

  describe('POST /api/ideas', () => {
    it('should create an idea', async () => {
      const res = await req.post('/api/ideas').send(testIdea);

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe(testIdea.title);
      expect(res.body.data.status).toBe(testIdea.status);
    });

    it('should reject idea without title', async () => {
      const res = await req
        .post('/api/ideas')
        .send({ description: 'No title' });

      expect(res.status).toBe(422);
    });

    it('should set default status to active', async () => {
      const res = await req
        .post('/api/ideas')
        .send({ title: 'Test Idea', description: 'Test' });

      expect(res.body.data.status).toBe('active');
    });
  });

  describe('GET /api/ideas', () => {
    it('should get all ideas for user', async () => {
      await createTestIdea(user, testIdea);
      await createTestIdea(user, testIdea2);

      const res = await req.get('/api/ideas');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });

    it('should filter ideas by status', async () => {
      await createTestIdea(user, testIdea);
      await createTestIdea(user, testIdea2);

      const res = await req.get('/api/ideas?status=review');

      expect(res.status).toBe(200);
      expect(res.body.data.every(i => i.status === 'review')).toBe(true);
    });
  });

  describe('PUT /api/ideas/:id', () => {
    it('should update idea status', async () => {
      const idea = await createTestIdea(user, testIdea);

      const res = await req
        .put(`/api/ideas/${idea._id}`)
        .send({ status: 'review' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('review');
    });

    it('should update idea priority', async () => {
      const idea = await createTestIdea(user, testIdea);

      const res = await req
        .put(`/api/ideas/${idea._id}`)
        .send({ priority: 'low' });

      expect(res.status).toBe(200);
      expect(res.body.data.priority).toBe('low');
    });
  });

  describe('DELETE /api/ideas/:id', () => {
    it('should delete an idea', async () => {
      const idea = await createTestIdea(user, testIdea);

      const res = await req.delete(`/api/ideas/${idea._id}`);

      expect(res.status).toBe(200);

      const checkRes = await req.get(`/api/ideas/${idea._id}`);
      expect(checkRes.status).toBe(404);
    });
  });
});
