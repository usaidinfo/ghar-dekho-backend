import crypto from 'crypto';

/**
 * Generate a 6-digit numeric OTP
 */
export const generateOTP = () =>
  String(crypto.randomInt(100000, 999999));

/**
 * OTP expiry: 10 minutes from now
 */
export const getOTPExpiry = () => {
  const expiry = new Date();
  expiry.setMinutes(expiry.getMinutes() + (parseInt(process.env.OTP_EXPIRY_MINUTES) || 10));
  return expiry;
};

