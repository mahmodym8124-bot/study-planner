import { Router } from 'express';
import { getGraphNodes, getGraphNode } from '../controllers/graphController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(asyncHandler(protect));

router.get('/nodes', asyncHandler(getGraphNodes));
router.get('/nodes/:id', asyncHandler(getGraphNode));

export default router;
