import { Router } from 'express';
import { param } from 'express-validator';
import { deleteFile, listFiles, streamFile, uploadFile } from '../controllers/fileController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));
router.get('/', asyncHandler(listFiles));
router.post('/', upload.single('file'), asyncHandler(uploadFile));
router.get('/:id/content', [param('id').isMongoId()], validate, asyncHandler(streamFile));
router.delete('/:id', [param('id').isMongoId()], validate, asyncHandler(deleteFile));
export default router;
