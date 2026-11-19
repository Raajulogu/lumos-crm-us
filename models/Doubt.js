import mongoose from 'mongoose';

const doubtSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project reference is required'],
      index: true,
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee who raised the doubt is required'],
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Doubt subject is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Doubt description is required'],
      trim: true,
    },
    priority: {
      type: String,
      enum: ['normal', 'urgent'],
      default: 'normal',
    },
    status: {
      type: String,
      enum: ['open', 'resolved'],
      default: 'open',
      index: true,
    },
    adminReply: {
      type: String,
      trim: true,
      default: null,
    },
    adminRepliedAt: {
      type: Date,
      default: null,
    },
    adminRepliedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
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

doubtSchema.index({ projectId: 1, status: 1 });
doubtSchema.index({ raisedBy: 1, status: 1 });

export const Doubt = mongoose.model('Doubt', doubtSchema);
