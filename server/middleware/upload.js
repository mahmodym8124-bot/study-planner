import path from 'path';
import fs from 'fs';
import os from 'os';
import crypto from 'crypto';
import multer from 'multer';

export const uploadDir = process.env.VERCEL
  ? path.join(os.tmpdir(), 'mindvault-uploads')
  : path.resolve('uploads');
export const useMemoryUploads = process.env.VERCEL || process.env.FILE_STORAGE === 'gridfs';

fs.mkdirSync(uploadDir, { recursive: true });
const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/zip','application/x-zip-compressed','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const diskStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => cb(null, makeSafeFilename(file.originalname))
});
const storage = useMemoryUploads ? multer.memoryStorage() : diskStorage;

export function makeSafeFilename(name) {
  const cleaned = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return `${Date.now()}-${crypto.randomUUID()}-${cleaned.slice(-120) || 'upload'}`;
}

export const upload = multer({
  storage,
  limits: {
    fileSize: Number(process.env.MAX_FILE_SIZE || 15 * 1024 * 1024),
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    const accepted = allowed.has(file.mimetype);
    cb(accepted ? null : new Error('Unsupported file type'), accepted);
  }
});
