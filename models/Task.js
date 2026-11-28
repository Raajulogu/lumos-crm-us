// ------------------------------------------------------------
// Task Model (Mongoose)
// ------------------------------------------------------------
import mongoose from 'mongoose';

const taskSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Task title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // New many‑to‑many assignees
    assigneeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    // Legacy single assignee kept for backward compatibility (optional)
    assignedToId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'review', 'completed', 'blocked'],
      default: 'todo',
      index: true,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    dueDate: { type: Date, default: null },
    estimatedHours: { type: Number, default: 0, min: 0 },
    totalLoggedMinutes: { type: Number, default: 0, min: 0 },
    totalPunchesCount: { type: Number, default: 0, min: 0 },
    // New fields required by the spec
    startDate: { type: Date, default: Date.now, required: true },
    actualEndTime: { type: Date },
    autoClosed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for common queries
taskSchema.index({ projectId: 1, status: 1 });
taskSchema.index({ assignedToId: 1, status: 1 });

export const Task = mongoose.model('Task', taskSchema);
