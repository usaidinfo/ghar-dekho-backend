import prisma from '../config/database.js';
import { generateOTP, getOTPExpiry } from '../utils/otp.js';

/**
 * Create & store OTP in DB, return the OTP value
 */
export const createOTP = async ({ userId = null, email = null, phone = null, type }) => {
  // Invalidate old OTPs of same type for same target
  await prisma.oTPVerification.updateMany({
    where: {
      ...(userId && { userId }),
      ...(email  && { email }),
      ...(phone  && { phone }),
      type,
      isVerified: false,
    },
    data: { isVerified: true }, // mark old ones as used
  });

  const otp = generateOTP();
  await prisma.oTPVerification.create({
    data: {
      userId,
      email,
      phone,
      otp,
      type,
      expiresAt: getOTPExpiry(),
    },
  });

  return otp;
};

/**
 * Verify OTP — returns true if valid, false otherwise
 */
export const verifyOTP = async ({ email = null, phone = null, otp, type }) => {
  const record = await prisma.oTPVerification.findFirst({
    where: {
      ...(email && { email }),
      ...(phone && { phone }),
      otp,
      type,
      isVerified: false,
      expiresAt:  { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!record) return { valid: false, reason: 'Invalid or expired OTP' };

  // Increment attempt count
  await prisma.oTPVerification.update({
    where: { id: record.id },
    data:  { isVerified: true },
  });

  return { valid: true, record };
};

