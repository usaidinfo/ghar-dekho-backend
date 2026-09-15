import { success, error } from '../utils/response.js';
import { formatMembershipPayload } from '../services/membership.service.js';
import {
  createMembershipOrder,
  generatePayUCheckoutHash,
  getPayULaunchPage,
  isPayUConfigured,
  verifyMembershipPayment,
} from '../services/payment.service.js';

function sendServiceError(res, err, fallback) {
  const status = err.status || 500;
  return res
    .status(status)
    .json(error(err.message || fallback, err.meta ?? null, err.code || 'SERVER_ERROR'));
}

function pickPayUVerifyBody(body = {}) {
  const nested = body.payu || body.payuResponse || body.response || {};
  return {
    paymentId: body.paymentId || nested.paymentId || nested.udf1,
    txnid: body.txnid || nested.txnid,
    mihpayid: body.mihpayid || nested.mihpayid,
    status: body.status || nested.status,
    hash: body.hash || nested.hash,
    amount: body.amount || nested.amount,
    productinfo: body.productinfo || nested.productinfo,
    firstname: body.firstname || nested.firstname,
    email: body.email || nested.email,
    udf1: body.udf1 || nested.udf1,
    udf2: body.udf2 || nested.udf2,
    udf3: body.udf3 || nested.udf3,
    udf4: body.udf4 || nested.udf4,
    udf5: body.udf5 || nested.udf5,
  };
}

/** GET /api/payments/config — public merchant key only (safe for clients) */
export const getPaymentConfig = async (_req, res) => {
  try {
    const configured = isPayUConfigured();
    const mode =
      String(process.env.PAYU_MODE || 'test').trim().toLowerCase() === 'live' ? 'live' : 'test';
    return res.json(
      success({
        configured,
        keyId: configured ? process.env.PAYU_MERCHANT_KEY.trim() : null,
        key: configured ? process.env.PAYU_MERCHANT_KEY.trim() : null,
        provider: 'PAYU',
        mode,
        paymentUrl: configured
          ? mode === 'live'
            ? 'https://secure.payu.in/_payment'
            : 'https://test.payu.in/_payment'
          : null,
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

/** POST /api/payments/payu/hash — CheckoutPro dynamic hash (salt stays on server) */
export const generatePayUHash = async (req, res) => {
  try {
    const hashString = String(req.body?.hashString || '').trim();
    const postSalt = req.body?.postSalt == null ? '' : String(req.body.postSalt);
    const hash = generatePayUCheckoutHash({ hashString, postSalt });
    return res.json(success({ hash }, 'Hash generated.'));
  } catch (err) {
    console.error('generatePayUHash error:', err);
    return sendServiceError(res, err, 'Failed to generate PayU hash.');
  }
};

/** GET /api/payments/payu/launch/:paymentId — auto-submit form for Chrome Custom Tabs */
export const launchPayUCheckout = async (req, res) => {
  try {
    const paymentId = String(req.params.paymentId || '').trim();
    const token = String(req.query.t || req.query.token || '').trim();
    const html = await getPayULaunchPage({ paymentId, token });
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(html);
  } catch (err) {
    console.error('launchPayUCheckout error:', err);
    const status = err.status || 500;
    return res
      .status(status)
      .type('html')
      .send(
        `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:40px;text-align:center;">
          <h3>Unable to open checkout</h3>
          <p>${String(err.message || 'Please go back to the app and try again.')}</p>
        </body></html>`,
      );
  }
};

/** POST/GET /api/payments/payu/success|failure — PayU browser return bridge for mobile */
export const payuReturnBridge = async (req, res) => {
  try {
    const params = { ...(req.query || {}), ...(req.body || {}) };
    const payload = {
      txnid: params.txnid || '',
      mihpayid: params.mihpayid || '',
      status: params.status || '',
      hash: params.hash || '',
      amount: params.amount || '',
      productinfo: params.productinfo || '',
      firstname: params.firstname || '',
      email: params.email || '',
      udf1: params.udf1 || '',
      udf2: params.udf2 || '',
      udf3: params.udf3 || '',
      udf4: params.udf4 || '',
      udf5: params.udf5 || '',
      error_Message: params.error_Message || params.error || '',
    };

    const qs = new URLSearchParams(
      Object.entries(payload).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && String(value).length) acc[key] = String(value);
        return acc;
      }, {}),
    ).toString();

    const deepLink = `ghardekho://payu/callback?${qs}`;
    const json = JSON.stringify(payload).replace(/</g, '\\u003c');

    res.removeHeader('Content-Security-Policy');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payment complete</title>
  </head>
  <body style="font-family: sans-serif; text-align: center; padding: 40px;">
    <p>Payment complete. Returning to Ghar Dekho…</p>
    <script>
      (function () {
        var payload = ${json};
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(payload));
        }
        setTimeout(function () {
          window.location.href = ${JSON.stringify(deepLink)};
        }, 50);
      })();
    </script>
  </body>
</html>`);
  } catch (err) {
    console.error('payuReturnBridge error:', err);
    return res.status(500).send('Payment return handling failed.');
  }
};

/** POST /api/payments/membership/verify */
export const verifyMembershipPaymentOrder = async (req, res) => {
  try {
    const fields = pickPayUVerifyBody(req.body);
    const result = await verifyMembershipPayment({
      userId: req.user.id,
      ...fields,
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
