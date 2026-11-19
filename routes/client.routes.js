import express from 'express';
import { Client, Project, FollowUp, ActivityLog } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

// All client routes require Admin role
router.use(authenticate, requireAdmin);

/**
 * GET /api/v1/clients
 * Admin-only list of all clients with pagination, search, and metrics
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && ['active', 'inactive'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { companyName: searchRegex },
        { email: searchRegex },
      ];
    }

    const [clients, total] = await Promise.all([
      Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Client.countDocuments(filter),
    ]);

    // Attach project stats per client
    const clientIds = clients.map((c) => c._id);
    const projectAggregates = await Project.aggregate([
      { $match: { clientId: { $in: clientIds } } },
      {
        $group: {
          _id: '$clientId',
          totalProjects: { $sum: 1 },
          lastProjectDate: { $max: '$createdAt' },
        },
      },
    ]);

    const statsMap = new Map();
    projectAggregates.forEach((stat) => {
      statsMap.set(stat._id.toString(), stat);
    });

    const enrichedClients = clients.map((client) => {
      const clientObj = client.toJSON();
      const stats = statsMap.get(client._id.toString()) || {};
      clientObj.totalProjects = stats.totalProjects || 0;
      clientObj.lastProjectDate = stats.lastProjectDate || null;
      return clientObj;
    });

    return sendSuccess(res, {
      message: 'Clients retrieved successfully',
      data: enrichedClients,
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
 * GET /api/v1/clients/:id
 * 360-degree client profile with projects and follow-ups summary
 */
router.get('/:id', async (req, res, next) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) {
      throw AppError.notFound('Client not found');
    }

    const [projects, followUps] = await Promise.all([
      Project.find({ clientId: client._id }).sort({ createdAt: -1 }),
      FollowUp.find({ clientId: client._id }).sort({ scheduledAt: -1 }),
    ]);

    let totalBilled = 0;
    let totalCost = 0;
    let deliveredProjects = 0;
    let inProgressProjects = 0;

    projects.forEach((p) => {
      totalBilled += p.budget || 0;
      totalCost += p.actualCost || 0;
      if (p.status === 'delivered') deliveredProjects++;
      if (p.status === 'in_progress') inProgressProjects++;
    });

    return sendSuccess(res, {
      message: 'Client detail retrieved',
      data: {
        client: client.toJSON(),
        summary: {
          totalProjects: projects.length,
          deliveredProjects,
          inProgressProjects,
          totalBilled,
          totalCost,
          netProfit: totalBilled - totalCost,
        },
        projects: projects.map((p) => ({
          id: p._id.toString(),
          name: p.name,
          status: p.status,
          priority: p.priority,
          budget: p.budget,
          actualCost: p.actualCost,
          deliveryDate: p.deliveryDate,
        })),
        followUps: followUps.map((f) => ({
          id: f._id.toString(),
          scheduledAt: f.scheduledAt,
          status: f.status,
          notes: f.notes,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/clients
 * Register a new client
 */
router.post('/', async (req, res, next) => {
  try {
    const { fullName, companyName, email, phone, address, notes } = req.body;

    if (!fullName || !companyName || !email || !phone) {
      throw AppError.badRequest('Full name, company name, email, and phone are required');
    }

    const client = await Client.create({
      fullName,
      companyName,
      email,
      phone,
      address,
      notes,
    });

    await ActivityLog.record({
      type: 'client_created',
      description: `Admin registered client '${client.fullName}' (${client.companyName})`,
      performedBy: req.user._id,
      clientId: client._id,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Client registered successfully',
      data: client.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/clients/:id
 * Update client details
 */
router.put('/:id', async (req, res, next) => {
  try {
    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!client) {
      throw AppError.notFound('Client not found');
    }

    return sendSuccess(res, {
      message: 'Client updated successfully',
      data: client.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/clients/:id/status
 * Toggle client active/inactive status
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      throw AppError.badRequest("Status must be 'active' or 'inactive'");
    }

    const client = await Client.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!client) {
      throw AppError.notFound('Client not found');
    }

    return sendSuccess(res, {
      message: `Client status updated to '${status}'`,
      data: client.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
