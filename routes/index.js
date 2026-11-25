import express from 'express';
import authRoutes from './auth.routes.js';
import clientRoutes from './client.routes.js';
import projectRoutes from './project.routes.js';
import doubtRoutes from './doubt.routes.js';
import noteRoutes from './note.routes.js';
import followupRoutes from './followup.routes.js';
import notificationRoutes from './notification.routes.js';
import employeeRoutes from './employee.routes.js';
import analyticsRoutes from './analytics.routes.js';
import settingsRoutes from './settings.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import taskRoutes from './task.routes.js';
import attendanceRoutes from './attendance.routes.js';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/clients', clientRoutes);
router.use('/projects', projectRoutes);
router.use('/', doubtRoutes);
router.use('/', noteRoutes);
router.use('/', taskRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/followups', followupRoutes);
router.use('/notifications', notificationRoutes);
router.use('/employees', employeeRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settings', settingsRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
