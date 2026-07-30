import { Router } from 'express';
import { body } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createMembershipPaymentOrder,
  getPaymentConfig,
  verifyMembershipPaymentOrder,
} from '../controllers/payment.controller.js';

const router = Router();

// GET /api/payments/config
router.get('/config', getPaymentConfig);

// POST /api/payments/membership/create-order
router.post(
  '/membership/create-order',
  protect,
  [
    body('mode')
      .isIn(['activate', 'renew', 'upgrade'])
      .withMessage('mode must be activate, renew, or upgrade'),
    body('accountType')
      .optional()
      .isIn(['OWNER', 'BROKER', 'BUILDER'])
      .withMessage('accountType must be OWNER, BROKER, or BUILDER'),
    body('planTier')
      .optional()
      .isIn(['BASIC', 'MEDIUM', 'PREMIUM'])
      .withMessage('planTier must be BASIC, MEDIUM, or PREMIUM'),
  ],
  validate,
  createMembershipPaymentOrder,
);

// POST /api/payments/membership/verify
router.post(
  '/membership/verify',
  protect,
  [
    body('paymentId').isString().notEmpty().withMessage('paymentId is required'),
    body('razorpay_order_id')
      .optional()
      .isString()
      .notEmpty()
      .withMessage('razorpay_order_id is required'),
    body('razorpayOrderId').optional().isString().notEmpty(),
    body('razorpay_payment_id').optional().isString().notEmpty(),
    body('razorpayPaymentId').optional().isString().notEmpty(),
    body('razorpay_signature').optional().isString().notEmpty(),
    body('razorpaySignature').optional().isString().notEmpty(),
  ],
  validate,
  verifyMembershipPaymentOrder,
);

export default router;
