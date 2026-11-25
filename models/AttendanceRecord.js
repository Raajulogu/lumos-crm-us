import mongoose from 'mongoose';

const attendanceRecordSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Employee ID is required'],
      index: true,
    },
    clockInTime: {
      type: Date,
      required: [true, 'Clock-in time is required'],
      default: Date.now,
    },
    clockOutTime: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
      min: 0,
    },
    date: {
      type: String,
      required: [true, 'Date string (YYYY-MM-DD) is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['clocked_in', 'clocked_out'],
      default: 'clocked_in',
      index: true,
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

attendanceRecordSchema.index({ employeeId: 1, status: 1 });
attendanceRecordSchema.index({ employeeId: 1, date: 1 });

export const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema);
