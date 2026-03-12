import { Router } from 'express';
import { body } from 'express-validator';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { uploadImage } from '../middleware/upload.js';
import {
  getMe,
  updateProfile,
  uploadProfileImage,
  getUserById,
  updateProfileType,
  getRecentlyViewed,
  getNotifications,
  markNotificationsRead,
} from '../controllers/user.controller.js';

const router = Router();

// GET  /api/users/me
router.get('/me', protect, getMe);

// PUT  /api/users/me
router.put(
  '/me',
  protect,
  [
    body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
    body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
    body('bio').optional().isLength({ max: 500 }).withMessage('Bio max 500 characters'),
  ],
  validate,
  updateProfile
);

// POST /api/users/me/profile-image
router.post(
  '/me/profile-image',
  protect,
  uploadImage.single('image'),
  uploadProfileImage
);

// PUT  /api/users/me/profile-type
router.put(
  '/me/profile-type',
  protect,
  [body('profileType').isIn(['OWNER', 'AGENT', 'BROKER', 'BUYER', 'RENTER']).withMessage('Invalid profile type')],
  validate,
  updateProfileType
);

// GET  /api/users/me/recently-viewed
router.get('/me/recently-viewed', protect, getRecentlyViewed);

// GET  /api/users/me/notifications
router.get('/me/notifications', protect, getNotifications);

// PUT  /api/users/me/notifications/read
router.put('/me/notifications/read', protect, markNotificationsRead);

// GET  /api/users/:id  (public profile)
router.get('/:id', getUserById);

export default router;

