import express from 'express';
import { Doubt, Project, Notification, ActivityLog, User } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/projects/:projectId/doubts
 * Retrieve doubts for a specific project
 */
router.get('/projects/:projectId/doubts', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    const isAdmin = req.user.role === 'admin';
    const isAssigned =
      project.primaryEmployeeId?.toString() === req.user._id.toString() ||
      project.additionalMemberIds?.some((m) => m.toString() === req.user._id.toString());

    if (!isAdmin && !isAssigned) {
      throw AppError.forbidden('Access denied. You are not assigned to this project.');
    }

    const filter = { projectId: project._id };
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    const doubts = await Doubt.find(filter)
      .populate('raisedBy', 'fullName designation')
      .sort({ createdAt: -1 });

    const formattedDoubts = doubts.map((d) => ({
      id: d._id.toString(),
      projectId: d.projectId.toString(),
      raisedById: d.raisedBy?._id?.toString() || null,
      raisedByName: d.raisedBy?.fullName || 'Unknown',
      subject: d.subject,
      description: d.description,
      priority: d.priority,
      status: d.status,
      adminReply: d.adminReply,
      adminRepliedAt: d.adminRepliedAt,
      createdAt: d.createdAt,
      resolvedAt: d.resolvedAt,
    }));

    return sendSuccess(res, {
      message: 'Doubts retrieved',
      data: formattedDoubts,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/doubts
 * Raise a new doubt on a project
 */
router.post('/projects/:projectId/doubts', async (req, res, next) => {
  try {
    const { subject, description, priority } = req.body;
    if (!subject || !description) {
      throw AppError.badRequest('Subject and description are required');
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    const isAdmin = req.user.role === 'admin';
    const isAssigned =
      project.primaryEmployeeId?.toString() === req.user._id.toString() ||
      project.additionalMemberIds?.some((m) => m.toString() === req.user._id.toString());

    if (!isAdmin && !isAssigned) {
      throw AppError.forbidden('Access denied. You are not assigned to this project.');
    }

    const doubt = await Doubt.create({
      projectId: project._id,
      raisedBy: req.user._id,
      subject,
      description,
      priority: priority || 'normal',
      status: 'open',
    });

    // Notify admins if raised by employee
    if (!isAdmin) {
      const admins = await User.find({ role: 'admin' });
      for (const admin of admins) {
        await Notification.create({
          recipientId: admin._id,
          type: 'doubt_raised',
          title: `New Doubt on ${project.name}`,
          message: `${req.user.fullName} raised a doubt: "${subject}"`,
          relatedProjectId: project._id,
        });
      }
    }

    await ActivityLog.record({
      type: 'doubt_raised',
      description: `${req.user.fullName} raised a doubt on '${project.name}': ${subject}`,
      performedBy: req.user._id,
      projectId: project._id,
      clientId: project.clientId,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Doubt submitted to agency admin',
      data: {
        id: doubt._id.toString(),
        projectId: doubt.projectId.toString(),
        raisedById: req.user._id.toString(),
        subject: doubt.subject,
        description: doubt.description,
        priority: doubt.priority,
        status: doubt.status,
        createdAt: doubt.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/doubts/:id/reply
 * Admin replies to an employee's doubt
 */
router.post('/doubts/:id/reply', requireAdmin, async (req, res, next) => {
  try {
    const { reply } = req.body;
    if (!reply) {
      throw AppError.badRequest('Reply text is required');
    }

    const doubt = await Doubt.findById(req.params.id).populate('projectId');
    if (!doubt) {
      throw AppError.notFound('Doubt not found');
    }

    doubt.adminReply = reply;
    doubt.adminRepliedAt = new Date();
    doubt.adminRepliedBy = req.user._id;
    await doubt.save();

    // Send in-app notification to the employee who raised the doubt
    await Notification.create({
      recipientId: doubt.raisedBy,
      type: 'doubt_replied',
      title: 'Admin replied to your doubt',
      message: `Admin replied on project '${doubt.projectId?.name || 'Project'}': "${reply.slice(0, 80)}..."`,
      relatedProjectId: doubt.projectId?._id,
    });

    return sendSuccess(res, {
      message: 'Reply sent successfully',
      data: {
        id: doubt._id.toString(),
        adminReply: doubt.adminReply,
        adminRepliedAt: doubt.adminRepliedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/doubts/:id/resolve
 * Mark a doubt as resolved (Admin or Creator)
 */
router.patch('/doubts/:id/resolve', async (req, res, next) => {
  try {
    const doubt = await Doubt.findById(req.params.id);
    if (!doubt) {
      throw AppError.notFound('Doubt not found');
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = doubt.raisedBy.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      throw AppError.forbidden('Only an admin or the employee who raised the doubt can resolve it.');
    }

    doubt.status = 'resolved';
    doubt.resolvedAt = new Date();
    doubt.resolvedBy = req.user._id;
    await doubt.save();

    await ActivityLog.record({
      type: 'doubt_resolved',
      description: `${req.user.fullName} marked doubt '${doubt.subject}' as resolved`,
      performedBy: req.user._id,
      projectId: doubt.projectId,
    });

    return sendSuccess(res, {
      message: 'Doubt marked as resolved',
      data: {
        id: doubt._id.toString(),
        status: 'resolved',
        resolvedAt: doubt.resolvedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
