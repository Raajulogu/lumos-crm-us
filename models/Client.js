import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Client full name is required'],
      trim: true,
      index: true,
    },
    companyName: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Client email is required'],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Client phone is required'],
      trim: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
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

// Full text search index across name, company, and email
clientSchema.index({ fullName: 'text', companyName: 'text', email: 'text' });

/**
 * Masked view for employees: restricts sensitive contact info (phone, email, address, notes)
 * Only exposes id, fullName, and companyName.
 */
clientSchema.methods.toEmployeeSafe = function () {
  return {
    id: this._id ? this._id.toString() : undefined,
    fullName: this.fullName,
    companyName: this.companyName,
  };
};

export const Client = mongoose.model('Client', clientSchema);
