import crypto from 'crypto';
import Razorpay from 'razorpay';
import prisma from '../config/database.js';
import {
  activateMembership,
  findPlanByAccountAndTier,
  loadUserMembershipContext,
  upgradeMembership,
} from './membership.service.js';

const VALID_ACCOUNT_TYPES = new Set(['OWNER', 'BROKER', 'BUILDER']);
const VALID_PLAN_TIERS = new Set(['BASIC', 'MEDIUM', 'PREMIUM']);
const VALID_MODES = new Set(['activate', 'renew', 'upgrade']);
const TIER_RANK = { BASIC: 1, MEDIUM: 2, PREMIUM: 3 };

export function isRazorpayConfigured() {
  return Boolean(
    String(process.env.RAZORPAY_KEY_ID || '').trim() &&
      String(process.env.RAZORPAY_KEY_SECRET || '').trim(),
  );
}

function getRazorpayClient() {
  if (!isRazorpayConfigured()) {
    const err = new Error('Razorpay is not configured on the server.');
    err.status = 503;
    err.code = 'RAZORPAY_NOT_CONFIGURED';
    throw err;
  }

  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID.trim(),
    key_secret: process.env.RAZORPAY_KEY_SECRET.trim(),
  });
}

function toPaise(amountInr) {
  const paise = Math.round(Number(amountInr) * 100);
  if (!Number.isFinite(paise) || paise < 100) {
    const err = new Error('Plan price must be at least ₹1.');
    err.status = 400;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  return paise;
}

async function resolveCheckoutPlan({ userId, mode, accountType, planTier }) {
  if (mode === 'activate') {
    if (!VALID_ACCOUNT_TYPES.has(accountType) || !VALID_PLAN_TIERS.has(planTier)) {
      const err = new Error('Valid accountType and planTier are required.');
      err.status = 400;
      err.code = 'INVALID_PLAN';
      throw err;
    }
    const plan = await findPlanByAccountAndTier(accountType, planTier);
    if (!plan) {
      const err = new Error(`No plan found for ${accountType} / ${planTier}.`);
      err.status = 404;
      err.code = 'PLAN_NOT_FOUND';
      throw err;
    }
    return { plan, accountType, planTier, mode };
  }

  const ctx = await loadUserMembershipContext(userId);
  const current = ctx?.user?.membershipPlan;

  if (mode === 'renew') {
    if (!current?.accountType || !current?.planTier) {
      const err = new Error('No active plan to renew. Choose a plan first.');
      err.status = 400;
      err.code = 'NO_CURRENT_PLAN';
      throw err;
    }
    return {
      plan: current,
      accountType: current.accountType,
      planTier: current.planTier,
      mode,
    };
  }

  // upgrade
  if (!ctx?.active) {
    const err = new Error('Active membership required before upgrading.');
    err.status = 402;
    err.code = 'MEMBERSHIP_REQUIRED';
    throw err;
  }
  if (!current?.accountType || !current?.planTier) {
    const err = new Error('No current plan found to upgrade from.');
    err.status = 400;
    err.code = 'NO_CURRENT_PLAN';
    throw err;
  }
  if (!VALID_PLAN_TIERS.has(planTier)) {
    const err = new Error('planTier must be BASIC, MEDIUM, or PREMIUM.');
    err.status = 400;
    err.code = 'INVALID_TIER';
    throw err;
  }

  const currentRank = TIER_RANK[current.planTier] ?? 0;
  const nextRank = TIER_RANK[planTier] ?? 0;
  if (nextRank <= currentRank) {
    const err = new Error(
      `Choose a higher plan than ${current.planTier}. Downgrades are not available here.`,
    );
    err.status = 400;
    err.code = 'UPGRADE_ONLY';
    err.meta = { currentTier: current.planTier, requestedTier: planTier };
    throw err;
  }

  const plan = await findPlanByAccountAndTier(current.accountType, planTier);
  if (!plan) {
    const err = new Error(`No plan found for ${current.accountType} / ${planTier}.`);
    err.status = 404;
    err.code = 'PLAN_NOT_FOUND';
    throw err;
  }

  return {
    plan,
    accountType: current.accountType,
    planTier,
    mode,
  };
}

/**
 * Create a Razorpay order + PaymentTransaction for membership checkout.
 */
export async function createMembershipOrder({
  userId,
  mode: rawMode,
  accountType: rawAccountType,
  planTier: rawPlanTier,
}) {
  const mode = String(rawMode || '').toLowerCase();
  if (!VALID_MODES.has(mode)) {
    const err = new Error('mode must be activate, renew, or upgrade.');
    err.status = 400;
    err.code = 'INVALID_MODE';
    throw err;
  }

  const accountType = rawAccountType ? String(rawAccountType).toUpperCase() : null;
  const planTier = rawPlanTier ? String(rawPlanTier).toUpperCase() : null;

  const resolved = await resolveCheckoutPlan({
    userId,
    mode,
    accountType,
    planTier,
  });

  const amountPaise = toPaise(resolved.plan.price);
  const razorpay = getRazorpayClient();

  const payment = await prisma.paymentTransaction.create({
    data: {
      userId,
      provider: 'RAZORPAY',
      purpose: 'MEMBERSHIP',
      status: 'CREATED',
      amount: resolved.plan.price,
      currency: resolved.plan.currency || 'INR',
      metadata: {
        mode: resolved.mode,
        accountType: resolved.accountType,
        planTier: resolved.planTier,
        planId: resolved.plan.id,
        planName: resolved.plan.name,
      },
    },
  });

  try {
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: resolved.plan.currency || 'INR',
      receipt: payment.id.replace(/-/g, '').slice(0, 40),
      notes: {
        paymentId: payment.id,
        userId,
        mode: resolved.mode,
        accountType: resolved.accountType,
        planTier: resolved.planTier,
        planId: resolved.plan.id,
      },
    });

    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        providerOrderId: order.id,
        metadata: {
          mode: resolved.mode,
          accountType: resolved.accountType,
          planTier: resolved.planTier,
          planId: resolved.plan.id,
          planName: resolved.plan.name,
          razorpayOrder: {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
          },
        },
      },
    });

    return {
      paymentId: payment.id,
      orderId: order.id,
      amount: amountPaise,
      currency: order.currency || 'INR',
      keyId: process.env.RAZORPAY_KEY_ID.trim(),
      planName: resolved.plan.name,
      planDays: resolved.plan.duration,
      priceInr: resolved.plan.price,
      mode: resolved.mode,
      accountType: resolved.accountType,
      planTier: resolved.planTier,
    };
  } catch (err) {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        metadata: {
          mode: resolved.mode,
          accountType: resolved.accountType,
          planTier: resolved.planTier,
          planId: resolved.plan.id,
          planName: resolved.plan.name,
          error: err?.message || 'Order creation failed',
        },
      },
    });
    throw err;
  }
}

