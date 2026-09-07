import twilio from 'twilio';

/**
 * Twilio SMS OTP delivery.
 *
 * We generate and store OTP in our DB (createOTP / verifyOTP). Twilio only
 * delivers the SMS. This keeps verification app-owned and consistent with email OTP.
 *
 * Required env:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_PHONE_NUMBER          E.164 sender, e.g. +15017122661
 *     — OR —
 *   TWILIO_MESSAGING_SERVICE_SID Messaging Service SID (preferred for production)
 *
 * Optional env:
 *   TWILIO_DEFAULT_COUNTRY_CODE  Digits only, default "91" (India)
 *   OTP_EXPIRY_MINUTES           Used in SMS copy (default 10)
 */

let twilioClient = null;

export function isTwilioConfigured() {
  const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
  const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
  const fromNumber = String(process.env.TWILIO_PHONE_NUMBER || '').trim();
  const messagingServiceSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();
  return Boolean(sid && token && (fromNumber || messagingServiceSid));
}

/** @deprecated Use isTwilioConfigured — kept so older imports do not break. */
export const isMsg91Configured = isTwilioConfigured;

function getTwilioClient() {
  if (!isTwilioConfigured()) return null;
  if (!twilioClient) {
    twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID.trim(),
      process.env.TWILIO_AUTH_TOKEN.trim(),
    );
  }
  return twilioClient;
}

/**
 * Normalize phone to E.164 for Twilio (`+919876543210`).
 */
function formatPhoneForTwilio(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (trimmed.startsWith('+') && digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.length >= 11) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    const cc =
      (process.env.TWILIO_DEFAULT_COUNTRY_CODE || '91').replace(/\D/g, '') || '91';
    return `+${cc}${digits}`;
  }
  return null;
}

function buildOtpMessage(otp, type) {
  const minutes = Number(process.env.OTP_EXPIRY_MINUTES) || 10;
  const purpose =
    type === 'LOGIN'
      ? 'login'
      : type === 'PASSWORD_RESET'
        ? 'password reset'
        : 'verification';
  return `Your Ghar Dekho ${purpose} OTP is ${otp}. Valid for ${minutes} minutes. Do not share this code.`;
}

/**
 * Send an OTP SMS via Twilio.
 *
 * @param {string} phone  Raw phone (with or without country code / `+`)
 * @param {string} otp    OTP code we generated
 * @param {string} [type] OTP purpose for message copy
 * @returns {Promise<{ ok: true, sid?: string } | { ok: false, reason: string }>}
 */
export const sendOTPSMS = async (phone, otp, type = 'EMAIL_VERIFICATION') => {
  if (!isTwilioConfigured()) {
    return { ok: false, reason: 'Twilio is not configured on this server.' };
  }

  const to = formatPhoneForTwilio(phone);
  if (!to) {
    return { ok: false, reason: 'Invalid phone number for SMS dispatch.' };
  }

  const client = getTwilioClient();
  const fromNumber = String(process.env.TWILIO_PHONE_NUMBER || '').trim();
  const messagingServiceSid = String(process.env.TWILIO_MESSAGING_SERVICE_SID || '').trim();

  const messagePayload = {
    to,
    body: buildOtpMessage(otp, type),
  };
  if (messagingServiceSid) {
    messagePayload.messagingServiceSid = messagingServiceSid;
  } else {
    messagePayload.from = fromNumber;
  }

  try {
    const message = await client.messages.create(messagePayload);

    if (process.env.NODE_ENV === 'development') {
      console.log('📱 Twilio OTP dispatched:', {
        to,
        sid: message.sid,
        status: message.status,
      });
    }

    return { ok: true, sid: message.sid };
  } catch (err) {
    const reason =
      err?.message ||
      err?.moreInfo ||
      (err?.code ? `Twilio error ${err.code}` : null) ||
      'Failed to reach Twilio';
    console.error('Twilio sendOTPSMS error:', reason, err?.code || '');
    return { ok: false, reason };
  }
};

export { formatPhoneForTwilio };
