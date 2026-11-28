import mongoose from 'mongoose';

const followupEvaluationSchema = new mongoose.Schema(
  {
    followupId: { type: mongoose.Schema.Types.ObjectId, ref: 'Followup', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comments: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true, transform: (doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; delete ret.__v; return ret; } },
    toObject: { virtuals: true, transform: (doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; delete ret.__v; return ret; } },
  }
);

export const FollowupEvaluation = mongoose.model('FollowupEvaluation', followupEvaluationSchema);

