// ------------------------------------------------------------
// API Route Registration (Express)
// ------------------------------------------------------------
const express = require('express');
const router = express.Router();

const { ensureAuthenticated, requireRole } = require('../middleware/auth');

// Controllers
const tasksCtrl = require('../controllers/tasksController');
const projectsCtrl = require('../controllers/projectsController');
const clientsCtrl = require('../controllers/clientsController');
const serviceCatCtrl = require('../controllers/serviceCategoriesController');
const hrmsCtrl = require('../controllers/hrmsController');
const followupCtrl = require('../controllers/followupEvaluationController');

// ---------- Task Management ----------
router.get('/tasks', ensureAuthenticated, tasksCtrl.requireAdmin, tasksCtrl.listTasks);
router.get('/tasks/:taskId', ensureAuthenticated, tasksCtrl.requireAdmin, tasksCtrl.getTask);
router.post('/tasks', ensureAuthenticated, tasksCtrl.requireAdmin, tasksCtrl.createTask);
router.put('/tasks/:taskId', ensureAuthenticated, tasksCtrl.requireAdmin, tasksCtrl.updateTask);
router.post('/tasks/:taskId/auto-update', ensureAuthenticated, tasksCtrl.employeeAutoUpdate); // employee only, middleware checks role inside

// ---------- Project Details ----------
router.patch('/projects/:projectId', ensureAuthenticated, projectsCtrl.requireAdmin, projectsCtrl.patchProject);

// ---------- Client Details ----------
router.patch('/clients/:clientId', ensureAuthenticated, clientsCtrl.requireAdmin, clientsCtrl.patchClient);

// ---------- Service Categories ----------
router.post('/service-categories', ensureAuthenticated, serviceCatCtrl.requireAdmin, serviceCatCtrl.createServiceCategory);
router.get('/service-categories', ensureAuthenticated, serviceCatCtrl.listServiceCategories);

// ---------- HRMS ----------
router.get('/hrms/attendance', ensureAuthenticated, hrmsCtrl.getAttendance);
router.post('/hrms/attendance', ensureAuthenticated, hrmsCtrl.postAttendance);
router.get('/hrms/leave', ensureAuthenticated, hrmsCtrl.getLeaves);
router.post('/hrms/leave', ensureAuthenticated, hrmsCtrl.postLeave);
router.post('/hrms/permission', ensureAuthenticated, hrmsCtrl.postPermission);
router.post('/hrms/mail', ensureAuthenticated, hrmsCtrl.postMail);

// ---------- Follow‑up Evaluation ----------
router.post('/followups/:followupId/evaluation', ensureAuthenticated, followupCtrl.createEvaluation);
router.get('/followups/evaluations', ensureAuthenticated, followupCtrl.listEvaluations);

module.exports = router;

