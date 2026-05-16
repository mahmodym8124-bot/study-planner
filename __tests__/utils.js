import request from 'supertest';
import app from '../server/server.js';
import User from '../server/models/User.js';
import Note from '../server/models/Note.js';
import Idea from '../server/models/Idea.js';
import { testUser } from './fixtures/data.fixture.js';

export const createTestUser = async (userData = {}) => {
  const user = new User({ ...testUser, ...userData });
  await user.save();
  return user;
};

export const createTestNote = async (user, noteData = {}) => {
  const note = new Note({
    user: user._id,
    title: 'Test Note',
    content: 'Test content',
    ...noteData
  });
  await note.save();
  return note;
};

export const createTestIdea = async (user, ideaData = {}) => {
  const idea = new Idea({
    user: user._id,
    title: 'Test Idea',
    description: 'Test description',
    status: 'active',
    ...ideaData
  });
  await idea.save();
  return idea;
};

export const getAuthToken = async (credentials = testUser) => {
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      email: credentials.email,
      password: credentials.password
    });
  return res.body.data?.token || res.body.token;
};

export const makeAuthenticatedRequest = async (credentials = testUser) => {
  const token = await getAuthToken(credentials);
  return request(app).set('Authorization', `Bearer ${token}`);
};

export const expectStatusAndBody = (res, status, expectedKeys = []) => {
  expect(res.status).toBe(status);
  expectedKeys.forEach(key => {
    expect(res.body).toHaveProperty(key);
  });
};

export { app };
