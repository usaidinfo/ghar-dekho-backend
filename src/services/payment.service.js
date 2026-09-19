import crypto from 'crypto';
import axios from 'axios';
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
const SUCCESS_STATUSES = new Set(['success', 'captured']);

export function isPayUConfigured() {
  return Boolean(
    String(process.env.PAYU_MERCHANT_KEY || '').trim() &&
      String(process.env.PAYU_MERCHANT_SALT || '').trim(),
  );
}

const PAYU_TEST_SIMULATOR_URL = 'https://test-payment-middleware.payu.in/simulatorResponse';

function getPublicApiBase() {
  const configured = String(process.env.PUBLIC_API_URL || process.env.API_PUBLIC_URL || '').trim();
  if (configured) return configured.replace(/\/+$/, '');
  const port = process.env.PORT || 5000;
  return `http://localhost:${port}`;
}

function isLocalPublicBase(url) {
  return /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|172\.(1[6-9]|2\d|3[01])\./i.test(String(url || ''));
}

function getPayUConfig() {
  if (!isPayUConfigured()) {
    const err = new Error('PayU is not configured on the server.');
    err.status = 503;
    err.code = 'PAYU_NOT_CONFIGURED';
    throw err;
  }

  const key = process.env.PAYU_MERCHANT_KEY.trim();
  const salt = process.env.PAYU_MERCHANT_SALT.trim();
  const mode =
    String(process.env.PAYU_MODE || 'test').trim().toLowerCase() === 'live' ? 'live' : 'test';
  const publicBase = getPublicApiBase();
  const explicitSuccess = String(process.env.PAYU_SUCCESS_URL || '').trim();
  const explicitFailure = String(process.env.PAYU_FAILURE_URL || '').trim();
  const useTestSimulator =
    mode === 'test' && !explicitSuccess && !explicitFailure && isLocalPublicBase(publicBase);

  return {
    key,
    salt,
    mode,
    paymentUrl:
      mode === 'live' ? 'https://secure.payu.in/_payment' : 'https://test.payu.in/_payment',
    infoUrl:
      mode === 'live'
        ? 'https://info.payu.in/merchant/postservice?form=2'
        : 'https://test.payu.in/merchant/postservice?form=2',
    successUrl:
      explicitSuccess ||
      (useTestSimulator
        ? PAYU_TEST_SIMULATOR_URL
        : `${publicBase}/api/payments/payu/success`),
    failureUrl:
      explicitFailure ||
      (useTestSimulator
        ? PAYU_TEST_SIMULATOR_URL
        : `${publicBase}/api/payments/payu/failure`),
  };
}

function sha512(value) {
  return crypto.createHash('sha512').update(String(value)).digest('hex');
}

