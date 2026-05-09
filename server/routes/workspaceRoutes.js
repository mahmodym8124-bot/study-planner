import { Router } from 'express';
import { query } from 'express-validator';
import { activity, search, stats } from '../controllers/workspaceController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(protect);
router.get('/stats', stats);
router.get('/activity', activity);
router.get('/search', [query('q').optional().trim().isLength({ max: 120 })], validate, search);
export default router;
