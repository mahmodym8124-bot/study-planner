import path from 'path';
import fs from 'fs';
import multer from 'multer';

const uploadDir = path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const allowed = new Set(['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/zip','application/x-zip-compressed','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
const storage = multer.diskStorage({ destination: uploadDir, filename: (_req, file, cb) => cb(null, `${Date.now()}-${cryptoSafe(file.originalname)}`) });
function cryptoSafe(name) { return name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120); }
export const upload = multer({ storage, limits: { fileSize: Number(process.env.MAX_FILE_SIZE || 15 * 1024 * 1024) }, fileFilter: (_req, file, cb) => cb(allowed.has(file.mimetype) ? null : new Error('Unsupported file type'), allowed.has(file.mimetype)) });
