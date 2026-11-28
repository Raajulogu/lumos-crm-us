// ------------------------------------------------------------
// Service Categories Controller (Express)
// ------------------------------------------------------------
const { ServiceCategory } = require('../models');
const { validationResult } = require('express-validator');

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
}

// POST /api/service-categories – admin only
async function createServiceCategory(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  const { name, description } = req.body;
  const category = await ServiceCategory.create({ name, description });
  res.status(201).json({ success: true, data: category });
}

// GET /api/service-categories – public (or admin)
async function listServiceCategories(req, res) {
  const categories = await ServiceCategory.findAll();
  res.json({ success: true, data: categories });
}

module.exports = { requireAdmin, createServiceCategory, listServiceCategories };

