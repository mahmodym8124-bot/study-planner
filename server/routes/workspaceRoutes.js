import { Router } from 'express';
import { body, query } from 'express-validator';
import { activity, search, stats, updateSettings, getSettings, resetWorkspace } from '../controllers/workspaceController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));
router.get('/stats', asyncHandler(stats));
router.get('/activity', asyncHandler(activity));
router.delete('/reset', asyncHandler(resetWorkspace));
router.put('/settings', [
  body('defaultFocusTime').optional().isInt({ min: 5, max: 120 }).toInt(),
  body('theme').optional().isIn(['dark', 'light'])
], validate, asyncHandler(updateSettings));
router.get('/settings', asyncHandler(getSettings));
router.get('/search', [query('q').optional().trim().isLength({ max: 120 })], validate, asyncHandler(search));
export default router;
