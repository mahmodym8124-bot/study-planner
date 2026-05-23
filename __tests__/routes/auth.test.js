import {
  createTestUser,
  getAuthToken,
  makeAuthenticatedRequest,
  app
} from '../utils.js';
import { testUser, testUser2, validationErrors } from '../fixtures/data.fixture.js';
import request from 'supertest';
import crypto from 'crypto';
import { jest } from '@jest/globals';
import User from '../../server/models/User.js';

const itIfMongo = it;

function makeResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function resetRequest(ipSuffix) {
  return request(app)
    .post('/api/auth/reset-password')
    .set('X-Forwarded-For', `203.0.113.${ipSuffix}`);
}

async function seedResetToken({ expiresAt = new Date(Date.now() + (60 * 60 * 1000)) } = {}) {
  await createTestUser();
  const rawToken = makeResetToken();
  await User.updateOne(
    { email: testUser.email.toLowerCase() },
    { $set: { resetToken: hashResetToken(rawToken), resetExpires: expiresAt } }
  );
  return rawToken;
}

describe('Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user and request email verification', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Account created. Please check your email to verify your account.');

      const user = await User.findOne({ email: testUser.email.toLowerCase() }).select('+verificationToken');
      expect(user).toBeTruthy();
      expect(user.verified).toBe(false);
      expect(user.verificationToken).toBeTruthy();
      expect(user.verificationToken).toMatch(/^[a-f0-9]{64}$/);
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

  describe('POST /api/auth/google', () => {
    it('should require Google auth configuration', async () => {
      const previousClientId = process.env.GOOGLE_CLIENT_ID;
      const previousViteClientId = process.env.VITE_GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.VITE_GOOGLE_CLIENT_ID;

      try {
        const res = await request(app)
          .post('/api/auth/google')
          .send({ credential: 'fake-google-credential-with-enough-length' });

        expect(res.status).toBe(503);
        expect(res.body.error).toBe('Google sign-in is not configured');
      } finally {
        if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
        else process.env.GOOGLE_CLIENT_ID = previousClientId;
        if (previousViteClientId === undefined) delete process.env.VITE_GOOGLE_CLIENT_ID;
        else process.env.VITE_GOOGLE_CLIENT_ID = previousViteClientId;
      }
    });
  });

  describe('POST /api/auth/verify-email', () => {
    itIfMongo('should verify email with a valid token', async () => {
      const token = crypto.randomBytes(32).toString('hex');
      await createTestUser({
        verified: false,
        verificationToken: hashResetToken(token),
        verificationTokenExpires: new Date(Date.now() + (24 * 60 * 60 * 1000))
      });

      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Email verified successfully. You can now log in.');

      const user = await User.findOne({ email: testUser.email.toLowerCase() });
      expect(user.verified).toBe(true);
      expect(user.verificationToken).toBeFalsy();
      expect(user.verificationTokenExpires).toBeFalsy();
    });

    it('should reject invalid verification token', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: crypto.randomBytes(32).toString('hex') });

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

    it('should rate limit forgot-password after 3 attempts without limiting login or register', async () => {
      jest.useFakeTimers({
        doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']
      });
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      try {
        const rateLimitIp = '203.0.113.42';
        const sendForgotPassword = () => request(app)
          .post('/api/auth/forgot-password')
          .set('X-Forwarded-For', rateLimitIp)
          .send({ email: 'limited@example.com' });

        for (let i = 0; i < 3; i += 1) {
          const res = await sendForgotPassword();
          expect(res.status).toBe(200);
          expect(res.body.message).toBe('If an account exists, a reset email has been sent.');
        }

        const blocked = await sendForgotPassword();
        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toBe('Too many attempts. Try again in 15 minutes.');

        const loginRes = await request(app)
          .post('/api/auth/login')
          .set('X-Forwarded-For', rateLimitIp)
          .send({ email: 'missing@example.com', password: 'Strong123!' });
        expect(loginRes.status).toBe(400);

        const registerRes = await request(app)
          .post('/api/auth/register')
          .set('X-Forwarded-For', rateLimitIp)
          .send({
            name: 'Rate Limit Check',
            email: 'rate-limit-check@example.com',
            password: 'Strong123!'
          });
        expect(registerRes.status).toBe(201);
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reject invalid reset token payload', async () => {
      const res = await resetRequest(50)
        .send({ token: 'short', password: 'Strong123!' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
    });

    itIfMongo('should reset password with a valid token and allow login with the new password', async () => {
      const rawToken = await seedResetToken();

      const res = await resetRequest(51)
        .send({ token: rawToken, password: 'NewStrong123!' });

      expect(res.status).toBe(200);

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: testUser.email, password: 'NewStrong123!' });
      expect(loginRes.status).toBe(200);
    });

    itIfMongo('should reject an expired reset token', async () => {
      jest.useFakeTimers({
        doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']
      });
      jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      try {
        const rawToken = await seedResetToken({ expiresAt: new Date(Date.now() - 1000) });

        const res = await resetRequest(52)
          .send({ token: rawToken, password: 'NewStrong123!' });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Reset link is invalid or expired');
      } finally {
        jest.useRealTimers();
      }
    });

    it('should reject an invalid but well-formed reset token', async () => {
      const res = await resetRequest(53)
        .send({ token: makeResetToken(), password: 'NewStrong123!' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Reset link is invalid or expired');
    });

    itIfMongo.each(['123', 'password'])('should reject weak reset password "%s"', async (weakPassword) => {
      const rawToken = await seedResetToken();

      const res = await resetRequest(54)
        .send({ token: rawToken, password: weakPassword });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
      expect(res.body.errors).toBeTruthy();
    });

    itIfMongo('should reject reuse of a reset token after it is consumed', async () => {
      const rawToken = await seedResetToken();

      const firstReset = await resetRequest(55)
        .send({ token: rawToken, password: 'NewStrong123!' });
      expect(firstReset.status).toBe(200);

      const secondReset = await resetRequest(55)
        .send({ token: rawToken, password: 'AnotherStrong123!' });
      expect(secondReset.status).toBe(400);
      expect(secondReset.body.message).toBe('Reset link is invalid or expired');
    });

    it.each([
      [{ password: 'Strong123!' }],
      [{ token: makeResetToken() }]
    ])('should reject missing reset-password fields', async (payload) => {
      const res = await resetRequest(56)
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Validation failed');
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
