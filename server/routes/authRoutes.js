import { Router } from 'express';
import { body } from 'express-validator';
import { login, me, register, refreshToken } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.post('/register', [body('name').trim().isLength({ min: 2, max: 80 }), body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 8 })], validate, asyncHandler(register));
router.post('/login', [body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 8 })], validate, asyncHandler(login));
router.post('/refresh-token', asyncHandler(protect), asyncHandler(refreshToken));
router.get('/me', asyncHandler(protect), me);
export default router;
