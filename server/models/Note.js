import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  content: { type: String, default: '', maxlength: 100000 },
  folder: { type: String, default: 'Personal', trim: true, maxlength: 80, index: true },
  tags: [{ type: String, trim: true, maxlength: 32 }],
  pinned: { type: Boolean, default: false },
  favorite: { type: Boolean, default: false },
  links: [{ type: String, trim: true }]
}, { timestamps: true });

noteSchema.index({ title: 'text', content: 'text', tags: 'text', folder: 'text' });
noteSchema.index({ user: 1, pinned: -1, updatedAt: -1 });
noteSchema.index({ user: 1, folder: 1, updatedAt: -1 });
export default mongoose.model('Note', noteSchema);
