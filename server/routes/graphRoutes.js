import { Router } from 'express';
import { param } from 'express-validator';
import { getGraphNodes, getGraphNode } from '../controllers/graphController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));

router.get('/nodes', asyncHandler(getGraphNodes));
router.get('/nodes/:id', [
  param('id').matches(/^(note|idea)_[0-9a-fA-F]{24}$/)
], validate, asyncHandler(getGraphNode));

export default router;
