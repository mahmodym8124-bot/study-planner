import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { buildPasswordResetUrl, getMailConfigStatus } from '../../server/services/emailService.js';

const EMAIL_ENV_KEYS = [
  'NODE_ENV',
  'PASSWORD_RESET_BASE_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM_EMAIL',
  'SMTP_FROM_NAME'
];

const originalEnv = {};

function setValidGmailEnv(overrides = {}) {
  process.env.NODE_ENV = 'development';
  process.env.PASSWORD_RESET_BASE_URL = 'http://localhost:5173';
  process.env.SMTP_HOST = 'smtp.gmail.com';
  process.env.SMTP_PORT = '465';
  process.env.SMTP_USER = 'sender@gmail.com';
  process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
  process.env.SMTP_FROM_EMAIL = '';
  process.env.SMTP_FROM_NAME = 'MindVault';
  Object.assign(process.env, overrides);
}

beforeEach(() => {
  for (const key of EMAIL_ENV_KEYS) {
    originalEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of EMAIL_ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

describe('email service configuration', () => {
  it('reports missing Gmail SMTP configuration', () => {
    process.env.NODE_ENV = 'development';

    const status = getMailConfigStatus();

    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(expect.arrayContaining([
      'PASSWORD_RESET_BASE_URL',
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS'
    ]));
  });

  it('treats copied placeholder values as missing', () => {
    setValidGmailEnv({
      SMTP_USER: 'your-gmail-address@gmail.com',
      SMTP_PASS: 'your-16-character-gmail-app-password'
    });

    const status = getMailConfigStatus();

    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(expect.arrayContaining(['SMTP_USER', 'SMTP_PASS']));
  });

  it('accepts Gmail SMTP configuration without a separate from address', () => {
    setValidGmailEnv();

    const status = getMailConfigStatus();

    expect(status).toEqual({ configured: true, missing: [], invalid: [] });
  });

  it('requires HTTPS reset links in production', () => {
    setValidGmailEnv({ NODE_ENV: 'production' });

    const status = getMailConfigStatus();

    expect(status.configured).toBe(false);
    expect(status.invalid).toContain('PASSWORD_RESET_BASE_URL must use HTTPS in production');
  });

  it('builds direct reset links for app route handling', () => {
    setValidGmailEnv({ PASSWORD_RESET_BASE_URL: 'https://app.mindvault.test/' });

    const resetUrl = buildPasswordResetUrl('token with spaces');

    expect(resetUrl).toBe('https://app.mindvault.test/reset-password?token=token%20with%20spaces');
    expect(resetUrl).not.toContain('/#/reset-password');
  });
});
