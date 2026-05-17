import { Router } from 'express';
import { query } from 'express-validator';
import { activity, search, stats, updateSettings, getSettings } from '../controllers/workspaceController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));
router.get('/stats', asyncHandler(stats));
router.get('/activity', asyncHandler(activity));
router.put('/settings', asyncHandler(updateSettings));
router.get('/settings', asyncHandler(getSettings));
router.get('/search', [query('q').optional().trim().isLength({ max: 120 })], validate, asyncHandler(search));
export default router;
