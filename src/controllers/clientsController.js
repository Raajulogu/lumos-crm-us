// ------------------------------------------------------------
// Clients Controller (Express)
// ------------------------------------------------------------
const { Client } = require('../models');
const { validationResult } = require('express-validator');
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
}

// PATCH /api/clients/:clientId – admin only
async function patchClient(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  const { companyName, email, phone, address, onboardingNotes } = req.body;
  const client = await Client.findByPk(req.params.clientId);
  if (!client) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } });
  await client.update({ companyName, email, phone, address, onboardingNotes });
  res.json({ success: true, data: client });
}

module.exports = { requireAdmin, patchClient };

