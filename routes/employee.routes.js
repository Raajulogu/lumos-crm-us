import express from 'express';
import { User, Project, Doubt } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate, requireAdmin);

/**
 * GET /api/v1/employees
 * List all agency employees with workload stats (Admin only)
 */
router.get('/', async (req, res, next) => {
  try {
    const filter = { role: 'employee' };

    if (req.query.status && ['active', 'inactive'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (req.query.payType && ['salary', 'intern', 'hourly'].includes(req.query.payType)) {
      filter.payType = req.query.payType;
    }

    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search.trim(), 'i');
      filter.$or = [
        { fullName: searchRegex },
        { email: searchRegex },
        { designation: searchRegex },
      ];
    }

    const employees = await User.find(filter).sort({ createdAt: -1 });

    // Aggregate active project counts per employee
    const activeProjectAggs = await Project.aggregate([
      { $match: { status: { $nin: ['delivered', 'completed'] } } },
      { $group: { _id: '$primaryEmployeeId', count: { $sum: 1 } } },
    ]);

    const projectCountMap = new Map();
    activeProjectAggs.forEach((agg) => {
      if (agg._id) projectCountMap.set(agg._id.toString(), agg.count);
    });

    const formattedEmployees = employees.map((emp) => {
      const obj = emp.toJSON();
      obj.assignedProjectsCount = projectCountMap.get(emp._id.toString()) || 0;
      return obj;
    });

    return sendSuccess(res, {
      message: 'Employees list fetched',
      data: formattedEmployees,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/employees/:id
 * Full employee performance profile & assigned projects (Admin only)
 */
router.get('/:id', async (req, res, next) => {
  try {
    const employee = await User.findOne({ _id: req.params.id, role: 'employee' });
    if (!employee) {
      throw AppError.notFound('Employee not found');
    }

    const [projects, openDoubtsCount] = await Promise.all([
      Project.find({
        $or: [{ primaryEmployeeId: employee._id }, { additionalMemberIds: employee._id }],
      })
        .populate('clientId', 'fullName companyName')
        .sort({ deliveryDate: 1 }),
      Doubt.countDocuments({ raisedBy: employee._id, status: 'open' }),
    ]);

    let completedOnTime = 0;
    let completedTotal = 0;
    let totalDurationDays = 0;

    projects.forEach((p) => {
      if (p.status === 'delivered' || p.status === 'completed') {
        completedTotal++;
        const finishDate = p.deliveredAt || p.updatedAt;
        if (finishDate <= p.deliveryDate) {
          completedOnTime++;
        }
        if (p.startDate && finishDate) {
          const diffDays = Math.ceil(
            Math.abs(new Date(finishDate) - new Date(p.startDate)) / (1000 * 60 * 60 * 24)
          );
          totalDurationDays += diffDays;
        }
      }
    });

    const onTimeRate =
      completedTotal > 0 ? parseFloat(((completedOnTime / completedTotal) * 100).toFixed(1)) : 100;
    const avgDurationDays = completedTotal > 0 ? Math.round(totalDurationDays / completedTotal) : 0;

    return sendSuccess(res, {
      message: 'Employee details retrieved',
      data: {
        employee: employee.toJSON(),
        performance: {
          totalProjectsHandled: projects.length,
          completedOnTime,
          onTimeRate,
          openDoubts: openDoubtsCount,
          avgDurationDays,
        },
        assignedProjects: projects.map((p) => ({
          id: p._id.toString(),
          name: p.name,
          clientName: p.clientId?.companyName || p.clientId?.fullName || 'Client',
          status: p.status,
          deliveryDate: p.deliveryDate,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/employees
 * Create a new employee with temporary password (Admin only)
 */
router.post('/', async (req, res, next) => {
  try {
    const {
      fullName,
      email,
      phone,
      designation,
      payType,
      payRate,
      joinDate,
      initialPassword,
      notes,
    } = req.body;

    if (!fullName || !email || !phone || !designation || !initialPassword) {
      throw AppError.badRequest('Missing required employee fields');
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      throw AppError.conflict('An employee with this email already exists');
    }

    const employee = await User.create({
      fullName,
      email,
      phone,
      designation,
      payType: payType || 'salary',
      payRate: payRate || 0,
      joinDate: joinDate || new Date(),
      password: initialPassword,
      role: 'employee',
      mustChangePassword: true,
      notes: notes || '',
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Employee created successfully',
      data: employee.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/employees/:id
 * Update employee details (Admin only)
 */
router.put('/:id', async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    delete updateData.password; // Do not update password through this endpoint
    delete updateData.role;

    const employee = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'employee' },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!employee) {
      throw AppError.notFound('Employee not found');
    }

    return sendSuccess(res, {
      message: 'Employee updated successfully',
      data: employee.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/employees/:id/status
 * Activate / deactivate employee account (Admin only)
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['active', 'inactive'].includes(status)) {
      throw AppError.badRequest("Status must be 'active' or 'inactive'");
    }

    const employee = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'employee' },
      { status },
      { new: true }
    );

    if (!employee) {
      throw AppError.notFound('Employee not found');
    }

    return sendSuccess(res, {
      message: `Employee account status updated to '${status}'`,
      data: employee.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/employees/:id/password or /:employeeId/password
 * Admin-controlled password reset/update for an employee
 */
router.patch(['/:id/password', '/:employeeId/password'], async (req, res, next) => {
  try {
    const targetId = req.params.employeeId || req.params.id;
    const { password } = req.body;

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw AppError.badRequest('Password is required and must be at least 6 characters long');
    }

    const employee = await User.findOne({ _id: targetId, role: 'employee' });
    if (!employee) {
      throw AppError.notFound('Employee not found');
    }

    employee.password = password;
    employee.mustChangePassword = false;
    await employee.save();

    return sendSuccess(res, {
      message: 'Employee password updated successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
