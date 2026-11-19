import { AppError } from './AppError.js';
import { ErrorCodes } from './errorCodes.js';

/**
 * Maps arbitrary errors (Mongoose, Mongo, JWT, Syntax, Multer, unexpected Errors)
 * into standardized AppError instances with defensive data sanitization.
 *
 * @param {Error|AppError|any} err - The error to map
 * @returns {AppError} Standardized AppError instance
 */
export function mapToAppError(err) {
  // 1. Already an AppError instance
  if (err instanceof AppError) {
    return err;
  }

  // 2. Handle null, undefined, or non-object errors
  if (!err || typeof err !== 'object') {
    return new AppError({
      message: typeof err === 'string' ? err : 'Internal server error',
      statusCode: 500,
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      isOperational: false,
    });
  }

  // 3. Mongoose Validation Error
  // Extract ONLY field names and user-safe validation messages. Never leak raw values.
  if (err.name === 'ValidationError' && err.errors && typeof err.errors === 'object') {
    const details = Object.entries(err.errors).map(([field, errorObj]) => ({
      field,
      message: errorObj?.message || 'Invalid value',
    }));

    return new AppError({
      message: 'Validation failed',
      statusCode: 422,
      code: ErrorCodes.VALIDATION_ERROR,
      details,
      isOperational: true,
      cause: err,
    });
  }

  // 4. Mongoose CastError (e.g. invalid ObjectId format)
  if (err.name === 'CastError') {
    const field = err.path || 'identifier';
    return new AppError({
      message: `Invalid format for '${field}'`,
      statusCode: 400,
      code: ErrorCodes.BAD_REQUEST,
      details: { field },
      isOperational: true,
      cause: err,
    });
  }

  // 5. MongoDB Duplicate Key Error (code 11000)
  if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
    const keyPattern = err.keyPattern || err.keyValue || {};
    const duplicateFields = Object.keys(keyPattern);
    const fieldName = duplicateFields.length > 0 ? duplicateFields.join(', ') : 'field';

    return new AppError({
      message: `Duplicate entry: '${fieldName}' already exists`,
      statusCode: 409,
      code: ErrorCodes.DUPLICATE_RESOURCE,
      details: { field: fieldName },
      isOperational: true,
      cause: err,
    });
  }

  // 6. JWT Errors
  if (err.name === 'TokenExpiredError') {
    return new AppError({
      message: 'Authentication token has expired',
      statusCode: 401,
      code: ErrorCodes.TOKEN_EXPIRED,
      isOperational: true,
      cause: err,
    });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'NotBeforeError') {
    return new AppError({
      message: 'Invalid authentication token',
      statusCode: 401,
      code: ErrorCodes.INVALID_TOKEN,
      isOperational: true,
      cause: err,
    });
  }

  // 7. Express body-parser Malformed JSON SyntaxError
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return new AppError({
      message: 'Malformed JSON in request payload',
      statusCode: 400,
      code: ErrorCodes.BAD_REQUEST,
      isOperational: true,
      cause: err,
    });
  }

  // 8. Multer File Upload Errors
  if (err.name === 'MulterError') {
    return new AppError({
      message: err.message || 'File upload error',
      statusCode: 400,
      code: ErrorCodes.BAD_REQUEST,
      details: err.field ? { field: err.field } : null,
      isOperational: true,
      cause: err,
    });
  }

  // 9. Generic / Unexpected Server Error
  return new AppError({
    message: err.isPublicMessage && err.message ? err.message : 'Internal server error',
    statusCode: typeof err.statusCode === 'number' ? err.statusCode : (typeof err.status === 'number' ? err.status : 500),
    code: err.code && typeof err.code === 'string' && err.code.toUpperCase() === err.code ? err.code : ErrorCodes.INTERNAL_SERVER_ERROR,
    details: null,
    isOperational: Boolean(err.isOperational),
    cause: err,
  });
}
