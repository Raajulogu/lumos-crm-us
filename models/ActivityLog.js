import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'status_changed',
        'doubt_raised',
        'doubt_resolved',
        'note_added',
        'project_created',
        'client_created',
        'followup_created',
        'followup_done',
      ],
      required: [true, 'Activity type is required'],
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Activity description is required'],
      trim: true,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User who performed the activity is required'],
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      index: true,
      default: null,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
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

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ projectId: 1, createdAt: -1 });

// Helper to quickly record activity events without boilerplate
activityLogSchema.statics.record = async function (data) {
  try {
    return await this.create(data);
  } catch (error) {
    // Non-blocking error handling for activity logging
    console.error('Failed to log activity event:', error);
  }
};

export const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
