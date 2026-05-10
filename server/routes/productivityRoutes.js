import { Router } from 'express';
import { body } from 'express-validator';
import { getProductivity, saveProductivity } from '../controllers/productivityController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));
router.get('/', asyncHandler(getProductivity));
router.put('/', [
  body('todos').optional().isArray({ max: 100 }),
  body('todos.*.id').optional().isString().isLength({ max: 80 }),
  body('todos.*.text').optional().trim().isLength({ min: 1, max: 240 }),
  body('todos.*.done').optional().isBoolean().toBoolean(),
  body('reminders').optional().isArray({ max: 100 }),
  body('reminders.*.id').optional().isString().isLength({ max: 80 }),
  body('reminders.*.text').optional().trim().isLength({ min: 1, max: 240 }),
  body('reminders.*.dueAt').optional({ nullable: true }).isISO8601().toDate(),
  body('reminders.*.done').optional().isBoolean().toBoolean(),
  body('focus').optional().isString().isLength({ max: 2000 }),
  body('pomodoro.work').optional().isInt({ min: 5, max: 120 }).toInt(),
  body('pomodoro.break').optional().isInt({ min: 1, max: 60 }).toInt()
], validate, asyncHandler(saveProductivity));
export default router;
