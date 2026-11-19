/**
 * Async handler wrapper for Express 4 routes and middlewares.
 * Catches rejected promises and forwards them to Express next(err).
 *
 * @param {Function} fn - Async Express route handler or middleware
 * @returns {Function} Express middleware function
 *
 * @example
 * router.get('/users/:id', asyncHandler(async (req, res) => {
 *   const user = await User.findById(req.params.id);
 *   if (!user) throw AppError.notFound('User not found');
 *   res.json({ success: true, data: user });
 * }));
 */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
