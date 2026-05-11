import mongoose from 'mongoose';

const fileAssetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true, trim: true, maxlength: 255 },
  folder: { type: String, default: 'Files', trim: true, maxlength: 80, index: true },
  tags: [{ type: String, trim: true, maxlength: 32 }],
  mimeType: { type: String, default: 'application/octet-stream', trim: true, maxlength: 128 },
  size: { type: Number, default: 0, min: 0 },
  storageKey: { type: String, trim: true, maxlength: 512 }
}, { timestamps: true });

fileAssetSchema.index({ user: 1, updatedAt: -1 });
export default mongoose.model('FileAsset', fileAssetSchema);
