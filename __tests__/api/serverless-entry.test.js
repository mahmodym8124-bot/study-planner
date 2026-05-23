import { describe, expect, it } from '@jest/globals';
import { normalizeVercelRequest } from '../../api/request-url.js';

describe('Vercel serverless entry', () => {
  it('restores rewritten API paths before handing requests to Express', () => {
    const req = {
      url: '/?path=auth%2Fforgot-password&lang=en',
      query: { path: 'auth/forgot-password', lang: 'en' }
    };

    const url = normalizeVercelRequest(req);

    expect(url).toBe('/api/auth/forgot-password?lang=en');
    expect(req.url).toBe('/api/auth/forgot-password?lang=en');
  });

  it('leaves requests without a rewrite path unchanged', () => {
    const req = { url: '/', query: {} };

    expect(normalizeVercelRequest(req)).toBe('/');
    expect(req.url).toBe('/');
  });
});
