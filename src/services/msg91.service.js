import axios from 'axios';

/**
 * MSG91 WhatsApp OTP (SendOTP Widget) helpers.
 *
 * Delivery happens on the mobile SDK. Backend only:
 *  - exposes widget config (widgetId + tokenAuth)
 *  - verifies the access-token returned after the user enters OTP
 *
 * Required env:
 *   MSG91_AUTH_KEY
 *   MSG91_WIDGET_ID
 *
 * Optional env:
 *   MSG91_TOKEN_AUTH          Widget Token Auth from MSG91 dashboard (preferred for SDK init)
 *   MSG91_WIDGET_NAME
 *   MSG91_VERIFY_TOKEN_URL    default https://control.msg91.com/api/v5/widget/verifyAccessToken
 */

const DEFAULT_VERIFY_URL = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';

export function isMsg91WhatsAppConfigured() {
  return Boolean(
    String(process.env.MSG91_AUTH_KEY || '').trim() &&
      String(process.env.MSG91_WIDGET_ID || '').trim(),
  );
}

export function getMsg91WidgetConfig() {
  if (!isMsg91WhatsAppConfigured()) {
    const err = new Error('MSG91 WhatsApp OTP is not configured.');
    err.status = 503;
    err.code = 'MSG91_NOT_CONFIGURED';
    throw err;
  }

  const widgetId = process.env.MSG91_WIDGET_ID.trim();
  // IMPORTANT: Token Auth is NOT the same as MSG91_AUTH_KEY.
  // Copy "Token Auth" / JWT from MSG91 → OTP → your widget → Integration.
  const tokenAuth = String(process.env.MSG91_TOKEN_AUTH || '').trim();
  const authKey = String(process.env.MSG91_AUTH_KEY || '').trim();

  if (!tokenAuth) {
    const err = new Error(
      'MSG91_TOKEN_AUTH is missing. Open MSG91 OTP widget → Integration and copy Token Auth (JWT), not Auth Key.',
    );
    err.status = 503;
    err.code = 'MSG91_TOKEN_MISSING';
    throw err;
  }

  if (tokenAuth === authKey) {
    const err = new Error(
      'MSG91_TOKEN_AUTH is set to AUTH_KEY. That causes "Authentication failure". Paste the widget Token Auth JWT from MSG91 dashboard instead.',
    );
    err.status = 503;
    err.code = 'MSG91_TOKEN_INVALID';
    throw err;
  }

  return {
    widgetId,
    tokenAuth,
    widgetName: String(process.env.MSG91_WIDGET_NAME || '').trim() || null,
    channel: 'WHATSAPP',
  };
}

/**
 * Verify MSG91 widget access-token after client-side OTP verification.
 * @returns {Promise<{ ok: true, phone?: string | null, raw: any } | { ok: false, reason: string }>}
 */
export async function verifyMsg91AccessToken(accessToken) {
  if (!isMsg91WhatsAppConfigured()) {
    return { ok: false, reason: 'MSG91 is not configured on this server.' };
  }
  if (!accessToken || !String(accessToken).trim()) {
    return { ok: false, reason: 'Access token is required.' };
  }

  const url =
    String(process.env.MSG91_VERIFY_TOKEN_URL || '').trim() || DEFAULT_VERIFY_URL;

  try {
    const { data } = await axios.post(
      url,
      {
        authkey: process.env.MSG91_AUTH_KEY.trim(),
        'access-token': String(accessToken).trim(),
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout: 15000,
      },
    );

    const success =
      data?.success === true ||
      data?.type === 'success' ||
      String(data?.message || '').toLowerCase().includes('success');

    if (!success) {
      return {
        ok: false,
        reason: data?.message || data?.error || 'MSG91 rejected the access token.',
      };
    }

    const phone =
      data?.phone ||
      data?.mobile ||
      data?.data?.phone ||
      data?.data?.mobile ||
      null;

    return { ok: true, phone, raw: data };
  } catch (err) {
    const reason =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      err?.message ||
      'Failed to reach MSG91';
    console.error('MSG91 verifyAccessToken error:', reason);
    return { ok: false, reason };
  }
}

/**
 * Normalize phone to digits with country code, no '+'.
 * e.g. +919876543210 / 9876543210 → 919876543210
 */
export function formatPhoneForMsg91(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  if (digits.length >= 11) return digits;
  return null;
}
