import {
  createTestUser,
  getAuthToken,
  makeAuthenticatedRequest,
  app
} from '../utils.js';
import { testUser, testUser2, validationErrors } from '../fixtures/data.fixture.js';
import request from 'supertest';
import crypto from 'crypto';
import User from '../../server/models/User.js';

const itIfMongo = process.platform === 'win32' ? it.skip : it;

describe('Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user and request email verification', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Account created. Please check your email to verify your account.');

      const user = await User.findOne({ email: testUser.email.toLowerCase() });
      expect(user).toBeTruthy();
      expect(user.verified).toBe(false);
      expect(user.verificationToken).toBeTruthy();
      expect(user.verificationTokenExpires).toBeTruthy();
    });

    it('should reject duplicate email', async () => {
      await createTestUser();
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(409);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, email: 'invalid' });

      expect(res.status).toBe(422);
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...testUser, password: 'short' });

      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await createTestUser();
    });

    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('token');
    });

    it('should reject invalid email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'wrong@example.com',
          password: testUser.password
        });

      expect(res.status).toBe(400);
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword'
        });

      expect(res.status).toBe(400);
    });

    it('should block login for unverified users', async () => {
      await User.deleteMany({});
      await createTestUser({ email: testUser.email, verified: false });

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Please verify your email before logging in. Check your inbox.');
    });
  });

  describe('GET /api/auth/verify-email', () => {
    itIfMongo('should verify email with a valid token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      await createTestUser({
        verified: false,
        verificationToken: token,
        verificationTokenExpires: new Date(Date.now() + (24 * 60 * 60 * 1000))
      });

      const res = await request(app)
        .get(`/api/auth/verify-email?token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Email verified successfully. You can now log in.');

      const user = await User.findOne({ email: testUser.email.toLowerCase() });
      expect(user.verified).toBe(true);
      expect(user.verificationToken).toBeFalsy();
      expect(user.verificationTokenExpires).toBeFalsy();
    });

    it('should reject invalid verification token', async () => {
      const res = await request(app)
        .get(`/api/auth/verify-email?token=${crypto.randomBytes(32).toString('hex')}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Invalid or expired verification link.');
    });
  });

  describe('POST /api/auth/refresh-token', () => {
    let token;

    beforeEach(async () => {
      await createTestUser();
      token = await getAuthToken();
    });

    it('should refresh token with valid token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('token');
    });

    it('should reject request without token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token');

      expect(res.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const res = await request(app)
        .post('/api/auth/refresh-token')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should return generic success for unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'missing@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('If an account exists, a reset email has been sent.');
    });

    itIfMongo('should store reset token data for an existing account', async () => {
      await createTestUser();
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email });

      expect(res.status).toBe(200);
      const user = await User.findOne({ email: testUser.email.toLowerCase() }).select('+resetToken +resetExpires');
      expect(user.resetToken).toBeTruthy();
      expect(user.resetExpires).toBeTruthy();
    });

    itIfMongo('should not create reset token for unverified accounts', async () => {
      await createTestUser({ verified: false });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('If an account exists, a reset email has been sent.');

      const user = await User.findOne({ email: testUser.email.toLowerCase() }).select('+resetToken +resetExpires');
      expect(user.resetToken).toBeFalsy();
      expect(user.resetExpires).toBeFalsy();
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reject invalid reset token payload', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'short', password: 'Strong123!' });

      expect(res.status).toBe(422);
    });

    itIfMongo('should reset password with a valid token', async () => {
      const user = await createTestUser();
      const rawToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await User.updateOne(
        { email: testUser.email.toLowerCase() },
        { $set: { resetToken: resetTokenHash, resetExpires: new Date(Date.now() + (60 * 60 * 1000)) } }
      );

      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, password: 'NewStrong123!' });

      expect(res.status).toBe(200);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'NewStrong123!' });
      expect(loginRes.status).toBe(200);
    });
  });

  describe('Protected Routes', () => {
    it('should deny access without token', async () => {
      const res = await request(app)
        .get('/api/workspace/stats');

      expect(res.status).toBe(401);
    });

    it('should allow access with valid token', async () => {
      await createTestUser();
      const req = await makeAuthenticatedRequest();
      const res = await req.get('/api/workspace/stats');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('data');
    });
  });
});
