import mongoose from 'mongoose';

const fileAssetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  originalName: { type: String, required: true, trim: true },
  filename: { type: String, required: true },
  storageProvider: { type: String, enum: ['local', 'gridfs'], default: 'local', index: true },
  gridFsId: { type: mongoose.Schema.Types.ObjectId },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  folder: { type: String, default: 'Uploads', trim: true, index: true },
  tags: [{ type: String, trim: true, maxlength: 32 }],
  url: { type: String, required: true }
}, { timestamps: true });

fileAssetSchema.index({ originalName: 'text', tags: 'text', folder: 'text', mimeType: 'text' });
fileAssetSchema.index({ user: 1, updatedAt: -1 });
fileAssetSchema.index({ user: 1, folder: 1, updatedAt: -1 });
fileAssetSchema.index({ user: 1, gridFsId: 1 });
export default mongoose.model('FileAsset', fileAssetSchema);
