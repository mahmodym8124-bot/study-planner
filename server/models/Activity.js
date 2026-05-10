import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  subject: { type: String, required: true },
  entityType: { type: String, enum: ['note', 'file', 'idea', 'productivity', 'auth'], required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId }
}, { timestamps: true });

activitySchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('Activity', activitySchema);
