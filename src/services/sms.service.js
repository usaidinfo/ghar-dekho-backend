import axios from 'axios';

/**
 * MSG91 SMS / OTP integration.
 *
 * We use MSG91's OTP API but supply our OWN otp value so that the existing
 * DB-based OTP flow (createOTP / verifyOTP) remains the single source of
 * truth. MSG91 only handles delivery via the configured DLT template.
 *
 * Required env:
 *   MSG91_AUTH_KEY       e.g. 515716ApcJTrY7cTW36a044be5P1
 *   MSG91_SENDER_ID      e.g. GHARDK  (DLT-approved sender)
 *   MSG91_OTP_TEMPLATE_ID e.g. 6a044ceb95cfc11c4302a392 (template containing ##OTP##)
 *
 * Optional env:
 *   MSG91_OTP_EXPIRY_MIN  numeric, defaults to 10
 *   MSG91_COUNTRY_CODE    numeric default country code prefix when phone has
 *                          10 digits and no '+'. Defaults to "91".
 */

const MSG91_BASE_URL = 'https://control.msg91.com/api/v5';

const isMsg91Configured = () =>
  Boolean(process.env.MSG91_AUTH_KEY && process.env.MSG91_OTP_TEMPLATE_ID);

/**
 * Convert any phone string (`+919876543210`, `9876543210`, `919876543210`,
 * `+91 98765 43210`, etc.) into the digits-only form MSG91 expects:
 * country-code + national-number, no `+`, no spaces.
 *
 * Returns null if it doesn't look like a valid Indian (or international)
 * dialable number.
 */
const formatPhoneForMsg91 = phone => {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  // Already includes country code (e.g. 91XXXXXXXXXX or input had `+`).
  if (trimmed.startsWith('+') && digits.length >= 11) return digits;
  if (digits.length >= 11) return digits;

  // National 10-digit number → prepend default country code.
  if (digits.length === 10) {
    const cc = (process.env.MSG91_COUNTRY_CODE || '91').replace(/\D/g, '') || '91';
    return `${cc}${digits}`;
  }
  return null;
};

/**
 * Send an OTP via MSG91 using a pre-approved DLT OTP template.
 *
 * The template body must include the `##OTP##` placeholder; MSG91 will
 * substitute it with the value we pass.
 *
 * @param {string} phone  Raw phone (with or without country code/`+`)
 * @param {string} otp    The OTP code to deliver (we generated this ourselves)
 * @returns {Promise<{ ok: true, requestId?: string } | { ok: false, reason: string }>}
 */
export const sendOTPSMS = async (phone, otp) => {
  if (!isMsg91Configured()) {
    return { ok: false, reason: 'MSG91 is not configured on this server.' };
  }

  const mobile = formatPhoneForMsg91(phone);
  if (!mobile) {
    return { ok: false, reason: 'Invalid phone number for SMS dispatch.' };
  }

  const params = {
    template_id: process.env.MSG91_OTP_TEMPLATE_ID,
    mobile,
    otp,
    otp_expiry: Number(process.env.MSG91_OTP_EXPIRY_MIN) || 10,
  };
  if (process.env.MSG91_SENDER_ID) {
    params.sender = process.env.MSG91_SENDER_ID;
  }

  try {
    const { data } = await axios.post(`${MSG91_BASE_URL}/otp`, null, {
      params,
      headers: {
        authkey: process.env.MSG91_AUTH_KEY,
        accept: 'application/json',
      },
      timeout: 10_000,
    });

    if (data?.type === 'success') {
      if (process.env.NODE_ENV === 'development') {
        console.log('📱 MSG91 OTP dispatched:', {
          mobile,
          requestId: data.request_id,
        });
      }
      return { ok: true, requestId: data.request_id };
    }

    return {
      ok: false,
      reason: data?.message || data?.type || 'MSG91 rejected the request.',
    };
  } catch (err) {
    const respData = err?.response?.data;
    const reason =
      respData?.message ||
      respData?.type ||
      err?.message ||
      'Failed to reach MSG91';
    console.error('MSG91 sendOTPSMS error:', reason, respData || '');
    return { ok: false, reason };
  }
};

export { isMsg91Configured };
