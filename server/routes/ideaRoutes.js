import { Router } from 'express';
import { body, param } from 'express-validator';
import { createIdea, deleteIdea, listIdeas, updateIdea } from '../controllers/ideaController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(protect);
router.get('/', listIdeas);
router.post('/', [body('title').trim().isLength({ min: 1, max: 180 }), body('status').optional().isIn(['Backlog','Active','Review','Done'])], validate, createIdea);
router.put('/:id', [param('id').isMongoId(), body('status').optional().isIn(['Backlog','Active','Review','Done'])], validate, updateIdea);
router.delete('/:id', [param('id').isMongoId()], validate, deleteIdea);
export default router;
