import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { authLimiter, otpLimiter } from '../middleware/rateLimiter.js';
import {
  sendOTP,
  register,
  loginWithPassword,
  loginWithOTP,
  refreshAccessToken,
  logout,
  changePassword,
  forgotPassword,
  resetPassword,
} from '../controllers/auth.controller.js';

const router = Router();

// POST /api/auth/send-otp
router.post(
  '/send-otp',
  otpLimiter,
  [
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone required'),
    body('type').optional().isIn(['EMAIL_VERIFICATION', 'PHONE_VERIFICATION', 'LOGIN', 'PASSWORD_RESET']),
  ],
  validate,
  sendOTP
);

// POST /api/auth/register
router.post(
  '/register',
  authLimiter,
  [
    body('firstName').trim().notEmpty().withMessage('First name required'),
    body('lastName').trim().notEmpty().withMessage('Last name required'),
    body('otp').notEmpty().withMessage('OTP is required'),
    body('email').optional().isEmail().withMessage('Valid email required'),
    body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
    body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('profileType').optional().isIn(['OWNER', 'AGENT', 'BROKER', 'BUYER', 'RENTER']),
  ],
  validate,
  register
);

// POST /api/auth/login
router.post(
  '/login',
  authLimiter,
  [
    body('password').notEmpty().withMessage('Password required'),
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone(),
  ],
  validate,
  loginWithPassword
);

// POST /api/auth/login-otp
router.post(
  '/login-otp',
  authLimiter,
  [
    body('otp').notEmpty().withMessage('OTP required'),
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone(),
  ],
  validate,
  loginWithOTP
);

// POST /api/auth/refresh-token
router.post(
  '/refresh-token',
  [body('refreshToken').notEmpty().withMessage('Refresh token required')],
  validate,
  refreshAccessToken
);

// POST /api/auth/logout  (protected)
router.post('/logout', protect, logout);

// PUT /api/auth/change-password  (protected)
router.put(
  '/change-password',
  protect,
  [
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ],
  validate,
  changePassword
);

// POST /api/auth/forgot-password
router.post(
  '/forgot-password',
  [
    body('email').optional().isEmail(),
    body('phone').optional().isMobilePhone(),
  ],
  validate,
  forgotPassword
);

// POST /api/auth/reset-password
router.post(
  '/reset-password',
  [
    body('otp').notEmpty().withMessage('OTP required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ],
  validate,
  resetPassword
);

export default router;

