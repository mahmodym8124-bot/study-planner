function readRewritePath(req) {
  const rawPath = req.query?.path;
  if (Array.isArray(rawPath)) return rawPath.filter(Boolean).join('/');
  return String(rawPath || '').replace(/^\/+/, '');
}

export function normalizeVercelRequest(req) {
  const rewritePath = readRewritePath(req);
  if (!rewritePath) return req.url;

  const [, rawQuery = ''] = String(req.url || '/').split('?');
  const params = new URLSearchParams(rawQuery);
  params.delete('path');

  const normalizedPath = `/api/${rewritePath}`.replace(/\/{2,}/g, '/');
  const query = params.toString();
  req.url = query ? `${normalizedPath}?${query}` : normalizedPath;
  return req.url;
}
