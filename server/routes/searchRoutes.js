import { Router } from 'express';
import { query } from 'express-validator';
import { search } from '../controllers/searchController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));

router.get('/', [
  query('q').trim().isLength({ min: 1, max: 256 }),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('skip').optional().isInt({ min: 0 }).toInt()
], validate, asyncHandler(search));

export default router;
