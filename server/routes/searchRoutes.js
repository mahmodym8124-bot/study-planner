import { Router } from 'express';
import { query } from 'express-validator';
import { search } from '../controllers/searchController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));

router.get('/', [
  query('q').optional({ checkFalsy: true }).trim().isLength({ max: 256 }),
  query('limit').optional().isInt({ min: 1 }).toInt(),
  query('skip').optional().toInt()
], validate, asyncHandler(search));

export default router;
