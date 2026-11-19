import express from 'express';
import { Notification } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/notifications
 * Fetch active notifications for authenticated user
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = { recipientId: req.user._id };
    if (req.query.unreadOnly === 'true') {
      filter.read = false;
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);

    return sendSuccess(res, {
      message: 'Notifications fetched',
      data: notifications.map((n) => n.toJSON()),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single notification as read
 */
router.patch('/:id/read', async (req, res, next) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipientId: req.user._id,
    });

    if (!notification) {
      throw AppError.notFound('Notification not found');
    }

    notification.read = true;
    await notification.save();

    return sendSuccess(res, {
      message: 'Notification marked as read',
      data: notification.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/notifications/read-all
 * Mark all notifications as read for current user
 */
router.patch('/read-all', async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { recipientId: req.user._id, read: false },
      { $set: { read: true } }
    );

    return sendSuccess(res, {
      message: 'All notifications marked as read',
      data: { markedCount: result.modifiedCount },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
