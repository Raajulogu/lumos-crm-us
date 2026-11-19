import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      index: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'Client reference is required'],
      index: true,
    },
    serviceCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ServiceCategory',
      },
    ],
    description: {
      type: String,
      required: [true, 'Project description/requirements are required'],
      trim: true,
    },
    budget: {
      type: Number,
      required: [true, 'Agreed budget in INR is required'],
      min: [0, 'Budget cannot be negative'],
    },
    actualCost: {
      type: Number,
      default: 0,
      min: [0, 'Actual cost cannot be negative'],
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
    },
    deliveryDate: {
      type: Date,
      required: [true, 'Delivery deadline is required'],
      index: true,
    },
    deliveredAt: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['new', 'in_progress', 'under_review', 'completed', 'delivered'],
      default: 'new',
      index: true,
    },
    primaryEmployeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    additionalMemberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    reminderOverrides: [
      {
        daysBeforeDeadline: {
          type: Number,
          required: true,
        },
      },
    ],
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

// Virtual for auto-calculating profit (Admin only)
projectSchema.virtual('profit').get(function () {
  return (this.budget || 0) - (this.actualCost || 0);
});

// Virtual for overdue check
projectSchema.virtual('isOverdue').get(function () {
  if (this.status === 'delivered' || this.status === 'completed') return false;
  return new Date() > this.deliveryDate;
});

// Compound indexes for dashboards, filters, and employee assignment queries
projectSchema.index({ status: 1, deliveryDate: 1 });
projectSchema.index({ primaryEmployeeId: 1, status: 1 });
projectSchema.index({ additionalMemberIds: 1 });
projectSchema.index({ clientId: 1, status: 1 });

/**
 * Strips financials (budget, actualCost, profit) and masks client for employee responses
 */
projectSchema.methods.toEmployeeSafe = function () {
  const obj = this.toJSON();
  delete obj.budget;
  delete obj.actualCost;
  delete obj.profit;

  // Mask client info if populated
  if (obj.clientId && typeof obj.clientId === 'object') {
    obj.client = {
      id: obj.clientId.id || obj.clientId._id,
      fullName: obj.clientId.fullName,
      companyName: obj.clientId.companyName,
    };
    delete obj.clientId;
  }

  return obj;
};

export const Project = mongoose.model('Project', projectSchema);
