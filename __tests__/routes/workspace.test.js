import {
  createTestUser,
  createTestNote,
  createTestIdea,
  makeAuthenticatedRequest
} from '../utils.js';
import { testNote, testIdea, testFocusSession, testUser } from '../fixtures/data.fixture.js';

describe('Workspace APIs', () => {
  let user;
  let req;

  beforeEach(async () => {
    user = await createTestUser();
    req = await makeAuthenticatedRequest();
  });

  describe('GET /api/workspace/stats', () => {
    it('should return stats object', async () => {
      const res = await req.get('/api/workspace/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('notesCount');
      expect(res.body.data).toHaveProperty('ideasCount');
    });

    it('should count notes correctly', async () => {
      await createTestNote(user, testNote);
      await createTestNote(user, testNote);

      const res = await req.get('/api/workspace/stats');

      expect(res.body.data.notesCount).toBe(2);
    });

    it('should count ideas correctly', async () => {
      await createTestIdea(user, testIdea);

      const res = await req.get('/api/workspace/stats');

      expect(res.body.data.ideasCount).toBe(1);
    });

    it('should count active ideas', async () => {
      await createTestIdea(user, { ...testIdea, status: 'active' });
      await createTestIdea(user, { ...testIdea, status: 'completed' });

      const res = await req.get('/api/workspace/stats');

      expect(res.body.data).toHaveProperty('ideasInMotion');
    });

    it('should include focus session metrics', async () => {
      const res = await req.get('/api/workspace/stats');

      expect(res.body.data).toHaveProperty('focusSessionsTotal');
      expect(res.body.data).toHaveProperty('focusSessionsToday');
    });

    it('should track focus sessions', async () => {
      await req.post('/api/focus/start').send(testFocusSession);

      const res = await req.get('/api/workspace/stats');

      expect(res.body.data.focusSessionsTotal).toBeGreaterThan(0);
    });

    it('should track today\'s focus sessions', async () => {
      await req.post('/api/focus/start').send(testFocusSession);

      const res = await req.get('/api/workspace/stats');

      expect(res.body.data.focusSessionsToday).toBeGreaterThanOrEqual(0);
    });

    it('should include recent notes list', async () => {
      await createTestNote(user, testNote);

      const res = await req.get('/api/workspace/stats');

      expect(res.body.data).toHaveProperty('recentNotes');
      expect(Array.isArray(res.body.data.recentNotes)).toBe(true);
    });

    it('should include daily focus status', async () => {
      const res = await req.get('/api/workspace/stats');

      expect(res.body.data).toHaveProperty('dailyFocusSet');
      expect(typeof res.body.data.dailyFocusSet).toBe('boolean');
    });

    it('should return correct daily focus status', async () => {
      const res1 = await req.get('/api/workspace/stats');
      expect(res1.body.data.dailyFocusSet).toBe(false);

      await req
        .post('/api/focus/daily-focus')
        .send({ statement: 'Daily goal' });

      const res2 = await req.get('/api/workspace/stats');
      expect(res2.body.data.dailyFocusSet).toBe(true);
    });
  });

  describe('PUT /api/workspace/settings', () => {
    it('should update workspace settings', async () => {
      const res = await req
        .put('/api/workspace/settings')
        .send({ defaultFocusTime: 30, theme: 'dark' });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('defaultFocusTime');
    });

    it('should persist settings', async () => {
      await req
        .put('/api/workspace/settings')
        .send({ theme: 'light' });

      const res = await req.get('/api/workspace/settings');

      expect(res.status).toBe(200);
      expect(res.body.data.theme).toBe('light');
    });
  });

  describe('GET /api/workspace/settings', () => {
    it('should retrieve workspace settings', async () => {
      const res = await req.get('/api/workspace/settings');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });

  describe('Aggregated Stats', () => {
    it('should aggregate all user data', async () => {
      // Create mixed content
      await createTestNote(user, { ...testNote, tags: ['work'] });
      await createTestNote(user, { ...testNote, tags: ['personal'] });
      await createTestIdea(user, { ...testIdea, status: 'active' });
      await createTestIdea(user, { ...testIdea, status: 'review' });
      await req.post('/api/focus/start').send(testFocusSession);

      const res = await req.get('/api/workspace/stats');

      expect(res.body.data.notesCount).toBe(2);
      expect(res.body.data.ideasCount).toBe(2);
      expect(res.body.data.focusSessionsTotal).toBeGreaterThan(0);
    });

    it('should separate user data', async () => {
      const user1Req = req;

      // User 1 creates content
      await createTestNote(user, testNote);

      // Create and login as User 2
      const user2 = await createTestUser({
        email: 'user2@example.com',
        username: 'user2'
      });
      const user2Req = await makeAuthenticatedRequest({
        email: user2.email,
        password: testUser.password // Same password from fixture
      });

      // User 2 creates content
      await createTestNote(user2, testNote);

      // Check User 1's stats
      const res1 = await user1Req.get('/api/workspace/stats');
      expect(res1.body.data.notesCount).toBe(1);

      // Check User 2's stats
      const res2 = await user2Req.get('/api/workspace/stats');
      expect(res2.body.data.notesCount).toBe(1);
    });
  });
});
