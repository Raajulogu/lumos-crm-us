import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // session id (e.g., JWT jti or custom)
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    loginTime: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true },
    data: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true, toJSON: { virtuals: true, transform: (doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; delete ret.__v; return ret; } }, toObject: { virtuals: true, transform: (doc, ret) => { ret.id = ret._id?.toString(); delete ret._id; delete ret.__v; return ret; } } }
);

export const Session = mongoose.model('Session', sessionSchema);

