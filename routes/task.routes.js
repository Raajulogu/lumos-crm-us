import express from 'express';
import { Task, TaskPunch, Project, User, ActivityLog } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

// ==========================================
// 4.1 TASKS MANAGEMENT
// ==========================================

/**
 * GET /api/v1/projects/:projectId/tasks
 * List all tasks for a project
 */
router.get('/projects/:projectId/tasks', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    const filter = { projectId: project._id };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.assignedToId) {
      filter.assignedToId = req.query.assignedToId === 'unassigned' ? null : req.query.assignedToId;
    }

    const tasks = await Task.find(filter)
      .populate('assignedToId', 'fullName email designation')
      .sort({ createdAt: -1 });

    const formattedTasks = tasks.map((t) => {
      const obj = t.toJSON();
      obj.assignedTo = t.assignedToId;
      return obj;
    });

    return sendSuccess(res, {
      message: 'Project tasks retrieved successfully',
      data: formattedTasks,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/tasks
 * Create a new task under a project
 */
router.post('/projects/:projectId/tasks', async (req, res, next) => {
  try {
    const { title, description, assignedToId, priority, dueDate, estimatedHours } = req.body;

    if (!title || !title.trim()) {
      throw AppError.badRequest('Task title is required');
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    let assignedUser = null;
    if (assignedToId) {
      assignedUser = await User.findById(assignedToId);
      if (!assignedUser) {
        throw AppError.badRequest('Assigned employee does not exist');
      }
    }

    const task = await Task.create({
      projectId: project._id,
      title: title.trim(),
      description: description ? description.trim() : '',
      assignedToId: assignedUser ? assignedUser._id : null,
      priority: priority || 'medium',
      dueDate: dueDate ? new Date(dueDate) : null,
      estimatedHours: estimatedHours ? Number(estimatedHours) : 0,
      status: 'todo',
    });

    await ActivityLog.record({
      type: 'status_changed',
      description: `${req.user.fullName} created task '${task.title}' for project '${project.name}'`,
      performedBy: req.user._id,
      projectId: project._id,
      metadata: { taskId: task._id },
    });

    const populatedTask = await Task.findById(task._id).populate('assignedToId', 'fullName email designation');
    const taskObj = populatedTask.toJSON();
    taskObj.assignedTo = populatedTask.assignedToId;

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Task created successfully',
      data: taskObj,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/tasks/bulk-assign
 * Bulk assign tasks to an employee (Admin only)
 */
router.post('/projects/:projectId/tasks/bulk-assign', requireAdmin, async (req, res, next) => {
  try {
    const { taskIds, employeeId } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0) {
      throw AppError.badRequest('taskIds must be a non-empty array of task IDs');
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    let assignedUser = null;
    if (employeeId) {
      assignedUser = await User.findById(employeeId);
      if (!assignedUser) {
        throw AppError.badRequest('Target employee does not exist');
      }
    }

    const result = await Task.updateMany(
      {
        _id: { $in: taskIds },
        projectId: project._id,
      },
      {
        $set: { assignedToId: assignedUser ? assignedUser._id : null },
      }
    );

    return sendSuccess(res, {
      message: `Bulk assigned ${result.modifiedCount} tasks successfully`,
      data: {
        updatedCount: result.modifiedCount,
        assignedToId: assignedUser ? assignedUser._id.toString() : null,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/tasks/my-assigned
 * List tasks assigned to the current authenticated employee
 */
router.get('/tasks/my-assigned', async (req, res, next) => {
  try {
    const filter = { assignedToId: req.user._id };

    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }

    if (req.query.priority && req.query.priority !== 'all') {
      filter.priority = req.query.priority;
    }

    if (req.query.search) {
      filter.title = new RegExp(req.query.search.trim(), 'i');
    }

    const tasks = await Task.find(filter)
      .populate('projectId', 'name status deliveryDate clientId')
      .sort({ dueDate: 1, createdAt: -1 });

    const formattedTasks = tasks.map((t) => {
      const obj = t.toJSON();
      obj.project = t.projectId;
      return obj;
    });

    return sendSuccess(res, {
      message: 'My assigned tasks retrieved successfully',
      data: formattedTasks,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/tasks/:taskId
 * Update task details (status, title, description, priority, etc.)
 */
router.put('/tasks/:taskId', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      throw AppError.notFound('Task not found');
    }

    const isAdmin = req.user.role === 'admin';
    const isAssigned = task.assignedToId?.toString() === req.user._id.toString();

    if (!isAdmin && !isAssigned) {
      throw AppError.forbidden('Access denied. You can only update tasks assigned to you.');
    }

    const allowedUpdates = isAdmin
      ? ['title', 'description', 'assignedToId', 'status', 'priority', 'dueDate', 'estimatedHours']
      : ['status', 'description'];

    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        task[field] = req.body[field];
      }
    });

    await task.save();

    const updatedTask = await Task.findById(task._id).populate('assignedToId', 'fullName email designation');
    const taskObj = updatedTask.toJSON();
    taskObj.assignedTo = updatedTask.assignedToId;

    return sendSuccess(res, {
      message: 'Task updated successfully',
      data: taskObj,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/tasks/:taskId/assign
 * Reassign an individual task (Admin only)
 */
router.patch('/tasks/:taskId/assign', requireAdmin, async (req, res, next) => {
  try {
    const { employeeId } = req.body;

    const task = await Task.findById(req.params.taskId);
    if (!task) {
      throw AppError.notFound('Task not found');
    }

    if (employeeId) {
      const employee = await User.findById(employeeId);
      if (!employee) {
        throw AppError.badRequest('Assigned employee does not exist');
      }
      task.assignedToId = employee._id;
    } else {
      task.assignedToId = null;
    }

    await task.save();

    const updatedTask = await Task.findById(task._id).populate('assignedToId', 'fullName email designation');
    const taskObj = updatedTask.toJSON();
    taskObj.assignedTo = updatedTask.assignedToId;

    return sendSuccess(res, {
      message: 'Task assigned successfully',
      data: taskObj,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/tasks/:taskId
 * Delete a task and its punches (Admin only)
 */
router.delete('/tasks/:taskId', requireAdmin, async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      throw AppError.notFound('Task not found');
    }

    await Promise.all([
      Task.findByIdAndDelete(task._id),
      TaskPunch.deleteMany({ taskId: task._id }),
    ]);

    return sendSuccess(res, {
      message: 'Task deleted successfully',
      data: null,
    });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// 4.2 WORK PUNCHES & TIMER
// ==========================================

/**
 * POST /api/v1/tasks/:taskId/punches/start
 * Start work timer for task
 */
router.post('/tasks/:taskId/punches/start', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      throw AppError.notFound('Task not found');
    }

    // Check if employee already has an active running timer on any task
    const activePunch = await TaskPunch.findOne({
      employeeId: req.user._id,
      endTime: null,
    }).populate('taskId', 'title');

    if (activePunch) {
      // If already running on this same task, return it
      if (activePunch.taskId?._id?.toString() === task._id.toString()) {
        return sendSuccess(res, {
          message: 'Work timer is already running for this task',
          data: activePunch.toJSON(),
        });
      }
      throw AppError.badRequest(
        `You already have an active timer running on task '${activePunch.taskId?.title || 'Unknown'}'. Please stop it first.`
      );
    }

    const punch = await TaskPunch.create({
      taskId: task._id,
      projectId: task.projectId,
      employeeId: req.user._id,
      startTime: new Date(),
    });

    // Auto-update task from 'todo' to 'in_progress' if needed
    if (task.status === 'todo') {
      task.status = 'in_progress';
      await task.save();
    }

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Work timer started',
      data: punch.toJSON(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/tasks/:taskId/punches/:punchId/stop
 * Stop work timer, record work note, and update task status & logged time
 */
router.post('/tasks/:taskId/punches/:punchId/stop', async (req, res, next) => {
  try {
    const { statusAtStop, notes, durationSeconds: clientDuration } = req.body;

    const punch = await TaskPunch.findOne({
      _id: req.params.punchId,
      taskId: req.params.taskId,
    });

    if (!punch) {
      throw AppError.notFound('Punch record not found');
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = punch.employeeId.toString() === req.user._id.toString();

    if (!isAdmin && !isOwner) {
      throw AppError.forbidden('You can only stop your own work timer');
    }

    if (punch.endTime) {
      throw AppError.badRequest('This timer session has already been stopped');
    }

    const endTime = new Date();
    const computedDuration = clientDuration
      ? Number(clientDuration)
      : Math.max(1, Math.round((endTime.getTime() - new Date(punch.startTime).getTime()) / 1000));

    punch.endTime = endTime;
    punch.durationSeconds = computedDuration;
    punch.statusAtStop = statusAtStop || null;
    punch.notes = notes ? notes.trim() : '';
    await punch.save();

    // Update Task metrics
    const task = await Task.findById(punch.taskId);
    if (task) {
      if (statusAtStop && ['todo', 'in_progress', 'review', 'completed', 'blocked'].includes(statusAtStop)) {
        task.status = statusAtStop;
      }
      task.totalPunchesCount = (task.totalPunchesCount || 0) + 1;
      task.totalLoggedMinutes = (task.totalLoggedMinutes || 0) + Math.round(computedDuration / 60);
      await task.save();
    }

    return sendSuccess(res, {
      message: 'Work timer stopped successfully',
      data: {
        punch: punch.toJSON(),
        taskStatus: task ? task.status : null,
        totalLoggedMinutes: task ? task.totalLoggedMinutes : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/tasks/:taskId/punches
 * List all chronological punch sessions for a task
 */
router.get('/tasks/:taskId/punches', async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) {
      throw AppError.notFound('Task not found');
    }

    const punches = await TaskPunch.find({ taskId: task._id })
      .populate('employeeId', 'fullName email designation')
      .sort({ createdAt: -1 });

    const formattedPunches = punches.map((p) => {
      const obj = p.toJSON();
      obj.employee = p.employeeId;
      return obj;
    });

    return sendSuccess(res, {
      message: 'Task punch sessions retrieved successfully',
      data: formattedPunches,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
