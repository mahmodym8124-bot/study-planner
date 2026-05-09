import { Router } from 'express';
import { body, param } from 'express-validator';
import { createIdea, deleteIdea, listIdeas, updateIdea } from '../controllers/ideaController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));
router.get('/', asyncHandler(listIdeas));
router.post('/', [body('title').trim().isLength({ min: 1, max: 180 }), body('status').optional().isIn(['Backlog','Active','Review','Done'])], validate, asyncHandler(createIdea));
router.put('/:id', [param('id').isMongoId(), body('status').optional().isIn(['Backlog','Active','Review','Done'])], validate, asyncHandler(updateIdea));
router.delete('/:id', [param('id').isMongoId()], validate, asyncHandler(deleteIdea));
export default router;
