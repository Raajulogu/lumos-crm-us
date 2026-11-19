/**
 * Lightweight Structured Logger for Dotzza Backend
 * Provides structured JSON logging in production and readable formatting in development,
 * with comprehensive redaction of sensitive fields (passwords, tokens, cookies, secrets, DB URIs, etc.).
 */

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /cookie/i,
  /set[-_]?cookie/i,
  /api[-_]?key/i,
  /access[-_]?key/i,
  /access[-_]?token/i,
  /refresh[-_]?token/i,
  /client[-_]?secret/i,
  /credit[-_]?card/i,
  /cvv/i,
  /mongo[-_]?url/i,
  /mongo[-_]?uri/i,
  /database[-_]?url/i,
  /private[-_]?key/i,
  /webhook[-_]?secret/i,
  /razorpay[-_]?key[-_]?secret/i,
  /aws[-_]?secret/i,
];

// Sensitive URI string matcher (e.g., mongodb://user:pass@host)
const URI_CREDENTIALS_REGEX = /:\/\/([^:]+):([^@]+)@/g;

/**
 * Deeply clone and sanitize data to redact sensitive keys and values
 */
export function sanitize(data, depth = 0, seen = new WeakSet()) {
  if (depth > 6) return '[MAX_DEPTH_REACHED]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Redact credentials embedded in DB connection strings
    return data.replace(URI_CREDENTIALS_REGEX, '://$1:[REDACTED]@');
  }

  if (typeof data !== 'object') {
    return data;
  }

  // Prevent circular references
  if (seen.has(data)) {
    return '[CIRCULAR_REF]';
  }
  seen.add(data);

  if (data instanceof Error) {
    return {
      name: data.name,
      message: typeof data.message === 'string' ? sanitize(data.message, depth + 1, seen) : data.message,
      stack: data.stack,
      code: data.code,
      statusCode: data.statusCode,
      ...(data.details ? { details: sanitize(data.details, depth + 1, seen) } : {}),
    };
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitize(item, depth + 1, seen));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value, depth + 1, seen);
    } else if (typeof value === 'string') {
      sanitized[key] = sanitize(value, depth + 1, seen);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Safely format and output log entry
   * @private
   */
  _log(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      ...(meta && Object.keys(meta).length > 0 ? { context: sanitize(meta) } : {}),
      env: process.env.NODE_ENV || 'development',
    };

    const isError = level === 'error';
    const outputStream = isError ? console.error : (level === 'warn' ? console.warn : console.log);

    if (this.isProduction) {
      outputStream(JSON.stringify(entry));
    } else {
      const color = level === 'error' ? '\x1b[31m' : (level === 'warn' ? '\x1b[33m' : (level === 'debug' ? '\x1b[36m' : '\x1b[32m'));
      const reset = '\x1b[0m';
      const metaStr = meta && Object.keys(meta).length > 0 ? `\n${JSON.stringify(sanitize(meta), null, 2)}` : '';
      outputStream(`${color}[${entry.timestamp}] [${entry.level}]${reset} ${message}${metaStr}`);
    }
  }

  info(message, meta) {
    this._log('info', message, meta);
  }

  warn(message, meta) {
    this._log('warn', message, meta);
  }

  error(message, meta) {
    this._log('error', message, meta);
  }

  debug(message, meta) {
    if (process.env.DEBUG || !this.isProduction) {
      this._log('debug', message, meta);
    }
  }

  /**
   * Extract safe request metadata for logging without logging huge/sensitive bodies
   * @param {object} req - Express request object
   */
  extractRequestContext(req) {
    if (!req) return {};
    return {
      requestId: req.id || req.requestId || req.headers?.['x-request-id'] || null,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress,
      userId: req.user?.userId || req.user?.id || null,
      orgId: req.user?.orgId || req.org?._id || null,
      userAgent: req.headers?.['user-agent'] || null,
    };
  }
}

export const logger = new Logger();