function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET.trim();
  const payload = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ''));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    const err = new Error('Invalid payment signature.');
    err.status = 400;
    err.code = 'INVALID_SIGNATURE';
    throw err;
  }
}

/**
 * Verify Razorpay payment and activate / renew / upgrade membership.
 */
export async function verifyMembershipPayment({
  userId,
  paymentId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
}) {
  if (!isRazorpayConfigured()) {
    const err = new Error('Razorpay is not configured on the server.');
    err.status = 503;
    err.code = 'RAZORPAY_NOT_CONFIGURED';
    throw err;
  }

  if (!paymentId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    const err = new Error('Missing payment verification fields.');
    err.status = 400;
    err.code = 'MISSING_FIELDS';
    throw err;
  }

  const payment = await prisma.paymentTransaction.findUnique({
    where: { id: paymentId },
  });

  if (!payment || payment.userId !== userId) {
    const err = new Error('Payment not found.');
    err.status = 404;
    err.code = 'PAYMENT_NOT_FOUND';
    throw err;
  }

  if (payment.status === 'CAPTURED' && payment.providerPaymentId === razorpayPaymentId) {
    const ctx = await loadUserMembershipContext(userId);
    return {
      alreadyProcessed: true,
      membership: ctx,
      payment,
    };
  }

  if (payment.providerOrderId && payment.providerOrderId !== razorpayOrderId) {
    const err = new Error('Order id does not match this payment.');
    err.status = 400;
    err.code = 'ORDER_MISMATCH';
    throw err;
  }

  verifyRazorpaySignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  const meta = payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
  const mode = String(meta.mode || 'activate').toLowerCase();
  const accountType = String(meta.accountType || '').toUpperCase();
  const planTier = String(meta.planTier || '').toUpperCase();

  let activation;
  if (mode === 'upgrade') {
    activation = await upgradeMembership({
      userId,
      planTier,
      source: 'RAZORPAY',
      paymentId: payment.id,
    });
  } else {
    // activate + renew both create a fresh period on the resolved plan
    activation = await activateMembership({
      userId,
      accountType,
      planTier,
      source: mode === 'renew' ? 'RAZORPAY_RENEW' : 'RAZORPAY',
      paymentId: payment.id,
    });
  }

  const updatedPayment = await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      status: 'CAPTURED',
      providerOrderId: razorpayOrderId,
      providerPaymentId: razorpayPaymentId,
      providerSignature: razorpaySignature,
      metadata: {
        ...meta,
        verifiedAt: new Date().toISOString(),
        subscriptionId: activation.subscription.id,
      },
    },
  });

  const ctx = await loadUserMembershipContext(userId);
  return {
    alreadyProcessed: false,
    membership: ctx,
    payment: updatedPayment,
    subscriptionId: activation.subscription.id,
  };
}
