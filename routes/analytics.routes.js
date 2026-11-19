import express from 'express';
import { Project, Client, User, FollowUp, Doubt, ServiceCategory } from '../models/index.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate, requireAdmin);

/**
 * GET /api/v1/analytics/overview
 * Financial metrics, project performance, client retention, and team productivity
 */
router.get('/overview', async (req, res, next) => {
  try {
    const range = req.query.range || 'all';
    const dateFilter = {};

    const now = new Date();
    if (range === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      dateFilter.createdAt = { $gte: startOfMonth };
    } else if (range === 'quarter') {
      const quarterStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      dateFilter.createdAt = { $gte: quarterStart };
    } else if (range === 'year') {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      dateFilter.createdAt = { $gte: yearStart };
    }

    const [projects, clients, employees, followUps, doubts, categories] = await Promise.all([
      Project.find(dateFilter).populate('serviceCategories').populate('clientId'),
      Client.find(),
      User.find({ role: 'employee' }),
      FollowUp.find(),
      Doubt.find(),
      ServiceCategory.find(),
    ]);

    // Financial calculations
    let totalRevenue = 0;
    let totalCost = 0;
    projects.forEach((p) => {
      totalRevenue += p.budget || 0;
      totalCost += p.actualCost || 0;
    });
    const netProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;

    // Monthly trends (grouped by Month Year)
    const monthMap = new Map();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    projects.forEach((p) => {
      const d = p.createdAt || now;
      const key = `${months[d.getMonth()]} ${d.getFullYear()}`;
      const current = monthMap.get(key) || { month: key, revenue: 0, cost: 0, profit: 0, sortKey: d.getTime() };
      current.revenue += p.budget || 0;
      current.cost += p.actualCost || 0;
      current.profit = current.revenue - current.cost;
      monthMap.set(key, current);
    });
    const monthlyTrends = Array.from(monthMap.values()).slice(-6);

    // Category distribution
    const categoryCountMap = new Map();
    categories.forEach((c) => {
      categoryCountMap.set(c._id.toString(), {
        categoryName: c.name,
        color: c.color || '#3b82f6',
        count: 0,
        totalBudget: 0,
      });
    });

    projects.forEach((p) => {
      p.serviceCategories?.forEach((cat) => {
        const catId = cat._id?.toString() || cat.toString();
        const stat = categoryCountMap.get(catId);
        if (stat) {
          stat.count += 1;
          stat.totalBudget += p.budget || 0;
        }
      });
    });
    const categoryDistribution = Array.from(categoryCountMap.values()).filter((c) => c.count > 0);

    // Client retention analysis
    const clientProjectsMap = new Map();
    projects.forEach((p) => {
      if (p.clientId) {
        const cId = p.clientId._id ? p.clientId._id.toString() : p.clientId.toString();
        const cur = clientProjectsMap.get(cId) || {
          clientId: cId,
          clientName: p.clientId.fullName || 'Client',
          companyName: p.clientId.companyName || '',
          totalProjects: 0,
          totalValue: 0,
        };
        cur.totalProjects += 1;
        cur.totalValue += p.budget || 0;
        clientProjectsMap.set(cId, cur);
      }
    });

    const clientSummaries = Array.from(clientProjectsMap.values());
    const returningClients = clientSummaries.filter((c) => c.totalProjects > 1).length;
    const totalClientCount = clients.length || 1;
    const retentionRate = Math.round((returningClients / totalClientCount) * 100);
    const topClients = clientSummaries.sort((a, b) => b.totalValue - a.totalValue).slice(0, 5);

    // Employee leaderboard
    const employeeLeaderboard = employees.map((emp) => {
      const empProjects = projects.filter(
        (p) =>
          p.primaryEmployeeId?.toString() === emp._id.toString() ||
          p.additionalMemberIds?.some((m) => m.toString() === emp._id.toString())
      );

      let completedOnTime = 0;
      let completedCount = 0;
      let totalDuration = 0;

      empProjects.forEach((p) => {
        if (p.status === 'delivered' || p.status === 'completed') {
          completedCount++;
          const finishDate = p.deliveredAt || p.updatedAt;
          if (finishDate <= p.deliveryDate) completedOnTime++;
          if (p.startDate && finishDate) {
            totalDuration += Math.ceil(
              Math.abs(new Date(finishDate) - new Date(p.startDate)) / (1000 * 60 * 60 * 24)
            );
          }
        }
      });

      const openDoubts = doubts.filter(
        (d) => d.raisedBy?.toString() === emp._id.toString() && d.status === 'open'
      ).length;

      return {
        employeeId: emp._id.toString(),
        employeeName: emp.fullName,
        totalProjects: empProjects.length,
        completedOnTime,
        onTimeRate: completedCount > 0 ? parseFloat(((completedOnTime / completedCount) * 100).toFixed(1)) : 100,
        openDoubts,
        avgDurationDays: completedCount > 0 ? Math.round(totalDuration / completedCount) : 0,
      };
    });

    // Follow-up performance
    const totalScheduled = followUps.length;
    const completedFollowups = followUps.filter((f) => f.status === 'done').length;
    const missedFollowups = followUps.filter((f) => f.status === 'missed').length;
    const pendingFollowups = followUps.filter((f) => f.status === 'pending').length;
    const followUpCompletionRate =
      totalScheduled > 0 ? parseFloat(((completedFollowups / totalScheduled) * 100).toFixed(1)) : 100;

    return sendSuccess(res, {
      message: 'Financial overview retrieved',
      data: {
        totalRevenue,
        totalCost,
        netProfit,
        profitMargin,
        monthlyTrends,
        categoryDistribution,
        clientRetention: {
          newClients: totalClientCount - returningClients,
          returningClients,
          retentionRate,
          topClients,
        },
        employeeLeaderboard: employeeLeaderboard.sort((a, b) => b.onTimeRate - a.onTimeRate),
        followUpPerformance: {
          totalScheduled,
          completed: completedFollowups,
          missed: missedFollowups,
          pending: pendingFollowups,
          completionRate: followUpCompletionRate,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
