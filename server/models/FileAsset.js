import mongoose from 'mongoose';

const fileAssetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true, trim: true },
  filename: { type: String, required: true },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  folder: { type: String, default: 'Uploads', trim: true, index: true },
  tags: [{ type: String, trim: true, maxlength: 32 }],
  url: { type: String, required: true }
}, { timestamps: true });

fileAssetSchema.index({ originalName: 'text', tags: 'text', folder: 'text', mimeType: 'text' });
export default mongoose.model('FileAsset', fileAssetSchema);
