import express from 'express';
import { Project, Client, ActivityLog } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/projects
 * List projects with filtering, search, pagination, and role-based data masking
 */
router.get('/', async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter = {};

    // Employee isolation rule: can ONLY view assigned projects
    if (!isAdmin) {
      filter.$or = [
        { primaryEmployeeId: req.user._id },
        { additionalMemberIds: req.user._id },
      ];
    } else if (req.query.employeeId) {
      filter.$or = [
        { primaryEmployeeId: req.query.employeeId },
        { additionalMemberIds: req.query.employeeId },
      ];
    }

    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    if (req.query.priority && req.query.priority !== 'all') {
      filter.priority = req.query.priority;
    }

    if (req.query.categoryId) {
      filter.serviceCategories = req.query.categoryId;
    }

    if (req.query.filter === 'overdue') {
      filter.deliveryDate = { $lt: new Date() };
      filter.status = { $nin: ['delivered', 'completed'] };
    } else if (req.query.filter === 'upcoming') {
      const now = new Date();
      const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      filter.deliveryDate = { $gte: now, $lte: next7Days };
      filter.status = { $nin: ['delivered', 'completed'] };
    }

    if (req.query.search) {
      filter.name = new RegExp(req.query.search.trim(), 'i');
    }

    const [projects, total] = await Promise.all([
      Project.find(filter)
        .populate('clientId', 'fullName companyName email phone address')
        .populate('serviceCategories', 'name color isDefault')
        .populate('primaryEmployeeId', 'fullName designation email phone')
        .populate('additionalMemberIds', 'fullName designation')
        .sort({ deliveryDate: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Project.countDocuments(filter),
    ]);

    // Format output according to role (Admin vs Employee safe serialization)
    const formattedProjects = projects.map((project) => {
      if (isAdmin) {
        const obj = project.toJSON();
        obj.client = project.clientId;
        obj.primaryEmployee = project.primaryEmployeeId;
        obj.additionalMembers = project.additionalMemberIds;
        return obj;
      }
      return project.toEmployeeSafe();
    });

    return sendSuccess(res, {
      message: isAdmin ? 'Projects fetched successfully' : 'Assigned projects fetched successfully',
      data: formattedProjects,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/:id
 * Get single project detail with strict role enforcement
 */
router.get('/:id', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('clientId')
      .populate('serviceCategories', 'name color')
      .populate('primaryEmployeeId', 'fullName designation email')
      .populate('additionalMemberIds', 'fullName designation email');

    if (!project) {
      throw AppError.notFound('Project not found');
    }

    const isAdmin = req.user.role === 'admin';
    const isAssigned =
      project.primaryEmployeeId?._id?.toString() === req.user._id.toString() ||
      project.additionalMemberIds?.some((m) => m._id?.toString() === req.user._id.toString());

    if (!isAdmin && !isAssigned) {
      throw AppError.forbidden('Access denied. You are not assigned to this project.');
    }

    if (!isAdmin) {
      return sendSuccess(res, {
        message: 'Project detail retrieved',
        data: project.toEmployeeSafe(),
      });
    }

    const obj = project.toJSON();
    obj.client = project.clientId;
    const budget = project.budget || 0;
    const actualCost = project.actualCost || 0;
    obj.profit = budget - actualCost;
    obj.profitMargin = budget > 0 ? Math.round(((budget - actualCost) / budget) * 100) : 0;

    return sendSuccess(res, {
      message: 'Project detail retrieved',
      data: obj,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/projects
 * Create a new project (Admin only)
 */
router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const {
      name,
      clientId,
      serviceCategories,
      description,
      budget,
      actualCost,
      startDate,
      deliveryDate,
      priority,
      primaryEmployeeId,
      additionalMemberIds,
      reminderOverrides,
    } = req.body;

    if (!name || !clientId || !description || budget === undefined || !startDate || !deliveryDate) {
      throw AppError.badRequest('Missing required project fields (name, clientId, description, budget, startDate, deliveryDate)');
    }

    const client = await Client.findById(clientId);
    if (!client) {
      throw AppError.badRequest('Referenced client does not exist');
    }

    const project = await Project.create({
      name,
      clientId,
      serviceCategories: serviceCategories || [],
      description,
      budget,
      actualCost: actualCost || 0,
      startDate,
      deliveryDate,
      priority: priority || 'medium',
      primaryEmployeeId: primaryEmployeeId || null,
      additionalMemberIds: additionalMemberIds || [],
      reminderOverrides: reminderOverrides || [],
    });

    await ActivityLog.record({
      type: 'project_created',
      description: `Project '${project.name}' created for ${client.companyName}`,
      performedBy: req.user._id,
      projectId: project._id,
      clientId: client._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Project created successfully',
      data: project.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/projects/:id
 * Update project details (Admin only)
 */
router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!project) {
      throw AppError.notFound('Project not found');
    }

    return sendSuccess(res, {
      message: 'Project updated successfully',
      data: project.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/projects/:id/status
 * Update pipeline status (Admin or Assigned Employee)
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['new', 'in_progress', 'under_review', 'completed', 'delivered'];
    if (!validStatuses.includes(status)) {
      throw AppError.badRequest(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const project = await Project.findById(req.params.id);
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

    project.status = status;
    if (status === 'delivered') {
      project.deliveredAt = new Date();
    }
    await project.save();

    await ActivityLog.record({
      type: 'status_changed',
      description: `${req.user.fullName} updated project '${project.name}' to ${status.replace('_', ' ').toUpperCase()}`,
      performedBy: req.user._id,
      projectId: project._id,
      clientId: project.clientId,
      metadata: { newStatus: status },
    });

    return sendSuccess(res, {
      message: `Project status updated to '${status}'`,
      data: {
        id: project._id.toString(),
        status: project.status,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/projects/:id/financials
 * Update project financials (Admin only)
 */
router.patch('/:id/financials', requireAdmin, async (req, res, next) => {
  try {
    const { budget, actualCost } = req.body;
    const update = {};
    if (budget !== undefined) update.budget = budget;
    if (actualCost !== undefined) update.actualCost = actualCost;

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!project) {
      throw AppError.notFound('Project not found');
    }

    return sendSuccess(res, {
      message: 'Project financials updated',
      data: {
        id: project._id.toString(),
        budget: project.budget,
        actualCost: project.actualCost,
        profit: project.profit,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/projects/:id/reminders
 * Update project reminder overrides (Admin only)
 */
router.patch('/:id/reminders', requireAdmin, async (req, res, next) => {
  try {
    const { reminderOverrides } = req.body;

    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { reminderOverrides: reminderOverrides || [] },
      { new: true }
    );

    if (!project) {
      throw AppError.notFound('Project not found');
    }

    return sendSuccess(res, {
      message: 'Project reminder settings updated',
      data: {
        id: project._id.toString(),
        reminderOverrides: project.reminderOverrides,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
