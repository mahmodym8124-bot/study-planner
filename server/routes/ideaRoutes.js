import { Router } from 'express';
import { body, param } from 'express-validator';
import { createIdea, deleteIdea, listIdeas, updateIdea } from '../controllers/ideaController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const IDEA_STATUSES = ['backlog', 'active', 'review', 'completed'];
const IDEA_PRIORITIES = ['low', 'medium', 'high', 'critical'];

function normalizeIdeaStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return status === 'done' ? 'completed' : status;
}

function normalizeIdeaPriority(value) {
  return String(value || '').trim().toLowerCase();
}

router.use(asyncHandler(protect));
router.get('/', asyncHandler(listIdeas));
router.post('/', [
  body('title').trim().isLength({ min: 1, max: 180 }),
  body('description').optional().isString().isLength({ max: 12000 }),
  body('category').optional().trim().isLength({ min: 1, max: 80 }),
  body('status').optional().customSanitizer(normalizeIdeaStatus).isIn(IDEA_STATUSES),
  body('priority').optional().customSanitizer(normalizeIdeaPriority).isIn(IDEA_PRIORITIES),
  body('progress').optional().isInt({ min: 0, max: 100 }).toInt(),
  body('tags').optional().isArray({ max: 20 }),
  body('tags.*').optional().trim().isLength({ min: 1, max: 32 })
], validate, asyncHandler(createIdea));
router.put('/:id', [
  param('id').isMongoId(),
  body('title').optional().trim().isLength({ min: 1, max: 180 }),
  body('description').optional().isString().isLength({ max: 12000 }),
  body('category').optional().trim().isLength({ min: 1, max: 80 }),
  body('status').optional().customSanitizer(normalizeIdeaStatus).isIn(IDEA_STATUSES),
  body('priority').optional().customSanitizer(normalizeIdeaPriority).isIn(IDEA_PRIORITIES),
  body('progress').optional().isInt({ min: 0, max: 100 }).toInt(),
  body('tags').optional().isArray({ max: 20 }),
  body('tags.*').optional().trim().isLength({ min: 1, max: 32 })
], validate, asyncHandler(updateIdea));
router.delete('/:id', [param('id').isMongoId()], validate, asyncHandler(deleteIdea));
export default router;
