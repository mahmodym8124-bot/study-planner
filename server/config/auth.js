const FALLBACK_JWT_SECRET = 'dev-secret-change-me';

export function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return FALLBACK_JWT_SECRET;
}

export function getJwtExpiresIn() {
  return process.env.JWT_EXPIRES_IN || '7d';
}
