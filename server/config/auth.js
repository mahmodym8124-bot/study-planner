const TEST_JWT_SECRET = 'test-only-secret-that-is-long-enough-for-jwt-signing';
const MAX_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function looksLikePlaceholder(value = '') {
  const normalized = String(value).trim().toLowerCase();
  return !normalized
    || normalized.startsWith('replace')
    || normalized.includes('change-me')
    || normalized.includes('changeme')
    || normalized === 'secret';
}

function durationToMs(value) {
  const match = String(value || '').trim().match(/^(\d+)([smhd])$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unitMs = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[match[2]];
  return amount * unitMs;
}

export function getJwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (secret && !looksLikePlaceholder(secret) && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'test') return TEST_JWT_SECRET;

  if (!secret) throw new Error('JWT_SECRET must be set');
  if (looksLikePlaceholder(secret)) throw new Error('JWT_SECRET must not be a placeholder value');
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

export function getJwtExpiresIn() {
  const value = String(process.env.JWT_EXPIRES_IN || (process.env.NODE_ENV === 'test' ? '1h' : '2h')).trim();
  const durationMs = durationToMs(value);
  if (!durationMs) {
    throw new Error('JWT_EXPIRES_IN must use a duration like 15m, 2h, or 7d');
  }
  if (durationMs > MAX_SESSION_MS) {
    throw new Error('JWT_EXPIRES_IN must not exceed 7d');
  }

  return value;
}
