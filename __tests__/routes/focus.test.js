import {
  createTestUser,
  makeAuthenticatedRequest
} from '../utils.js';
import { testFocusSession } from '../fixtures/data.fixture.js';

describe('Focus Session APIs', () => {
  let user;
  let req;

  beforeEach(async () => {
    user = await createTestUser();
    req = await makeAuthenticatedRequest();
  });

  describe('POST /api/focus/start', () => {
    it('should start a focus session', async () => {
      const res = await req
        .post('/api/focus/start')
        .send(testFocusSession);

      expect(res.status).toBe(201);
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.status).toBe('active');
    });

    it('should initialize with correct durations', async () => {
      const res = await req
        .post('/api/focus/start')
        .send(testFocusSession);

      expect(res.body.data.workDuration).toBe(testFocusSession.workDuration);
      expect(res.body.data.breakDuration).toBe(testFocusSession.breakDuration);
    });

    it('should set createdAt timestamp', async () => {
      const res = await req
        .post('/api/focus/start')
        .send(testFocusSession);

      expect(res.body.data).toHaveProperty('createdAt');
    });
  });

  describe('GET /api/focus', () => {
    it('should get user\'s focus sessions', async () => {
      await req.post('/api/focus/start').send(testFocusSession);
      await req.post('/api/focus/start').send(testFocusSession);

      const res = await req.get('/api/focus');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('should filter by status', async () => {
      await req.post('/api/focus/start').send(testFocusSession);

      const res = await req.get('/api/focus?status=active');

      expect(res.status).toBe(200);
      expect(res.body.data.every(s => s.status === 'active')).toBe(true);
    });

    it('should paginate results', async () => {
      for (let i = 0; i < 5; i++) {
        await req.post('/api/focus/start').send(testFocusSession);
      }

      const res = await req.get('/api/focus?limit=2&skip=0');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeLessThanOrEqual(2);
    });
  });

  describe('PUT /api/focus/:id', () => {
    let sessionId;

    beforeEach(async () => {
      const res = await req.post('/api/focus/start').send(testFocusSession);
      sessionId = res.body.data._id;
    });

    it('should pause a session', async () => {
      const res = await req
        .put(`/api/focus/${sessionId}`)
        .send({ status: 'paused' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('paused');
    });

    it('should resume a paused session', async () => {
      await req
        .put(`/api/focus/${sessionId}`)
        .send({ status: 'paused' });

      const res = await req
        .put(`/api/focus/${sessionId}`)
        .send({ status: 'active' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('active');
    });

    it('should complete a session', async () => {
      const res = await req
        .put(`/api/focus/${sessionId}`)
        .send({ status: 'completed' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data).toHaveProperty('completedAt');
    });

    it('should track elapsed seconds', async () => {
      const res = await req
        .put(`/api/focus/${sessionId}`)
        .send({ elapsedSeconds: 300 });

      expect(res.status).toBe(200);
      expect(res.body.data.elapsedSeconds).toBe(300);
    });
  });

  describe('POST /api/focus/daily-focus', () => {
    it('should set daily focus statement', async () => {
      const res = await req
        .post('/api/focus/daily-focus')
        .send({ statement: 'Complete the project milestone' });

      expect(res.status).toBe(201);
      expect(res.body.data.statement).toBe('Complete the project milestone');
    });

    it('should update daily focus on duplicate', async () => {
      await req
        .post('/api/focus/daily-focus')
        .send({ statement: 'First statement' });

      const res = await req
        .post('/api/focus/daily-focus')
        .send({ statement: 'Updated statement' });

      expect(res.status).toBe(200);
      expect(res.body.data.statement).toBe('Updated statement');
    });
  });

  describe('GET /api/focus/daily-focus', () => {
    it('should get today\'s daily focus', async () => {
      await req
        .post('/api/focus/daily-focus')
        .send({ statement: 'Daily goal' });

      const res = await req.get('/api/focus/daily-focus');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('statement');
    });

    it('should return null if not set', async () => {
      const res = await req.get('/api/focus/daily-focus');

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  describe('Focus Session Aggregation', () => {
    it('should aggregate sessions by status', async () => {
      const session1 = await req.post('/api/focus/start').send(testFocusSession);
      const session2 = await req.post('/api/focus/start').send(testFocusSession);

      await req
        .put(`/api/focus/${session1.body.data._id}`)
        .send({ status: 'completed' });

      const res = await req.get('/api/focus');

      expect(res.body.data.filter(s => s.status === 'completed').length).toBeGreaterThan(0);
      expect(res.body.data.filter(s => s.status === 'active').length).toBeGreaterThan(0);
    });
  });
});
