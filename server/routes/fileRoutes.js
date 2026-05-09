import { Router } from 'express';
import { param } from 'express-validator';
import { deleteFile, listFiles, uploadFile } from '../controllers/fileController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(protect);
router.get('/', listFiles);
router.post('/', upload.single('file'), uploadFile);
router.delete('/:id', [param('id').isMongoId()], validate, deleteFile);
export default router;
