import mongoose from 'mongoose';

const focusSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  taskId: { type: mongoose.Schema.Types.ObjectId, refPath: 'taskModel', default: null },
  taskModel: { type: String, enum: ['Note', 'Idea'], default: null },
  taskName: { type: String, maxlength: 256 },
  workDurationMinutes: { type: Number, min: 5, max: 120, default: 25 },
  breakDurationMinutes: { type: Number, min: 1, max: 60, default: 5 },
  sessionsCompleted: { type: Number, min: 0, default: 0 },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'paused', 'completed', 'abandoned'],
    default: 'pending'
  },
  startedAt: { type: Date },
  pausedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  currentPhase: { type: String, enum: ['work', 'break'], default: 'work' },
  elapsedSeconds: { type: Number, min: 0, default: 0 }
}, { timestamps: true });

focusSessionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('FocusSession', focusSessionSchema);
