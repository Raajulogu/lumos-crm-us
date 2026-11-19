/**
 * Standard API Success Response Envelope Builder
 * Conforms to Lumos CRM API Specification Section 3.1
 *
 * @param {import('express').Response} res
 * @param {object} options
 * @param {number} [options.statusCode=200]
 * @param {string} options.message
 * @param {any} [options.data=null]
 * @param {object} [options.meta] - Optional pagination metadata
 */
export function sendSuccess(res, { statusCode = 200, message = 'Operation completed successfully', data = null, meta }) {
  const payload = {
    success: true,
    message,
    data,
  };

  if (meta && typeof meta === 'object') {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}
