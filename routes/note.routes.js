import express from 'express';
import { Note, Project, ActivityLog } from '../models/index.js';
import { AppError } from '../errors/AppError.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess } from '../utils/response.js';

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/projects/:projectId/notes
 * Retrieve chronological notes for a project
 */
router.get('/projects/:projectId/notes', async (req, res, next) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    const isAdmin = req.user.role === 'admin';
    const isAssigned =
      project.primaryEmployeeId?.toString() === req.user._id.toString() ||
      project.additionalMemberIds?.some((m) => m.toString() === req.user._id.toString());

    if (!isAdmin && !isAssigned) {
      throw AppError.forbidden('Access denied. You are not assigned to this project.');
    }

    const notes = await Note.find({ projectId: project._id })
      .populate('authorId', 'fullName role')
      .sort({ createdAt: -1 });

    const formattedNotes = notes.map((n) => ({
      id: n._id.toString(),
      projectId: n.projectId.toString(),
      authorId: n.authorId?._id?.toString() || null,
      authorType: n.authorType,
      authorName: n.authorId?.fullName || 'User',
      content: n.content,
      createdAt: n.createdAt,
    }));

    return sendSuccess(res, {
      message: 'Notes retrieved',
      data: formattedNotes,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/notes
 * Add internal project note
 */
router.post('/projects/:projectId/notes', async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      throw AppError.badRequest('Note content cannot be empty');
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      throw AppError.notFound('Project not found');
    }

    const isAdmin = req.user.role === 'admin';
    const isAssigned =
      project.primaryEmployeeId?.toString() === req.user._id.toString() ||
      project.additionalMemberIds?.some((m) => m.toString() === req.user._id.toString());

    if (!isAdmin && !isAssigned) {
      throw AppError.forbidden('Access denied. You are not assigned to this project.');
    }

    const note = await Note.create({
      projectId: project._id,
      authorId: req.user._id,
      authorType: req.user.role,
      content: content.trim(),
    });

    await ActivityLog.record({
      type: 'note_added',
      description: `${req.user.fullName} added a note on '${project.name}'`,
      performedBy: req.user._id,
      projectId: project._id,
      clientId: project.clientId,
    });

    return sendSuccess(res, {
      statusCode: 201,
      message: 'Note added successfully',
      data: {
        id: note._id.toString(),
        projectId: note.projectId.toString(),
        authorId: req.user._id.toString(),
        authorType: note.authorType,
        authorName: req.user.fullName,
        content: note.content,
        createdAt: note.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
