import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import mongoose from 'mongoose';
import FileAsset from '../models/FileAsset.js';
import { makeSafeFilename, uploadDir, useMemoryUploads } from '../middleware/upload.js';
import { recordActivity } from '../utils/activity.js';

function gridFsBucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'mindvaultFiles' });
}

function uploadToGridFs(file, filename, userId) {
  return new Promise((resolve, reject) => {
    const uploadStream = gridFsBucket().openUploadStream(filename, {
      contentType: file.mimetype,
      metadata: { user: userId, originalName: file.originalname }
    });

    Readable.from(file.buffer).pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve(uploadStream.id));
  });
}

function toObjectId(value) {
  return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);
}

export async function listFiles(req, res) {
  const files = await FileAsset.find({ user: req.user._id }).sort({ updatedAt: -1 }).lean();
  res.json({ files });
}
export async function uploadFile(req, res) {
  if (!req.file) return res.status(400).json({ message: 'File is required' });
  const tags = String(req.body.tags || '').split(',').map((tag) => tag.trim().slice(0, 32)).filter(Boolean).slice(0, 20);
  const folder = String(req.body.folder || 'Uploads').trim().slice(0, 80) || 'Uploads';
  const storageProvider = useMemoryUploads ? 'gridfs' : 'local';
  const filename = req.file.filename || makeSafeFilename(req.file.originalname);
  const file = new FileAsset({
    user: req.user._id,
    originalName: req.file.originalname,
    filename,
    storageProvider,
    mimeType: req.file.mimetype,
    size: req.file.size,
    folder,
    tags
  });
  file.url = `/api/files/${file._id}/content`;
  try {
    if (storageProvider === 'gridfs') file.gridFsId = await uploadToGridFs(req.file, filename, req.user._id);
    await file.save();
    await recordActivity(req.user._id, 'Uploaded file', file.originalName, 'file', file._id);
    res.status(201).json({ file });
  } catch (error) {
    if (storageProvider === 'gridfs' && file.gridFsId) {
      await gridFsBucket().delete(toObjectId(file.gridFsId)).catch(() => {});
    } else if (req.file.path) {
      await fsp.rm(req.file.path, { force: true }).catch(() => {});
    }
    throw error;
  }
}
export async function deleteFile(req, res) {
  const file = await FileAsset.findOneAndDelete({ _id: req.params.id, user: req.user._id }).lean();
  if (!file) return res.status(404).json({ message: 'File not found' });
  if (file.storageProvider === 'gridfs' && file.gridFsId) {
    await gridFsBucket().delete(toObjectId(file.gridFsId)).catch(() => {});
  } else {
    await fsp.rm(path.resolve(uploadDir, file.filename), { force: true });
  }
  await recordActivity(req.user._id, 'Deleted file', file.originalName, 'file', file._id);
  res.json({ ok: true });
}

export async function streamFile(req, res) {
  const file = await FileAsset.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!file) return res.status(404).json({ message: 'File not found' });

  if (file.storageProvider === 'gridfs') {
    if (!file.gridFsId) return res.status(404).json({ message: 'File content not found' });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Length', file.size);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    const download = gridFsBucket().openDownloadStream(toObjectId(file.gridFsId));
    download.on('error', (error) => {
      if (!res.headersSent) res.status(404).json({ message: 'File not found on storage' });
      else res.destroy(error);
    });
    return download.pipe(res);
  }

  const filePath = path.resolve(uploadDir, file.filename);
  const safeUploadDir = path.resolve(uploadDir);
  if (!filePath.startsWith(`${safeUploadDir}${path.sep}`)) return res.status(400).json({ message: 'Invalid file path' });

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
