// ------------------------------------------------------------
// Tasks Controller (Express) – Mongoose version
// ------------------------------------------------------------
const { Task, User, TaskComment } = require('../models');
const { validationResult } = require('express-validator');
const { sendSuccess } = require('../utils/response');

// Middleware to enforce admin role for privileged routes
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } });
}

/**
 * GET /api/tasks?projectId=&q=
 * List tasks filtered by project and optional full‑text search.
 */
async function listTasks(req, res) {
  const { projectId, q } = req.query;
  if (!projectId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'projectId query param required' } });
  }
  const filter = { projectId };
  if (q) {
    // simple case‑insensitive regex search on title and description
    filter.$or = [{ title: new RegExp(q, 'i') }, { description: new RegExp(q, 'i') }];
  }
  const tasks = await Task.find(filter).populate('assigneeIds', 'fullName email designation');
  return sendSuccess(res, { message: 'Tasks retrieved', data: tasks });
}

/**
 * GET /api/tasks/:taskId – admin only
 */
async function getTask(req, res) {
  const task = await Task.findById(req.params.taskId).populate('assigneeIds', 'fullName email designation');
  if (!task) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
  }
  return sendSuccess(res, { message: 'Task fetched', data: task });
}

/**
 * POST /api/tasks – admin only
 * Body: { title, description?, assigneeIds?, projectId }
 * startDate is set automatically.
 */
async function createTask(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: errors.array() } });
  }
  const { title, description, assigneeIds, projectId } = req.body;
  if (!title || !projectId) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'title and projectId are required' } });
  }
  const task = await Task.create({ title, description, projectId, startDate: new Date(), assigneeIds });
  const populated = await Task.findById(task._id).populate('assigneeIds', 'fullName email designation');
  return sendSuccess(res, { statusCode: 201, message: 'Task created', data: populated });
}

/**
 * PUT /api/tasks/:taskId – admin only
 * Allows updating title, description, assigneeIds, startDate, status.
 */
async function updateTask(req, res) {
  const { title, description, assigneeIds, startDate, status } = req.body;
  const task = await Task.findById(req.params.taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
  }
  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (startDate !== undefined) updates.startDate = startDate;
  if (status !== undefined) updates.status = status;
  if (assigneeIds !== undefined) updates.assigneeIds = assigneeIds;
  await task.updateOne(updates);
  const refreshed = await Task.findById(task._id).populate('assigneeIds', 'fullName email designation');
  return sendSuccess(res, { message: 'Task updated', data: refreshed });
}

/**
 * POST /api/tasks/:taskId/auto-update – employee only
 * Adds a system comment and optionally resets status to in‑progress.
 */
async function employeeAutoUpdate(req, res) {
  const { updateText } = req.body;
  if (!updateText) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'updateText is required' } });
  }
  const task = await Task.findById(req.params.taskId);
  if (!task) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Task not found' } });
  }
  await TaskComment.create({ taskId: task._id, userId: req.user._id, comment: updateText });
  // reset status to in_progress if needed
  if (task.status !== 'in_progress') {
    await task.updateOne({ status: 'in_progress' });
  }
  return sendSuccess(res, { message: 'Comment added', data: { taskId: task._id } });
}

module.exports = {
  requireAdmin,
  listTasks,
  getTask,
  createTask,
  updateTask,
  employeeAutoUpdate,
};
