import mongoose from 'mongoose';

const dailyFocusSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  date: { type: Date, required: true },
  focusStatement: { type: String, maxlength: 2000, default: '' },
  tasksCompleted: { type: Number, min: 0, default: 0 },
  totalSessions: { type: Number, min: 0, default: 0 },
  totalMinutes: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

dailyFocusSchema.index({ user: 1, date: -1 });

export default mongoose.model('DailyFocus', dailyFocusSchema);