function formatAmount(amountInr) {
  const amount = Number(amountInr);
  if (!Number.isFinite(amount) || amount < 1) {
    const err = new Error('Plan price must be at least ₹1.');
    err.status = 400;
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  return amount.toFixed(2);
}

function timingSafeEqualHex(a, b) {
  const left = Buffer.from(String(a || '').toLowerCase());
  const right = Buffer.from(String(b || '').toLowerCase());
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * PayU payment request hash:
 * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
function buildPaymentHash({
  key,
  salt,
  txnid,
  amount,
  productinfo,
  firstname,
  email,
  udf1 = '',
  udf2 = '',
  udf3 = '',
  udf4 = '',
  udf5 = '',
}) {
  const payload = [
    key,
    txnid,
    amount,
    productinfo,
    firstname,
    email,
    udf1,
    udf2,
    udf3,
    udf4,
    udf5,
    '',
    '',
    '',
    '',
    '',
    salt,
  ].join('|');
  return sha512(payload);
}

/**
 * PayU reverse hash (response verification):
 * sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 */
function buildReverseHash({
  key,
  salt,
  status,
  email,
  firstname,
  productinfo,
  amount,
  txnid,
  udf1 = '',
  udf2 = '',
  udf3 = '',
  udf4 = '',
  udf5 = '',
}) {
  const payload = [
    salt,
    status,
    '',
    '',
    '',
    '',
    '',
    udf5,
    udf4,
    udf3,
    udf2,
    udf1,
    email,
    firstname,
    productinfo,
    amount,
    txnid,
    key,
  ].join('|');
  return sha512(payload);
}

function buildTxnId(paymentId) {
  // PayU txnid max length is 25
  const compact = String(paymentId || '').replace(/-/g, '');
  return `gd${compact}`.slice(0, 25);
}

export function buildPayULaunchToken(paymentId) {
  const secret = String(process.env.JWT_SECRET || 'ghar-dekho-payu').trim();
  return crypto
    .createHmac('sha256', secret)
    .update(`payu-launch:${paymentId}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * CheckoutPro dynamic hash: sha512(hashString + salt + postSalt)
 * hashString is provided by the SDK (already includes everything except salt).
 */
export function generatePayUCheckoutHash({ hashString, postSalt = '' }) {
  if (!isPayUConfigured()) {
    const err = new Error('PayU is not configured on the server.');
    err.status = 503;
    err.code = 'PAYU_NOT_CONFIGURED';
    throw err;
  }
  const base = String(hashString || '');
  if (!base) {
    const err = new Error('hashString is required.');
    err.status = 400;
    err.code = 'INVALID_HASH_STRING';
    throw err;
  }
  const salt = process.env.PAYU_MERCHANT_SALT.trim();
  const suffix = postSalt == null ? '' : String(postSalt);
  return sha512(`${base}${salt}${suffix}`);
}

export function verifyPayULaunchToken(paymentId, token) {
  if (!paymentId || !token) return false;
  const expected = buildPayULaunchToken(paymentId);
  try {
    return timingSafeEqualHex(expected, String(token).trim());
  } catch {
    return expected === String(token).trim();
  }
}

/**
 * HTML auto-submit page for Chrome Custom Tabs (UPI apps work there; not in WebView).
 */
export async function getPayULaunchPage({ paymentId, token }) {
  if (!verifyPayULaunchToken(paymentId, token)) {
    const err = new Error('Invalid or expired checkout link.');
    err.status = 403;
    err.code = 'INVALID_LAUNCH_TOKEN';
    throw err;
  }

  const payment = await prisma.paymentTransaction.findUnique({
    where: { id: paymentId },
  });
  if (!payment || payment.provider !== 'PAYU') {
    const err = new Error('Payment not found.');
    err.status = 404;
    err.code = 'PAYMENT_NOT_FOUND';
    throw err;
  }
  if (payment.status !== 'CREATED') {
    const err = new Error('This payment is no longer available for checkout.');
    err.status = 409;
    err.code = 'PAYMENT_NOT_CHECKOUTABLE';
    throw err;
  }

  const meta = payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
  const payuParams = meta.payuParams && typeof meta.payuParams === 'object' ? meta.payuParams : null;
  const paymentUrl = String(meta.paymentUrl || '').trim();
  if (!payuParams || !paymentUrl) {
    const err = new Error('Checkout details missing for this payment.');
    err.status = 500;
    err.code = 'MISSING_CHECKOUT_PARAMS';
    throw err;
  }

  const inputs = Object.entries(payuParams)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      const safe = String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;');
      return `<input type="hidden" name="${key}" value="${safe}" />`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>PayU Checkout</title>
  </head>
  <body onload="document.forms[0].submit()">
    <p style="font-family: sans-serif; text-align: center; margin-top: 48px;">
      Redirecting to PayU…
    </p>
    <form action="${paymentUrl.replace(/"/g, '&quot;')}" method="post">
      ${inputs}
    </form>
  </body>
</html>`;
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

async function loadCheckoutUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      phone: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  });

  if (!user) {
    const err = new Error('User not found.');
    err.status = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  const firstname =
    String(user.profile?.firstName || '').trim() ||
    String(user.email || '').split('@')[0] ||
    'Customer';
  const email =
    String(user.email || '').trim() ||
    `user${String(user.id).replace(/-/g, '').slice(0, 12)}@example.com`;
  const phoneDigits = String(user.phone || '').replace(/\D/g, '');
  const phone =
    phoneDigits.length >= 10 ? phoneDigits.slice(-10) : phoneDigits || '9999999999';

  return { user, firstname, email, phone };
}

/**
 * Create a PayU checkout payload + PaymentTransaction for membership.
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

  const payu = getPayUConfig();
  const { firstname, email, phone } = await loadCheckoutUser(userId);
  const amount = formatAmount(resolved.plan.price);
  const productinfo = `Ghar Dekho ${resolved.plan.name}`.slice(0, 100);

  const payment = await prisma.paymentTransaction.create({
    data: {
      userId,
      provider: 'PAYU',
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
    const txnid = buildTxnId(payment.id);
    const udf1 = payment.id;
    const udf2 = resolved.mode;
    const udf3 = resolved.accountType;
    const udf4 = resolved.planTier;
    const udf5 = resolved.plan.id;

    const hash = buildPaymentHash({
      key: payu.key,
      salt: payu.salt,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
    });

    const payuParams = {
      key: payu.key,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl: payu.successUrl,
      furl: payu.failureUrl,
      hash,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
    };

    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        providerOrderId: txnid,
        metadata: {
          mode: resolved.mode,
          accountType: resolved.accountType,
          planTier: resolved.planTier,
          planId: resolved.plan.id,
          planName: resolved.plan.name,
          payu: {
            txnid,
            amount,
            productinfo,
            firstname,
            email,
            phone,
          },
          // Full checkout form for Chrome Custom Tabs launch page
          payuParams,
          paymentUrl: payu.paymentUrl,
          launchToken: buildPayULaunchToken(payment.id),
        },
      },
    });

    const launchToken = buildPayULaunchToken(payment.id);

    return {
      paymentId: payment.id,
      txnid,
      orderId: txnid,
      amount,
      amountPaise: Math.round(Number(amount) * 100),
      currency: resolved.plan.currency || 'INR',
      key: payu.key,
      keyId: payu.key,
      hash,
      productinfo,
      firstname,
      email,
      phone,
      surl: payu.successUrl,
      furl: payu.failureUrl,
      udf1,
      udf2,
      udf3,
      udf4,
      udf5,
      paymentUrl: payu.paymentUrl,
      launchToken,
      launchPath: `/api/payments/payu/launch/${payment.id}?t=${launchToken}`,
      provider: 'PAYU',
      mode: resolved.mode,
      environment: payu.mode,
      planName: resolved.plan.name,
      planDays: resolved.plan.duration,
      priceInr: resolved.plan.price,
      accountType: resolved.accountType,
      planTier: resolved.planTier,
      payuParams,
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

function verifyPayUResponseHash(payload) {
  const payu = getPayUConfig();
  const expected = buildReverseHash({
    key: payu.key,
    salt: payu.salt,
    status: payload.status,
    email: payload.email || '',
    firstname: payload.firstname || '',
    productinfo: payload.productinfo || '',
    amount: payload.amount,
    txnid: payload.txnid,
    udf1: payload.udf1 || '',
    udf2: payload.udf2 || '',
    udf3: payload.udf3 || '',
    udf4: payload.udf4 || '',
    udf5: payload.udf5 || '',
  });

  if (!timingSafeEqualHex(expected, payload.hash)) {
    const err = new Error('Invalid payment signature.');
    err.status = 400;
    err.code = 'INVALID_SIGNATURE';
    throw err;
  }
}

async function verifyPayUTransactionStatus(txnid) {
  const payu = getPayUConfig();
  const command = 'verify_payment';
  const hash = sha512(`${payu.key}|${command}|${txnid}|${payu.salt}`);

  try {
    const { data } = await axios.post(
      payu.infoUrl,
      new URLSearchParams({
        key: payu.key,
        command,
        var1: txnid,
        hash,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      },
    );

    const transaction =
      data?.transaction_details?.[txnid] ||
      data?.transaction_details?.[String(txnid).toUpperCase()] ||
      null;

    if (!transaction) {
      return { ok: false, raw: data };
    }

    const status = String(transaction.status || '').toLowerCase();
    return {
      ok: SUCCESS_STATUSES.has(status),
      status,
      mihpayid: transaction.mihpayid || transaction.imei || null,
      amount: transaction.amt || transaction.amount || null,
      raw: transaction,
    };
  } catch (err) {
    // Hash verification already passed; soft-fail remote verify so checkout is not blocked by PayU outage.
    console.warn('PayU verify_payment API failed:', err?.message || err);
    return { ok: null, error: err?.message || 'verify_payment failed' };
  }
}

/**
 * Verify PayU payment and activate / renew / upgrade membership.
 */
export async function verifyMembershipPayment({
  userId,
  paymentId,
  txnid,
  mihpayid,
  status,
  hash,
  amount,
  productinfo,
  firstname,
  email,
  udf1,
  udf2,
  udf3,
  udf4,
  udf5,
}) {
  if (!isPayUConfigured()) {
    const err = new Error('PayU is not configured on the server.');
    err.status = 503;
    err.code = 'PAYU_NOT_CONFIGURED';
    throw err;
  }

  if (!paymentId || !txnid || !status || !hash || !amount) {
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

  if (payment.status === 'CAPTURED' && (!mihpayid || payment.providerPaymentId === mihpayid)) {
    const ctx = await loadUserMembershipContext(userId);
    return {
      alreadyProcessed: true,
      membership: ctx,
      payment,
    };
  }

  if (payment.providerOrderId && payment.providerOrderId !== txnid) {
    const err = new Error('Transaction id does not match this payment.');
    err.status = 400;
    err.code = 'ORDER_MISMATCH';
    throw err;
  }

  const expectedAmount = formatAmount(payment.amount);
  if (Number(amount).toFixed(2) !== expectedAmount) {
    const err = new Error('Payment amount does not match this order.');
    err.status = 400;
    err.code = 'AMOUNT_MISMATCH';
    throw err;
  }

  const meta = payment.metadata && typeof payment.metadata === 'object' ? payment.metadata : {};
  const stored = meta.payu && typeof meta.payu === 'object' ? meta.payu : {};

  // Hosted checkout returns reverse hash; CheckoutPro SDK may omit/differ.
  // Prefer signature when valid; otherwise require live verify_payment confirmation.
  let signatureOk = false;
  try {
    verifyPayUResponseHash({
      status,
      hash,
      amount: String(amount),
      txnid: String(txnid),
      email: String(email ?? stored.email ?? ''),
      firstname: String(firstname ?? stored.firstname ?? ''),
      productinfo: String(productinfo ?? stored.productinfo ?? ''),
      udf1: String(udf1 ?? payment.id ?? ''),
      udf2: String(udf2 ?? meta.mode ?? ''),
      udf3: String(udf3 ?? meta.accountType ?? ''),
      udf4: String(udf4 ?? meta.planTier ?? ''),
      udf5: String(udf5 ?? meta.planId ?? ''),
    });
    signatureOk = true;
  } catch {
    signatureOk = false;
  }

  const normalizedStatus = String(status).toLowerCase();
  if (!SUCCESS_STATUSES.has(normalizedStatus) && normalizedStatus !== 'completed') {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        providerOrderId: txnid,
        providerPaymentId: mihpayid || payment.providerPaymentId,
        providerSignature: hash,
        metadata: {
          ...meta,
          payuStatus: normalizedStatus,
          failedAt: new Date().toISOString(),
        },
      },
    });

    const err = new Error(`Payment ${normalizedStatus}. Membership was not activated.`);
    err.status = 400;
    err.code = 'PAYMENT_NOT_SUCCESS';
    throw err;
  }

  const remote = await verifyPayUTransactionStatus(txnid);
  if (!signatureOk && remote.ok !== true) {
    const err = new Error(
      remote.ok === false
        ? 'PayU could not confirm this payment.'
        : 'Invalid payment signature and PayU status could not be confirmed.',
    );
    err.status = 400;
    err.code = remote.ok === false ? 'PAYMENT_NOT_CONFIRMED' : 'INVALID_SIGNATURE';
    err.meta = { payuStatus: remote.status || null };
    throw err;
  }
  if (remote.ok === false) {
    const err = new Error('PayU could not confirm this payment.');
    err.status = 400;
    err.code = 'PAYMENT_NOT_CONFIRMED';
    err.meta = { payuStatus: remote.status || null };
    throw err;
  }

  const mode = String(meta.mode || 'activate').toLowerCase();
  const accountType = String(meta.accountType || '').toUpperCase();
  const planTier = String(meta.planTier || '').toUpperCase();
  const providerPaymentId = mihpayid || remote.mihpayid || txnid;

  let activation;
  if (mode === 'upgrade') {
    activation = await upgradeMembership({
      userId,
      planTier,
      source: 'PAYU',
      paymentId: payment.id,
    });
  } else {
    activation = await activateMembership({
      userId,
      accountType,
      planTier,
      source: mode === 'renew' ? 'PAYU_RENEW' : 'PAYU',
      paymentId: payment.id,
    });
  }

  const updatedPayment = await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      status: 'CAPTURED',
      providerOrderId: txnid,
      providerPaymentId,
      providerSignature: hash,
      metadata: {
        ...meta,
        verifiedAt: new Date().toISOString(),
        subscriptionId: activation.subscription.id,
        payuStatus: normalizedStatus,
        payuRemoteVerify: remote.ok,
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
