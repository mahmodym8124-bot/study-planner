export const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'TestPassword123!'
};

export const testUser2 = {
  username: 'testuser2',
  email: 'test2@example.com',
  password: 'TestPassword456!'
};

export const testNote = {
  title: 'Test Note',
  content: 'This is a test note content',
  tags: ['test', 'example']
};

export const testNote2 = {
  title: 'Another Note',
  content: 'Different content here',
  tags: ['work', 'notes'],
  folder: 'Work'
};

export const testIdea = {
  title: 'Test Idea',
  description: 'An interesting concept to explore',
  status: 'active',
  priority: 'high',
  tags: ['brainstorm', 'innovation']
};

export const testIdea2 = {
  title: 'Follow-up Idea',
  description: 'Related to previous idea',
  status: 'review',
  priority: 'medium',
  tags: ['development', 'feature']
};

export const testFocusSession = {
  workDuration: 25,
  breakDuration: 5,
  status: 'pending'
};

export const validationErrors = {
  emptyEmail: { email: '' },
  invalidEmail: { email: 'notanemail' },
  shortPassword: { password: 'short' },
  emptyTitle: { title: '' },
  missingContent: { content: '' }
};
