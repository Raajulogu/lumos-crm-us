import crypto from 'crypto';

// Strict regex for safe, sanitized client-provided request IDs (alphanumeric, hyphens, underscores; max 64 chars)
const SAFE_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Request ID Middleware
 * Validates incoming correlation IDs or generates a fresh cryptographically secure UUID.
 * Sets `req.id`, `req.requestId`, and the `X-Request-Id` response header.
 */
export function requestId(req, res, next) {
  const rawId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
  let id;

  if (typeof rawId === 'string' && SAFE_REQUEST_ID_REGEX.test(rawId.trim())) {
    id = rawId.trim();
  } else {
    id = `req_${crypto.randomUUID()}`;
  }

  req.id = id;
  req.requestId = id;

  res.setHeader('X-Request-Id', id);

  next();
}
