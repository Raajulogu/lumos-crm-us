import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'agency_settings',
      unique: true,
    },
    reminders: {
      type: [
        {
          daysBeforeDeadline: {
            type: Number,
            required: true,
          },
        },
      ],
      default: [
        { daysBeforeDeadline: 3 },
        { daysBeforeDeadline: 2 },
        { daysBeforeDeadline: 1 },
        { daysBeforeDeadline: 0 },
      ],
    },
    notificationPreferences: {
      deadlineRemindersEmail: {
        type: Boolean,
        default: true,
      },
      overdueAlertsEmail: {
        type: Boolean,
        default: true,
      },
      doubtAlertsEmail: {
        type: Boolean,
        default: true,
      },
      followUpRemindersEmail: {
        type: Boolean,
        default: true,
      },
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

// Static method to get or initialize the singleton agency settings
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ key: 'agency_settings' });
  if (!settings) {
    settings = await this.create({ key: 'agency_settings' });
  }
  return settings;
};

export const Settings = mongoose.model('Settings', settingsSchema);
