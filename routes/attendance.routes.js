import express from 'express';
import { AttendanceRecord } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/attendance/status
 * Check current shift clock-in status for authenticated user
 */
router.get('/status', async (req, res, next) => {
  try {
    const activeRecord = await AttendanceRecord.findOne({
      employeeId: req.user._id,
      status: 'clocked_in',
      clockOutTime: null,
    }).sort({ clockInTime: -1 });

    return sendSuccess(res, {
      message: 'Attendance status fetched',
      data: {
        isClockedIn: Boolean(activeRecord),
        currentRecord: activeRecord ? activeRecord.toJSON() : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/attendance/clock-in
 * Clock in for daily shift
 */
router.post('/clock-in', async (req, res, next) => {
  try {
    const existing = await AttendanceRecord.findOne({
      employeeId: req.user._id,
      status: 'clocked_in',
      clockOutTime: null,
    });

    if (existing) {
      throw AppError.badRequest('You are already clocked in for an active shift');
    }

    const todayDateStr = new Date().toISOString().split('T')[0];

    const record = await AttendanceRecord.create({
      employeeId: req.user._id,
      clockInTime: new Date(),
      date: todayDateStr,
      status: 'clocked_in',
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Clocked in successfully',
      data: record.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/attendance/clock-out
 * Clock out from active daily shift
 */
router.post('/clock-out', async (req, res, next) => {
  try {
    const activeRecord = await AttendanceRecord.findOne({
      employeeId: req.user._id,
      status: 'clocked_in',
      clockOutTime: null,
    }).sort({ clockInTime: -1 });

    if (!activeRecord) {
      throw AppError.badRequest('No active clock-in session found to clock out from');
    }

    const clockOutTime = new Date();
    const durationMinutes = Math.max(
      1,
      Math.round((clockOutTime.getTime() - new Date(activeRecord.clockInTime).getTime()) / 60000)
    );

    activeRecord.clockOutTime = clockOutTime;
    activeRecord.durationMinutes = durationMinutes;
    activeRecord.status = 'clocked_out';
    await activeRecord.save();

    return sendSuccess(res, {
      message: 'Clocked out successfully',
      data: activeRecord.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/attendance/history
 * List shift history (Employee sees own, Admin can filter by employeeId)
 */
router.get('/history', async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const filter = {};

    if (!isAdmin) {
      filter.employeeId = req.user._id;
    } else if (req.query.employeeId) {
      filter.employeeId = req.query.employeeId;
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filter.date = {};
      if (req.query.dateFrom) filter.date.$gte = req.query.dateFrom;
      if (req.query.dateTo) filter.date.$lte = req.query.dateTo;
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      AttendanceRecord.find(filter)
        .populate('employeeId', 'fullName email designation')
        .sort({ clockInTime: -1 })
        .skip(skip)
        .limit(limit),
      AttendanceRecord.countDocuments(filter),
    ]);

    const formattedRecords = records.map((r) => {
      const obj = r.toJSON();
      obj.employee = r.employeeId;
      return obj;
    });

    return sendSuccess(res, {
      message: 'Attendance history retrieved',
      data: formattedRecords,
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

export default router;
