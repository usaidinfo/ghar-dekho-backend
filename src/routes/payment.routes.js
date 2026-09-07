import { Router } from 'express';
import { body } from 'express-validator';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  createMembershipPaymentOrder,
  getPaymentConfig,
  payuReturnBridge,
  verifyMembershipPaymentOrder,
} from '../controllers/payment.controller.js';

const router = Router();

function flattenPayUVerifyBody(req, _res, next) {
  const bodyData = req.body && typeof req.body === 'object' ? req.body : {};
  const nested = bodyData.payu || bodyData.payuResponse || bodyData.response || {};
  req.body = {
    ...bodyData,
    paymentId: bodyData.paymentId || nested.paymentId || nested.udf1,
    txnid: bodyData.txnid || nested.txnid,
    mihpayid: bodyData.mihpayid || nested.mihpayid,
    status: bodyData.status || nested.status,
    hash: bodyData.hash || nested.hash,
    amount: bodyData.amount ?? nested.amount,
    productinfo: bodyData.productinfo || nested.productinfo,
    firstname: bodyData.firstname || nested.firstname,
    email: bodyData.email || nested.email,
    udf1: bodyData.udf1 || nested.udf1,
    udf2: bodyData.udf2 || nested.udf2,
    udf3: bodyData.udf3 || nested.udf3,
    udf4: bodyData.udf4 || nested.udf4,
    udf5: bodyData.udf5 || nested.udf5,
  };
  next();
}

// GET /api/payments/config
router.get('/config', getPaymentConfig);

// PayU return URLs (no auth — called by PayU / WebView)
router.all('/payu/success', payuReturnBridge);
router.all('/payu/failure', payuReturnBridge);

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
  flattenPayUVerifyBody,
  [
    body('paymentId').isString().notEmpty().withMessage('paymentId is required'),
    body('txnid').isString().notEmpty().withMessage('txnid is required'),
    body('status').isString().notEmpty().withMessage('status is required'),
    body('hash').isString().notEmpty().withMessage('hash is required'),
    body('amount').notEmpty().withMessage('amount is required'),
    body('mihpayid').optional({ nullable: true }).isString(),
    body('productinfo').optional({ nullable: true }).isString(),
    body('firstname').optional({ nullable: true }).isString(),
    body('email').optional({ nullable: true }).isString(),
    body('udf1').optional({ nullable: true }).isString(),
    body('udf2').optional({ nullable: true }).isString(),
    body('udf3').optional({ nullable: true }).isString(),
    body('udf4').optional({ nullable: true }).isString(),
    body('udf5').optional({ nullable: true }).isString(),
  ],
  validate,
  verifyMembershipPaymentOrder,
);

export default router;
