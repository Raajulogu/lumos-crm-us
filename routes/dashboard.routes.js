import express from 'express';
import { Project, Doubt, FollowUp, ActivityLog } from '../models/index.js';
import { authenticate, requireAdmin, requireEmployee } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/dashboard/admin
 * Admin command center KPI cards & live activity timeline
 */
router.get('/admin', requireAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const [
      overdueProjectsCount,
      upcomingDeadlinesCount,
      openDoubtsCount,
      pendingFollowupsTodayCount,
      activeProjectsCount,
      recentActivityFeed,
    ] = await Promise.all([
      Project.countDocuments({
        deliveryDate: { $lt: now },
        status: { $nin: ['delivered', 'completed'] },
      }),
      Project.countDocuments({
        deliveryDate: { $gte: now, $lte: next7Days },
        status: { $nin: ['delivered', 'completed'] },
      }),
      Doubt.countDocuments({ status: 'open' }),
      FollowUp.countDocuments({
        scheduledAt: { $gte: startOfToday, $lte: endOfToday },
        status: 'pending',
      }),
      Project.countDocuments({
        status: { $nin: ['delivered', 'completed'] },
      }),
      ActivityLog.find().sort({ createdAt: -1 }).limit(10),
    ]);

    return sendSuccess(res, {
      message: 'Admin dashboard metrics loaded',
      data: {
        metrics: {
          overdueProjectsCount,
          upcomingDeadlinesCount,
          openDoubtsCount,
          pendingFollowupsTodayCount,
          activeProjectsCount,
        },
        recentActivityFeed: recentActivityFeed.map((act) => ({
          id: act._id.toString(),
          type: act.type,
          description: act.description,
          timestamp: act.createdAt,
          projectId: act.projectId ? act.projectId.toString() : null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/dashboard/employee
 * Employee personal workload overview
 */
router.get('/employee', requireEmployee, async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now = new Date();
    const next7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const assignedFilter = {
      $or: [{ primaryEmployeeId: userId }, { additionalMemberIds: userId }],
    };

    const [
      myActiveProjectsCount,
      myOverdueProjectsCount,
      myUpcomingDeadlinesCount,
      myPendingFollowupsCount,
      myOpenDoubtsCount,
      recentAssignedProjects,
    ] = await Promise.all([
      Project.countDocuments({
        ...assignedFilter,
        status: { $nin: ['delivered', 'completed'] },
      }),
      Project.countDocuments({
        ...assignedFilter,
        deliveryDate: { $lt: now },
        status: { $nin: ['delivered', 'completed'] },
      }),
      Project.countDocuments({
        ...assignedFilter,
        deliveryDate: { $gte: now, $lte: next7Days },
        status: { $nin: ['delivered', 'completed'] },
      }),
      FollowUp.countDocuments({
        assignedTo: userId,
        status: 'pending',
      }),
      Doubt.countDocuments({
        raisedBy: userId,
        status: 'open',
      }),
      Project.find(assignedFilter)
        .populate('clientId', 'fullName companyName')
        .sort({ deliveryDate: 1 })
        .limit(5),
    ]);

    const formattedRecentProjects = recentAssignedProjects.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      client: {
        id: p.clientId?._id?.toString() || null,
        fullName: p.clientId?.fullName || '',
        companyName: p.clientId?.companyName || '',
      },
      status: p.status,
      deliveryDate: p.deliveryDate,
      priority: p.priority,
    }));

    return sendSuccess(res, {
      message: 'Employee dashboard metrics loaded',
      data: {
        myActiveProjectsCount,
        myOverdueProjectsCount,
        myUpcomingDeadlinesCount,
        myPendingFollowupsCount,
        myOpenDoubtsCount,
        recentAssignedProjects: formattedRecentProjects,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
