import mongoose from 'mongoose';

const permissionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true },
    type: { type: String, required: true, trim: true },
    reason: { type: String, trim: true },
    // optional time range for permission request
    fromTime: { type: String, trim: true },
    toTime: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    // Review fields for admin actions
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date },
    reviewNotes: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; delete ret.__v; return ret; },
    },
    toObject: {
      virtuals: true,
      transform: (doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; delete ret.__v; return ret; },
    },
  }
);

export const Permission = mongoose.model('Permission', permissionSchema);
