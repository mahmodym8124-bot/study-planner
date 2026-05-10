import mongoose from 'mongoose';

const ideaSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, default: '', maxlength: 12000 },
  category: { type: String, default: 'General', trim: true, maxlength: 80 },
  status: { type: String, enum: ['Backlog', 'Active', 'Review', 'Done'], default: 'Backlog', index: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  tags: [{ type: String, trim: true, maxlength: 32 }]
}, { timestamps: true });

ideaSchema.index({ title: 'text', description: 'text', tags: 'text', category: 'text' });
ideaSchema.index({ user: 1, updatedAt: -1 });
ideaSchema.index({ user: 1, status: 1, updatedAt: -1 });
export default mongoose.model('Idea', ideaSchema);
