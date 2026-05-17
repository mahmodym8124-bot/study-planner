import { Router } from 'express';
import { body, param } from 'express-validator';
import { createIdea, deleteIdea, listIdeas, updateIdea } from '../controllers/ideaController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));
router.get('/', asyncHandler(listIdeas));
router.post('/', [
  body('title').trim().isLength({ min: 1, max: 180 }),
  body('description').optional().isString().isLength({ max: 12000 }),
  body('category').optional().trim().isLength({ min: 1, max: 80 }),
  body('status').optional().isIn(['backlog','active','review','completed']),
  body('priority').optional().isIn(['low','medium','high','critical']),
  body('progress').optional().isInt({ min: 0, max: 100 }).toInt(),
  body('tags').optional().isArray({ max: 20 }),
  body('tags.*').optional().trim().isLength({ min: 1, max: 32 })
], validate, asyncHandler(createIdea));
router.put('/:id', [
  param('id').isMongoId(),
  body('title').optional().trim().isLength({ min: 1, max: 180 }),
  body('description').optional().isString().isLength({ max: 12000 }),
  body('category').optional().trim().isLength({ min: 1, max: 80 }),
  body('status').optional().isIn(['backlog','active','review','completed']),
  body('priority').optional().isIn(['low','medium','high','critical']),
  body('progress').optional().isInt({ min: 0, max: 100 }).toInt(),
  body('tags').optional().isArray({ max: 20 }),
  body('tags.*').optional().trim().isLength({ min: 1, max: 32 })
], validate, asyncHandler(updateIdea));
router.delete('/:id', [param('id').isMongoId()], validate, asyncHandler(deleteIdea));
export default router;
