import express from 'express';
import { ServiceCategory, Settings, Project } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/settings/categories
 * List service categories (Accessible to both Admin and Employee for forms)
 */
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await ServiceCategory.find().sort({ name: 1 });

    return sendSuccess(res, {
      message: 'Service categories loaded',
      data: categories.map((c) => ({
        id: c._id.toString(),
        name: c.name,
        color: c.color,
        isDefault: c.isDefault,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/settings/categories
 * Create a new service category (Admin only)
 */
router.post('/categories', requireAdmin, async (req, res, next) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      throw AppError.badRequest('Category name is required');
    }

    const existing = await ServiceCategory.findOne({ name: name.trim() });
    if (existing) {
      throw AppError.conflict(`Category '${name}' already exists`);
    }

    const category = await ServiceCategory.create({
      name: name.trim(),
      color: color || '#3b82f6',
      isDefault: false,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Category created successfully',
      data: category.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/settings/categories/:id
 * Delete a category (Admin only, checks usage)
 */
router.delete('/categories/:id', requireAdmin, async (req, res, next) => {
  try {
    const category = await ServiceCategory.findById(req.params.id);
    if (!category) {
      throw AppError.notFound('Category not found');
    }

    // Check if in use by any project
    const inUseCount = await Project.countDocuments({
      serviceCategories: category._id,
    });

    if (inUseCount > 0) {
      throw AppError.conflict('Cannot delete service category because it is in use by active projects.');
    }

    await ServiceCategory.findByIdAndDelete(category._id);

    return sendSuccess(res, {
      message: 'Service category deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/settings/reminders
 * Fetch global deadline reminder milestone configuration (Admin only)
 */
router.get('/reminders', requireAdmin, async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    return sendSuccess(res, {
      message: 'Global reminder settings fetched',
      data: {
        reminders: settings.reminders,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/settings/reminders
 * Update global reminder configuration (Admin only)
 */
router.put('/reminders', requireAdmin, async (req, res, next) => {
  try {
    const { reminders } = req.body;
    if (!Array.isArray(reminders)) {
      throw AppError.badRequest('Reminders must be an array of milestone objects');
    }

    const settings = await Settings.getSettings();
    settings.reminders = reminders;
    await settings.save();

    return sendSuccess(res, {
      message: 'Global reminder settings updated',
      data: {
        reminders: settings.reminders,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/settings/notifications
 * Fetch agency email notification preferences (Admin only)
 */
router.get('/notifications', requireAdmin, async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    return sendSuccess(res, {
      message: 'Notification preferences fetched',
      data: settings.notificationPreferences,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/settings/notifications
 * Update agency email notification preferences (Admin only)
 */
router.put('/notifications', requireAdmin, async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();
    settings.notificationPreferences = {
      ...settings.notificationPreferences,
      ...req.body,
    };
    await settings.save();

    return sendSuccess(res, {
      message: 'Notification preferences updated',
      data: settings.notificationPreferences,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
