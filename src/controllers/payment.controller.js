import { success, error } from '../utils/response.js';
import { formatMembershipPayload } from '../services/membership.service.js';
import {
  createMembershipOrder,
  isRazorpayConfigured,
  verifyMembershipPayment,
} from '../services/payment.service.js';

function sendServiceError(res, err, fallback) {
  const status = err.status || 500;
  return res
    .status(status)
    .json(error(err.message || fallback, err.meta ?? null, err.code || 'SERVER_ERROR'));
}

/** GET /api/payments/config — public key only (safe for clients) */
export const getPaymentConfig = async (_req, res) => {
  try {
    const configured = isRazorpayConfigured();
    return res.json(
      success({
        configured,
        keyId: configured ? process.env.RAZORPAY_KEY_ID.trim() : null,
        provider: 'RAZORPAY',
        mode: String(process.env.RAZORPAY_KEY_ID || '').startsWith('rzp_live_')
          ? 'live'
          : 'test',
      }),
    );
  } catch (err) {
    console.error('getPaymentConfig error:', err);
    return res.status(500).json(error('Failed to load payment config.'));
  }
};

/** POST /api/payments/membership/create-order */
export const createMembershipPaymentOrder = async (req, res) => {
  try {
    const data = await createMembershipOrder({
      userId: req.user.id,
      mode: req.body.mode,
      accountType: req.body.accountType,
      planTier: req.body.planTier,
    });
    return res.status(201).json(success(data, 'Payment order created.'));
  } catch (err) {
    console.error('createMembershipPaymentOrder error:', err);
    return sendServiceError(res, err, 'Failed to create payment order.');
  }
};

/** POST /api/payments/membership/verify */
export const verifyMembershipPaymentOrder = async (req, res) => {
  try {
    const result = await verifyMembershipPayment({
      userId: req.user.id,
      paymentId: req.body.paymentId,
      razorpayOrderId: req.body.razorpay_order_id || req.body.razorpayOrderId,
      razorpayPaymentId: req.body.razorpay_payment_id || req.body.razorpayPaymentId,
      razorpaySignature: req.body.razorpay_signature || req.body.razorpaySignature,
    });

    return res.json(
      success(
        {
          ...formatMembershipPayload(result.membership),
          subscriptionId: result.subscriptionId ?? null,
          paymentId: result.payment.id,
          alreadyProcessed: result.alreadyProcessed,
        },
        result.alreadyProcessed
          ? 'Payment already verified.'
          : 'Payment verified. Membership activated.',
      ),
    );
  } catch (err) {
    console.error('verifyMembershipPaymentOrder error:', err);
    return sendServiceError(res, err, 'Failed to verify payment.');
  }
};
