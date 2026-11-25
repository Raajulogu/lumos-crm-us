import { mapToAppError } from '../errors/errorMapper.js';
import { logger, sanitize } from '../utils/logger.js';

/**
 * Central Express Error Handling Middleware.
 * Catches all forwarded errors, normalizes them into AppError,
 * logs technical details with request context, and returns a sanitized JSON response.
 */
export function errorHandler(err, req, res, next) {
  // If response headers have already been sent, delegate to default Express handler
  if (res.headersSent) {
    return next(err);
  }

  // Normalize any error to standard AppError
  const appError = mapToAppError(err);
  const requestId = req.id || req.requestId || res.getHeader('X-Request-Id') || 'unknown';

  // Structured technical logging (captures full technical details and stacks safely on server)
  const requestContext = logger.extractRequestContext(req);
  logger.error(`[${appError.code}] ${appError.message}`, {
    ...requestContext,
    statusCode: appError.statusCode,
    errorCode: appError.code,
    isOperational: appError.isOperational,
    details: appError.details,
    stack: err?.stack || appError.stack,
  });

  // Build standard API error response matching specification
  let details = null;
  if (appError.details !== null && appError.details !== undefined) {
    const sanitizedDetails = sanitize(appError.details);
    if (typeof sanitizedDetails === 'object' && !(appError.details instanceof Error)) {
      details = sanitizedDetails;
    }
  }

  const response = {
    success: false,
    message: appError.message,
    error: {
      code: appError.code,
      message: appError.message,
      details,
      timestamp: new Date().toISOString(),
      path: req.originalUrl || req.url,
    },
    requestId,
  };

  return res.status(appError.statusCode).json(response);
}
