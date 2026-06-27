import { Router } from 'express';
import { body } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  activateDemoMembership,
  getMembershipPlans,
  getMembershipStatus,
  renewDemoMembership,
} from '../controllers/membership.controller.js';

const router = Router();

// GET /api/membership/plans?accountType=OWNER
router.get('/plans', getMembershipPlans);

// GET /api/membership/status
router.get('/status', protect, getMembershipStatus);

// POST /api/membership/activate-demo
router.post(
  '/activate-demo',
  protect,
  [
    body('accountType')
      .isIn(['OWNER', 'BROKER', 'BUILDER'])
      .withMessage('accountType must be OWNER, BROKER, or BUILDER'),
    body('planTier')
      .isIn(['BASIC', 'MEDIUM', 'PREMIUM'])
      .withMessage('planTier must be BASIC, MEDIUM, or PREMIUM'),
  ],
  validate,
  activateDemoMembership,
);

// POST /api/membership/renew-demo
router.post('/renew-demo', protect, renewDemoMembership);

export default router;
