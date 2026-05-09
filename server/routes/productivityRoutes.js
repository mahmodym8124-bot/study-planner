import { Router } from 'express';
import { getProductivity, saveProductivity } from '../controllers/productivityController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(asyncHandler(protect));
router.get('/', asyncHandler(getProductivity));
router.put('/', asyncHandler(saveProductivity));
export default router;
