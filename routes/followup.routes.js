import express from 'express';
import { FollowUp, Project, Client, ActivityLog } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/followups
 * List follow-ups with role filtering (Admin sees all, employee sees own)
 */
router.get('/', async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const filter = {};

    if (!isAdmin) {
      filter.assignedTo = req.user._id;
    } else if (req.query.assignedTo) {
      filter.assignedTo = req.query.assignedTo;
    }

    if (req.query.status && ['pending', 'done', 'missed'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.scheduledAt = {};
      if (req.query.dateFrom) filter.scheduledAt.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) filter.scheduledAt.$lte = new Date(req.query.dateTo);
    }

    const followUps = await FollowUp.find(filter)
      .populate('projectId', 'name')
      .populate('clientId', 'fullName companyName')
      .populate('assignedTo', 'fullName designation')
      .sort({ scheduledAt: 1 });

    const formatted = followUps.map((fu) => ({
      id: fu._id.toString(),
      projectId: fu.projectId?._id?.toString() || null,
      projectName: fu.projectId?.name || 'Project',
      clientId: fu.clientId?._id?.toString() || null,
      clientName: fu.clientId?.fullName || 'Client',
      clientCompany: fu.clientId?.companyName || '',
      scheduledAt: fu.scheduledAt,
      assignedToId: fu.assignedTo?._id?.toString() || null,
      assignedToName: fu.assignedTo?.fullName || 'Unassigned',
      notes: fu.notes,
      status: fu.status,
      createdAt: fu.createdAt,
    }));

    return sendSuccess(res, {
      message: 'Follow-ups fetched',
      data: formatted,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/followups
 * Create a new scheduled follow-up
 */
router.post('/', async (req, res, next) => {
  try {
    const { projectId, clientId, scheduledAt, assignedToId, notes } = req.body;

    if (!projectId || !clientId || !scheduledAt) {
      throw AppError.badRequest('Missing required fields (projectId, clientId, scheduledAt)');
    }

    const [project, client] = await Promise.all([
      Project.findById(projectId),
      Client.findById(clientId),
    ]);

    if (!project) throw AppError.notFound('Project not found');
    if (!client) throw AppError.notFound('Client not found');

    const assignedTo = assignedToId || req.user._id;

    const followUp = await FollowUp.create({
      projectId,
      clientId,
      scheduledAt,
      assignedTo,
      notes: notes || '',
      status: 'pending',
    });

    await ActivityLog.record({
      type: 'followup_created',
      description: `${req.user.fullName} scheduled follow-up for ${client.fullName} (${project.name})`,
      performedBy: req.user._id,
      projectId: project._id,
      clientId: client._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Follow-up created successfully',
      data: followUp.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/followups/:id/status
 * Toggle follow-up status (pending, done, missed)
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['pending', 'done', 'missed'].includes(status)) {
      throw AppError.badRequest("Status must be 'pending', 'done', or 'missed'");
    }

    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) {
      throw AppError.notFound('Follow-up not found');
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = followUp.assignedTo.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      throw AppError.forbidden('You can only update follow-ups assigned to you');
    }

    followUp.status = status;
    if (status === 'done') {
      followUp.completedAt = new Date();
    }
    await followUp.save();

    if (status === 'done') {
      await ActivityLog.record({
        type: 'followup_done',
        description: `${req.user.fullName} completed follow-up for client`,
        performedBy: req.user._id,
        projectId: followUp.projectId,
        clientId: followUp.clientId,
      });
    }

    return sendSuccess(res, {
      message: `Follow-up status updated to '${status}'`,
      data: followUp.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/followups/:id
 * Delete follow-up (Admin only)
 */
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const followUp = await FollowUp.findByIdAndDelete(req.params.id);
    if (!followUp) {
      throw AppError.notFound('Follow-up not found');
    }

    return sendSuccess(res, {
      message: 'Follow-up deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
