// ------------------------------------------------------------
// Follow‑up Evaluation Controller (Express)
// ------------------------------------------------------------
const { FollowupEvaluation, Followup, User } = require('../models');
const { validationResult } = require('express-validator');

// Helper middleware – admin vs employee
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
}

// POST /api/followups/:followupId/evaluation – employee (owner) only
async function createEvaluation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  const { rating, comments } = req.body;
  const followupId = req.params.followupId;
  const followup = await Followup.findByPk(followupId);
  if (!followup) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Follow‑up not found' } });
  // Ensure employee owns the follow‑up (or is admin)
  if (req.user.role !== 'admin' && followup.userId !== req.user.id) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Cannot evaluate others' } });
  }
  const evalRec = await FollowupEvaluation.create({ followup_id: followupId, user_id: req.user.id, rating, comments });
  res.status(201).json({ success: true, data: evalRec });
}

// GET /api/followups/evaluations?projectId= – admin only
async function listEvaluations(req, res) {
  const { projectId } = req.query;
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
  }
  const where = {};
  if (projectId) {
    // Join through Followup to filter by project
    where['$followup.projectId$'] = projectId;
  }
  const evaluations = await FollowupEvaluation.findAll({
    where,
    include: [{ model: Followup, as: 'followup' }]
  });
  res.json({ success: true, data: evaluations });
}

module.exports = { createEvaluation, listEvaluations, requireAdmin };

