import { Router } from 'express';
import { body } from 'express-validator';
import {
  startFocusSession,
  getFocusSessions,
  updateFocusSession,
  getDailyFocus,
  saveDailyFocus,
  completeDailyFocus
} from '../controllers/focusController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(asyncHandler(protect));

// Focus sessions - support both current and legacy client paths
const startFocusValidators = [
  body('taskId').optional().isMongoId(),
  body('taskModel').optional().isIn(['Note', 'Idea']),
  body('taskName').optional().trim().isLength({ max: 256 }),
  body('workDurationMinutes').optional().isInt({ min: 5, max: 120 }).toInt(),
  body('breakDurationMinutes').optional().isInt({ min: 1, max: 60 }).toInt()
];

router.post('/start', startFocusValidators, validate, asyncHandler(startFocusSession));
router.post('/sessions', startFocusValidators, validate, asyncHandler(startFocusSession));

router.get('/', asyncHandler(getFocusSessions));
router.get('/sessions', asyncHandler(getFocusSessions));

const updateFocusValidators = [
  body('status').optional().isIn(['active', 'paused', 'completed', 'abandoned']),
  body('elapsedSeconds').optional().isInt({ min: 0 }).toInt(),
  body('currentPhase').optional().isIn(['work', 'break']),
  body('sessionsCompleted').optional().isInt({ min: 0 }).toInt()
];

router.put('/:id', updateFocusValidators, validate, asyncHandler(updateFocusSession));
router.put('/sessions/:id', updateFocusValidators, validate, asyncHandler(updateFocusSession));

// Daily focus
router.get('/daily-focus', asyncHandler(getDailyFocus));
router.get('/daily', asyncHandler(getDailyFocus));

const dailyFocusValidators = [
  body('focusStatement').optional().trim().isLength({ max: 2000 })
];

router.post('/daily-focus', dailyFocusValidators, validate, asyncHandler(saveDailyFocus));
router.post('/daily', dailyFocusValidators, validate, asyncHandler(saveDailyFocus));

router.post('/daily-focus/complete', asyncHandler(completeDailyFocus));
router.post('/daily/complete', asyncHandler(completeDailyFocus));

export default router;
