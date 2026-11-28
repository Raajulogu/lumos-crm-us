// ------------------------------------------------------------
// Auth & Role Middleware (Express)
// ------------------------------------------------------------
function ensureAuthenticated(req, res, next) {
  if (req.user) return next();
  return res.status(401).json({ success: false, error: { code: 'UNAUTHENTICATED', message: 'User not logged in' } });
}

function requireRole(role) {
  return function (req, res, next) {
    if (req.user && req.user.role === role) return next();
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `${role} role required` } });
  };
}

module.exports = { ensureAuthenticated, requireRole };

