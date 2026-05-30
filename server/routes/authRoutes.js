import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { googleCallback, googleLogin, googleOAuthCallback, googleOAuthStart, googleOneTap, login, me, register, refreshToken, requestPasswordReset, resetPassword, verifyEmail } from '../controllers/authController.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createRateLimiter } from '../middleware/security.js';

const router = Router();
export const forgotPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  event: 'rate_limit_forgot_password',
  message: { error: 'Too many attempts. Try again in 15 minutes.' }
});

const resetPasswordValidators = [
  body('token').isString().isLength({ min: 64, max: 64 }).isHexadecimal(),
  body('password')
    .isString()
    .isLength({ min: 8 })
    .isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })
    .withMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol')
];

const passwordValidator = body('password')
  .isString()
  .isStrongPassword({ minLength: 8, minLowercase: 1, minUppercase: 1, minNumbers: 1, minSymbols: 1 })
  .withMessage('Password must be at least 8 characters and include uppercase, lowercase, number, and symbol');

function validateResetPassword(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ message: 'Validation failed', errors: errors.array({ onlyFirstError: true }) });
  next();
}

router.post('/register', [body('name').trim().isLength({ min: 2, max: 80 }), body('email').isEmail().normalizeEmail(), passwordValidator], validate, asyncHandler(register));
router.post('/login', [body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 8 })], validate, asyncHandler(login));
router.get('/google', asyncHandler(googleOAuthStart));
router.post('/google', [body('credential').isString().isLength({ min: 20, max: 4096 })], validate, asyncHandler(googleLogin));
router.post('/google/onetap', [body('credential').isString().isLength({ min: 20, max: 4096 })], validate, asyncHandler(googleOneTap));
router.get('/google/callback', asyncHandler(googleOAuthCallback));
router.post('/google/callback', [body('credential').isString().isLength({ min: 20, max: 4096 })], validate, asyncHandler(googleCallback));
router.post('/verify-email', [body('token').isString().isLength({ min: 64, max: 64 }).isHexadecimal()], validate, asyncHandler(verifyEmail));
router.post('/forgot-password', forgotPasswordLimiter, [body('email').isEmail().normalizeEmail()], validate, asyncHandler(requestPasswordReset));
router.post('/reset-password', resetPasswordValidators, validateResetPassword, asyncHandler(resetPassword));
router.post('/refresh-token', asyncHandler(protect), asyncHandler(refreshToken));
router.get('/me', asyncHandler(protect), me);
export default router;
