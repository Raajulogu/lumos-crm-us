// ------------------------------------------------------------
// Projects Controller (Express)
// ------------------------------------------------------------
const { Project } = require('../models');
const { validationResult } = require('express-validator');
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
}

// PATCH /api/projects/:projectId – admin only, updates budget, cost, deadline, status
async function patchProject(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  }
  const { agreedBudget, incurredCost, deadline, deadlineStatus } = req.body;
  const project = await Project.findByPk(req.params.projectId);
  if (!project) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
  }
  await project.update({ agreedBudget, incurredCost, deadline, deadlineStatus });
  res.json({ success: true, data: project });
}

module.exports = { requireAdmin, patchProject };

