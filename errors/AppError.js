import { ErrorCodes } from './errorCodes.js';

/**
 * Standard Application Error class for Dotzza backend.
 * Represents operational, known errors in the application.
 */
export class AppError extends Error {
  /**
   * @param {string|object} messageOrOptions - Error message string or options object
   * @param {number} [statusCode=500] - HTTP status code
   * @param {string} [code] - Machine-readable error code (from ErrorCodes)
   * @param {any} [details=null] - Optional contextual details (e.g. field-level validation errors)
   */
  constructor(messageOrOptions, statusCode, code, details) {
    let message = 'An error occurred';
    let status = 500;
    let errCode = null;
    let errDetails = null;
    let isOperational = true;
    let cause = undefined;

    if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
      message = messageOrOptions.message || message;
      status = messageOrOptions.statusCode || messageOrOptions.status || status;
      errCode = messageOrOptions.code || null;
      errDetails = messageOrOptions.details !== undefined ? messageOrOptions.details : null;
      isOperational = messageOrOptions.isOperational !== undefined ? messageOrOptions.isOperational : true;
      cause = messageOrOptions.cause;
    } else if (typeof messageOrOptions === 'string') {
      message = messageOrOptions;
      if (typeof statusCode === 'number') status = statusCode;
      if (typeof code === 'string') errCode = code;
      if (details !== undefined) errDetails = details;
    }

    super(message);

    this.name = 'AppError';
    this.statusCode = status;
    this.code = errCode || this._inferErrorCode(status);
    this.details = errDetails;
    this.isOperational = isOperational;
    if (cause) this.cause = cause;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Infer default machine-readable code from HTTP status code
   * @private
   */
  _inferErrorCode(status) {
    switch (status) {
      case 400: return ErrorCodes.BAD_REQUEST;
      case 401: return ErrorCodes.UNAUTHORIZED;
      case 403: return ErrorCodes.FORBIDDEN;
      case 404: return ErrorCodes.NOT_FOUND;
      case 409: return ErrorCodes.CONFLICT;
      case 422: return ErrorCodes.VALIDATION_ERROR;
      case 429: return ErrorCodes.TOO_MANY_REQUESTS;
      case 503: return ErrorCodes.SERVICE_UNAVAILABLE;
      default: return ErrorCodes.INTERNAL_SERVER_ERROR;
    }
  }

  /**
   * Factory helper for 400 Bad Request
   */
  static badRequest(message = 'Bad request', details = null, code = ErrorCodes.BAD_REQUEST) {
    return new AppError({ message, statusCode: 400, code, details });
  }

  /**
   * Factory helper for 401 Unauthorized
   */
  static unauthorized(message = 'Authentication required', details = null, code = ErrorCodes.UNAUTHORIZED) {
    return new AppError({ message, statusCode: 401, code, details });
  }

  /**
   * Factory helper for 403 Forbidden
   */
  static forbidden(message = 'Access denied', details = null, code = ErrorCodes.FORBIDDEN) {
    return new AppError({ message, statusCode: 403, code, details });
  }

  /**
   * Factory helper for 404 Not Found
   */
  static notFound(message = 'Resource not found', details = null, code = ErrorCodes.NOT_FOUND) {
    return new AppError({ message, statusCode: 404, code, details });
  }

  /**
   * Factory helper for 409 Conflict
   */
  static conflict(message = 'Resource conflict', details = null, code = ErrorCodes.CONFLICT) {
    return new AppError({ message, statusCode: 409, code, details });
  }

  /**
   * Factory helper for 422 Unprocessable Entity (Validation Error)
   */
  static validation(message = 'Validation failed', details = null, code = ErrorCodes.VALIDATION_ERROR) {
    return new AppError({ message, statusCode: 422, code, details });
  }

  /**
   * Factory helper for 500 Internal Server Error
   */
  static internal(message = 'Internal server error', details = null, code = ErrorCodes.INTERNAL_SERVER_ERROR) {
    return new AppError({ message, statusCode: 500, code, details, isOperational: false });
  }
}
