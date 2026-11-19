/**
 * Standard Application Error Codes
 * Canonical, stable machine-readable strings for API error categorization
 */
export const ErrorCodes = Object.freeze({
  // Client / Request Errors (400)
  BAD_REQUEST: 'BAD_REQUEST',

  // Authentication Errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Authorization & Access Errors (403)
  FORBIDDEN: 'FORBIDDEN',
  PLAN_LIMIT_EXCEEDED: 'PLAN_LIMIT_EXCEEDED',
  ORGANIZATION_INACTIVE: 'ORGANIZATION_INACTIVE',

  // Not Found Errors (404)
  NOT_FOUND: 'NOT_FOUND',

  // Conflict Errors (409)
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',

  // Validation Errors (422)
  VALIDATION_ERROR: 'VALIDATION_ERROR',

  // Rate Limiting (429)
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',

  // Server / Infrastructure Errors (500, 503)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
});

/**
 * Default HTTP status mapping for standard error codes
 */
export const DefaultHttpStatus = Object.freeze({
  [ErrorCodes.BAD_REQUEST]: 400,

  [ErrorCodes.UNAUTHORIZED]: 401,
  [ErrorCodes.TOKEN_EXPIRED]: 401,
  [ErrorCodes.INVALID_TOKEN]: 401,

  [ErrorCodes.FORBIDDEN]: 403,
  [ErrorCodes.PLAN_LIMIT_EXCEEDED]: 403,
  [ErrorCodes.ORGANIZATION_INACTIVE]: 403,

  [ErrorCodes.NOT_FOUND]: 404,

  [ErrorCodes.CONFLICT]: 409,
  [ErrorCodes.DUPLICATE_RESOURCE]: 409,

  [ErrorCodes.VALIDATION_ERROR]: 422,

  [ErrorCodes.TOO_MANY_REQUESTS]: 429,

  [ErrorCodes.INTERNAL_SERVER_ERROR]: 500,
  [ErrorCodes.SERVICE_UNAVAILABLE]: 503,
});
