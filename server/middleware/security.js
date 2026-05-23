import crypto from 'crypto';
import rateLimit from 'express-rate-limit';

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|password|token|secret|credential|smtp|mongodb|jwt|key)/i;
const SUSPICIOUS_PATH_PATTERN = /(^|\/)(\.env|\.git|\.svn|\.hg|wp-admin|wp-login|phpmyadmin)|\.(php|asp|aspx|jsp)(?:$|\?)/i;
const SUSPICIOUS_UA_PATTERN = /(sqlmap|nikto|acunetix|nessus|masscan|nmap|dirbuster|gobuster|wpscan|havij)/i;

export function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
}

function redact(value, depth = 0) {
  if (depth > 4) return '[redacted-depth]';
  if (value?._bsontype === 'ObjectId') return value.toString();
  if (Array.isArray(value)) return value.slice(0, 10).map((entry) => redact(entry, depth + 1));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    SENSITIVE_KEY_PATTERN.test(key) ? '[redacted]' : redact(entry, depth + 1)
  ]));
}

export function logSecurityEvent(req, event, metadata = {}, level = 'info') {
  if (process.env.NODE_ENV === 'test' && process.env.SECURITY_LOG_TESTS !== 'true') return;

  const entry = {
    ts: new Date().toISOString(),
    requestId: req.id,
    event,
    level,
    method: req.method,
    path: req.originalUrl || req.url,
    ip: getClientIp(req),
    userId: req.user?._id || req.user?.id,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 240),
    metadata: redact(metadata)
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.info(line);
}

export function attachRequestId(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

export function enforceHttps(req, res, next) {
  const shouldEnforce = process.env.NODE_ENV === 'production' && process.env.ENFORCE_HTTPS !== 'false';
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const isHttps = req.secure || proto === 'https';

  if (!shouldEnforce || isHttps) return next();

  logSecurityEvent(req, 'https_required', { proto }, 'warn');
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.redirect(308, `https://${req.headers.host}${req.originalUrl || req.url}`);
  }

  return res.status(426).json({ message: 'HTTPS is required' });
}

function hasUnsafeMongoKey(value, depth = 0) {
  if (depth > 12 || !value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((entry) => hasUnsafeMongoKey(entry, depth + 1));

  return Object.entries(value).some(([key, entry]) => (
    key.startsWith('$')
      || key.includes('.')
      || key === '__proto__'
      || key === 'constructor'
      || key === 'prototype'
      || hasUnsafeMongoKey(entry, depth + 1)
  ));
}

export function rejectUnsafeMongoKeys(req, res, next) {
  if (hasUnsafeMongoKey(req.body) || hasUnsafeMongoKey(req.query) || hasUnsafeMongoKey(req.params)) {
    logSecurityEvent(req, 'unsafe_mongo_key_rejected', {}, 'warn');
    return res.status(400).json({ message: 'Invalid request payload' });
  }
  return next();
}

export function requireJsonForApi(req, res, next) {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return next();
  const hasBody = Number(req.headers['content-length'] || 0) > 0 || req.headers['transfer-encoding'];
  if (!hasBody) return next();
  if (req.is('application/json')) return next();

  logSecurityEvent(req, 'unsupported_content_type', { contentType: req.headers['content-type'] }, 'warn');
  return res.status(415).json({ message: 'Content-Type must be application/json' });
}

export function detectSuspiciousTraffic(req, res, next) {
  const userAgent = String(req.headers['user-agent'] || '');
  if (SUSPICIOUS_PATH_PATTERN.test(req.path)) {
    logSecurityEvent(req, 'suspicious_path_blocked', { path: req.originalUrl || req.url }, 'warn');
    return res.status(404).json({ message: 'Not found' });
  }

  if ((process.env.NODE_ENV !== 'test' && !userAgent) || SUSPICIOUS_UA_PATTERN.test(userAgent)) {
    logSecurityEvent(req, 'suspicious_user_agent', { userAgent }, 'warn');
  }

  return next();
}

export function createRateLimiter({ windowMs, limit, message, event, skipSuccessfulRequests = false }) {
  const effectiveLimit = process.env.NODE_ENV === 'test' && event !== 'rate_limit_forgot_password'
    ? Math.max(limit, 1000)
    : limit;

  return rateLimit({
    windowMs,
    limit: effectiveLimit,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      logSecurityEvent(req, event || 'rate_limit_exceeded', { limit: effectiveLimit, windowMs }, 'warn');
      return res.status(429).json(typeof message === 'string' ? { message } : message);
    }
  });
}
