import mongoose from 'mongoose';

const ideaSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, default: '', maxlength: 12000 },
  category: { type: String, default: 'General', trim: true },
  status: { type: String, enum: ['Backlog', 'Active', 'Review', 'Done'], default: 'Backlog', index: true },
  priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  progress: { type: Number, min: 0, max: 100, default: 0 },
  tags: [{ type: String, trim: true }]
}, { timestamps: true });

ideaSchema.index({ title: 'text', description: 'text', tags: 'text', category: 'text' });
export default mongoose.model('Idea', ideaSchema);
