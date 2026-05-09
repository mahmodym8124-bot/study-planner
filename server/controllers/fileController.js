import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import FileAsset from '../models/FileAsset.js';
import { recordActivity } from '../utils/activity.js';

export async function listFiles(req, res) {
  const files = await FileAsset.find({ user: req.user._id }).sort({ updatedAt: -1 });
  res.json({ files });
}
export async function uploadFile(req, res) {
  if (!req.file) return res.status(400).json({ message: 'File is required' });
  const tags = String(req.body.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
  const file = new FileAsset({ user: req.user._id, originalName: req.file.originalname, filename: req.file.filename, mimeType: req.file.mimetype, size: req.file.size, folder: req.body.folder || 'Uploads', tags });
  file.url = `/api/files/${file._id}/content`;
  await file.save();
  await recordActivity(req.user._id, 'Uploaded file', file.originalName, 'file', file._id);
  res.status(201).json({ file });
}
export async function deleteFile(req, res) {
  const file = await FileAsset.findOneAndDelete({ _id: req.params.id, user: req.user._id });
  if (!file) return res.status(404).json({ message: 'File not found' });
  await fsp.rm(path.resolve('uploads', file.filename), { force: true });
  await recordActivity(req.user._id, 'Deleted file', file.originalName, 'file', file._id);
  res.json({ ok: true });
}

export async function streamFile(req, res) {
  const file = await FileAsset.findOne({ _id: req.params.id, user: req.user._id });
  if (!file) return res.status(404).json({ message: 'File not found' });

  const uploadDir = path.resolve('uploads');
  const filePath = path.resolve(uploadDir, file.filename);
  if (!filePath.startsWith(`${uploadDir}${path.sep}`)) return res.status(400).json({ message: 'Invalid file path' });

  try {
    await fsp.access(filePath);
  } catch {
    return res.status(404).json({ message: 'File not found on disk' });
  }

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', file.size);
  res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
  return fs.createReadStream(filePath).pipe(res);
}
