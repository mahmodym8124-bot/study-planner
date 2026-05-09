import { Router } from 'express';
import { body, param } from 'express-validator';
import { createNote, deleteNote, listNotes, updateNote } from '../controllers/noteController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));
router.get('/', asyncHandler(listNotes));
router.post('/', [body('title').trim().isLength({ min: 1, max: 180 }), body('content').optional().isString(), body('tags').optional().isArray()], validate, asyncHandler(createNote));
router.put('/:id', [param('id').isMongoId(), body('title').optional().trim().isLength({ min: 1, max: 180 })], validate, asyncHandler(updateNote));
router.delete('/:id', [param('id').isMongoId()], validate, asyncHandler(deleteNote));
export default router;
